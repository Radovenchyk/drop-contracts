use cosmwasm_schema::{cw_serde, QueryResponses};

use cosmwasm_std::Addr;
use lido_puppeteer_base::{
    msg::DelegationsResponse,
    state::{BaseConfig, State, Transfer},
};

#[cw_serde]
pub struct Config {
    pub connection_id: String,
    pub port_id: String,
    pub update_period: u64,
    pub remote_denom: String,
    pub owner: Addr,
}

impl BaseConfig for Config {
    fn owner(&self) -> &str {
        self.owner.as_str()
    }

    fn connection_id(&self) -> String {
        self.connection_id.clone()
    }

    fn update_period(&self) -> u64 {
        self.update_period
    }
}

#[cw_serde]
#[derive(QueryResponses)]
pub enum QueryMsg {
    #[returns(Config)]
    Config {},
    #[returns(State)]
    State {},
    #[returns(Vec<Transfer>)]
    InterchainTransactions {},
    #[returns(DelegationsResponse)]
    Delegations {},
}