use cosmwasm_schema::{cw_serde, QueryResponses};
use cw721::Cw721ReceiveMsg;

use crate::state::withdrawal_manager::Config;

#[cw_serde]
pub struct InstantiateMsg {
    pub core_contract: String,
    pub voucher_contract: String,
    pub base_denom: String,
    pub owner: String,
}

#[cw_serde]
#[derive(QueryResponses)]
pub enum QueryMsg {
    #[returns(Config)]
    Config {},
}

#[cw_serde]
pub enum ExecuteMsg {
    UpdateConfig {
        owner: Option<String>,
        core_contract: Option<String>,
        voucher_contract: Option<String>,
    },
    ReceiveNft(Cw721ReceiveMsg),
}

#[cw_serde]
pub enum MigrateMsg {}