use crate::{
    error::ContractResult,
    msg::{ExecuteMsg, FactoryInstance, InstantiateMsg, QueryMsg},
    state::{DropInstance, STATE},
};
use cosmwasm_std::{
    attr, entry_point, to_json_binary, Attribute, Binary, Deps, DepsMut, Env, MessageInfo, Order,
    Response, StdResult,
};
use cw2::set_contract_version;
use cw_ownable::{get_ownership, update_ownership};
use drop_helpers::answer::response;
use drop_staking_base::msg::factory::QueryMsg as FactoryQueryMsg;
use neutron_sdk::bindings::{msg::NeutronMsg, query::NeutronQuery};

const CONTRACT_NAME: &str = concat!("crates.io:drop-staking__", env!("CARGO_PKG_NAME"));
const CONTRACT_VERSION: &str = env!("CARGO_PKG_VERSION");

#[cfg_attr(not(feature = "library"), entry_point)]
pub fn instantiate(
    deps: DepsMut,
    _env: Env,
    info: MessageInfo,
    _msg: InstantiateMsg,
) -> ContractResult<Response<NeutronMsg>> {
    set_contract_version(deps.storage, CONTRACT_NAME, CONTRACT_VERSION)?;
    cw_ownable::initialize_owner(deps.storage, deps.api, Some(info.sender.as_str()))?;
    Ok(response(
        "instantiate",
        CONTRACT_NAME,
        vec![attr("owner", &info.sender)],
    ))
}

#[cfg_attr(not(feature = "library"), entry_point)]
pub fn query(deps: Deps<NeutronQuery>, _env: Env, msg: QueryMsg) -> StdResult<Binary> {
    match msg {
        QueryMsg::Chains {} => query_chains(deps),
        QueryMsg::Chain { name } => query_chain(deps, name),
        QueryMsg::Ownership {} => Ok(to_json_binary(&get_ownership(deps.storage)?)?),
        QueryMsg::FactoryInstance { name } => query_factory_instance(deps, name),
        QueryMsg::FactoryInstances {} => query_factory_instances(deps),
    }
}

pub fn query_factory_instance(deps: Deps<NeutronQuery>, name: String) -> StdResult<Binary> {
    let factory_addr = STATE.load(deps.storage, name)?.factory_addr;
    to_json_binary(&FactoryInstance {
        addr: factory_addr.to_string(),
        contracts: deps
            .querier
            .query_wasm_smart(factory_addr.clone(), &FactoryQueryMsg::State {})?,
    })
}

pub fn query_factory_instances(deps: Deps<NeutronQuery>) -> StdResult<Binary> {
    let drop_instances: Vec<FactoryInstance> = STATE
        .range(deps.storage, None, None, Order::Ascending)
        .map(|item| {
            item.map(|(_key, value)| FactoryInstance {
                addr: value.factory_addr.clone(),
                contracts: deps
                    .querier
                    .query_wasm_smart(value.factory_addr.clone(), &FactoryQueryMsg::State {})
                    .unwrap(),
            })
            .unwrap()
        })
        .collect();
    to_json_binary(&drop_instances)
}

pub fn query_chain(deps: Deps<NeutronQuery>, name: String) -> StdResult<Binary> {
    let chain = STATE.load(deps.storage, name.clone())?;
    to_json_binary(&DropInstance {
        name,
        factory_addr: chain.factory_addr,
    })
}

pub fn query_chains(deps: Deps<NeutronQuery>) -> StdResult<Binary> {
    let drop_instances: StdResult<Vec<_>> = STATE
        .range(deps.storage, None, None, Order::Ascending)
        .map(|item| {
            item.map(|(key, value)| DropInstance {
                name: key,
                factory_addr: value.factory_addr,
            })
        })
        .collect();
    let drop_instances = drop_instances?;
    to_json_binary(&drop_instances)
}

#[cfg_attr(not(feature = "library"), entry_point)]
pub fn execute(
    deps: DepsMut,
    env: Env,
    info: MessageInfo,
    msg: ExecuteMsg,
) -> ContractResult<Response<NeutronMsg>> {
    match msg {
        ExecuteMsg::AddChains { chains } => execute_add_chains(deps, env, info, chains),
        ExecuteMsg::RemoveChains { names } => execute_remove_chains(deps, env, info, names),
        ExecuteMsg::UpdateOwnership(action) => {
            update_ownership(deps.into_empty(), &env.block, &info.sender, action)?;
            Ok(Response::new())
        }
    }
}

pub fn execute_remove_chains(
    deps: DepsMut,
    _env: Env,
    info: MessageInfo,
    msg: Vec<String>,
) -> ContractResult<Response<NeutronMsg>> {
    cw_ownable::assert_owner(deps.storage, &info.sender)?;
    let mut attrs: Vec<Attribute> = Vec::new();
    msg.iter().for_each(|name| {
        STATE.remove(deps.storage, name.to_string());
        attrs.push(attr("remove", name))
    });
    Ok(response("execute-remove-chains", CONTRACT_NAME, attrs))
}

pub fn execute_add_chains(
    deps: DepsMut,
    _env: Env,
    info: MessageInfo,
    msg: Vec<DropInstance>,
) -> ContractResult<Response<NeutronMsg>> {
    cw_ownable::assert_owner(deps.storage, &info.sender)?;
    let mut attrs: Vec<Attribute> = Vec::new();
    for chain in msg {
        STATE.save(
            deps.storage,
            chain.name.clone(),
            &DropInstance {
                name: chain.name.to_string(),
                factory_addr: chain.factory_addr,
            },
        )?;
        attrs.push(attr("add", chain.name.to_string()))
    }
    Ok(response("execute-add-chains", CONTRACT_NAME, attrs))
}
