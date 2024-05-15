import { describe, expect, it, beforeAll, afterAll } from 'vitest';
import {
  DropLocator,
  DropFactory,
  DropCore,
  DropPump,
  DropStaker,
  DropPuppeteer,
  DropStrategy,
  DropWithdrawalVoucher,
  DropWithdrawalManager,
  DropRewardsManager,
} from '../generated/contractLib';
import { waitFor } from '../helpers/waitFor';
import {
  QueryClient,
  StakingExtension,
  BankExtension,
  setupStakingExtension,
  setupBankExtension,
  SigningStargateClient,
} from '@cosmjs/stargate';
import { join } from 'path';
import { Tendermint34Client } from '@cosmjs/tendermint-rpc';
import { SigningCosmWasmClient } from '@cosmjs/cosmwasm-stargate';
import { Client as NeutronClient } from '@neutron-org/client-ts';
import { AccountData, DirectSecp256k1HdWallet } from '@cosmjs/proto-signing';
import { GasPrice } from '@cosmjs/stargate';
import { setupPark } from '../testSuite';
import fs from 'fs';
import Cosmopark from '@neutron-org/cosmopark';

const DropLocatorClass = DropLocator.Client;
const DropFactoryClass = DropFactory.Client;
const DropCoreClass = DropCore.Client;
const DropPumpClass = DropPump.Client;
const DropStakerClass = DropStaker.Client;
const DropPuppeteerClass = DropPuppeteer.Client;
const DropStrategyClass = DropStrategy.Client;
const DropWithdrawalVoucherClass = DropWithdrawalVoucher.Client;
const DropWithdrawalManagerClass = DropWithdrawalManager.Client;
const DropRewardsManagerClass = DropRewardsManager.Client;

const UNBONDING_TIME = 360;

describe('Locator', () => {
  const context: {
    park?: Cosmopark;
    neutronWallet?: DirectSecp256k1HdWallet;
    gaiaWallet?: DirectSecp256k1HdWallet;
    account?: AccountData;
    neutronClient?: InstanceType<typeof NeutronClient>;
    neutronUserAddress?: string;
    client?: SigningCosmWasmClient;
    gaiaClient?: SigningStargateClient;
    gaiaQueryClient?: QueryClient & StakingExtension & BankExtension;
    neutronIBCDenom?: string;
    codeIds: {
      core?: number;
      token?: number;
      withdrawalVoucher?: number;
      withdrawalManager?: number;
      strategy?: number;
      staker?: number;
      puppeteer?: number;
      validatorsSet?: number;
      distribution?: number;
      rewardsManager?: number;
      factory?: number;
    };
  } = {};

  beforeAll(async (t) => {
    context.park = await setupPark(
      t,
      ['neutron', 'gaia'],
      {
        gaia: {
          genesis_opts: {
            'app_state.staking.params.unbonding_time': `${UNBONDING_TIME}s`,
          },
        },
      },
      {
        neutron: true,
        hermes: {
          config: {
            'chains.1.trusting_period': '2m0s',
          },
        },
      },
    );
    context.neutronWallet = await DirectSecp256k1HdWallet.fromMnemonic(
      context.park.config.wallets.demowallet1.mnemonic,
      {
        prefix: 'neutron',
      },
    );
    context.gaiaWallet = await DirectSecp256k1HdWallet.fromMnemonic(
      context.park.config.wallets.demowallet1.mnemonic,
      {
        prefix: 'cosmos',
      },
    );
    context.account = (await context.neutronWallet.getAccounts())[0];
    context.neutronClient = new NeutronClient({
      apiURL: `http://127.0.0.1:${context.park.ports.neutron.rest}`,
      rpcURL: `127.0.0.1:${context.park.ports.neutron.rpc}`,
      prefix: 'neutron',
    });
    context.client = await SigningCosmWasmClient.connectWithSigner(
      `http://127.0.0.1:${context.park.ports.neutron.rpc}`,
      context.neutronWallet,
      {
        gasPrice: GasPrice.fromString('0.025untrn'),
      },
    );
    context.gaiaClient = await SigningStargateClient.connectWithSigner(
      `http://127.0.0.1:${context.park.ports.gaia.rpc}`,
      context.gaiaWallet,
      {
        gasPrice: GasPrice.fromString('0.025stake'),
      },
    );
    const tmClient = await Tendermint34Client.connect(
      `http://127.0.0.1:${context.park.ports.gaia.rpc}`,
    );
    context.gaiaQueryClient = QueryClient.withExtensions(
      tmClient,
      setupStakingExtension,
      setupBankExtension,
    );
    context.neutronUserAddress = (
      await context.neutronWallet.getAccounts()
    )[0].address;
    await waitFor(async () => {
      const balances =
        await context.neutronClient.CosmosBankV1Beta1.query.queryAllBalances(
          context.neutronUserAddress,
        );
      context.neutronIBCDenom = balances.data.balances.find((b) =>
        b.denom.startsWith('ibc/'),
      )?.denom;
      return balances.data.balances.length > 1;
    }, 50_000);
    expect(context.neutronIBCDenom).toBeTruthy();
  });
  afterAll(async () => {
    await context.park.stop();
  });
  it('Upload binaries', async () => {
    const { client, account } = context;
    context.codeIds = {};
    {
      const res = await client.upload(
        account.address,
        fs.readFileSync(join(__dirname, '../../../artifacts/drop_core.wasm')),
        1.5,
      );
      expect(res.codeId).toBeGreaterThan(0);
      context.codeIds.core = res.codeId;
    }
    {
      const res = await client.upload(
        account.address,
        fs.readFileSync(join(__dirname, '../../../artifacts/drop_token.wasm')),
        1.5,
      );
      expect(res.codeId).toBeGreaterThan(0);
      context.codeIds.token = res.codeId;
    }
    {
      const res = await client.upload(
        account.address,
        fs.readFileSync(
          join(__dirname, '../../../artifacts/drop_withdrawal_voucher.wasm'),
        ),
        1.5,
      );
      expect(res.codeId).toBeGreaterThan(0);
      context.codeIds.withdrawalVoucher = res.codeId;
    }
    {
      const res = await client.upload(
        account.address,
        fs.readFileSync(
          join(__dirname, '../../../artifacts/drop_withdrawal_manager.wasm'),
        ),
        1.5,
      );
      expect(res.codeId).toBeGreaterThan(0);
      context.codeIds.withdrawalManager = res.codeId;
    }
    {
      const res = await client.upload(
        account.address,
        fs.readFileSync(
          join(__dirname, '../../../artifacts/drop_strategy.wasm'),
        ),
        1.5,
      );
      expect(res.codeId).toBeGreaterThan(0);
      context.codeIds.strategy = res.codeId;
    }
    {
      const res = await client.upload(
        account.address,
        fs.readFileSync(
          join(__dirname, '../../../artifacts/drop_distribution.wasm'),
        ),
        1.5,
      );
      expect(res.codeId).toBeGreaterThan(0);
      context.codeIds.distribution = res.codeId;
    }
    {
      const res = await client.upload(
        account.address,
        fs.readFileSync(
          join(__dirname, '../../../artifacts/drop_validators_set.wasm'),
        ),
        1.5,
      );
      expect(res.codeId).toBeGreaterThan(0);
      context.codeIds.validatorsSet = res.codeId;
    }
    {
      const res = await client.upload(
        account.address,
        fs.readFileSync(
          join(__dirname, '../../../artifacts/drop_puppeteer.wasm'),
        ),
        1.5,
      );
      expect(res.codeId).toBeGreaterThan(0);
      context.codeIds.puppeteer = res.codeId;
    }
    {
      const res = await client.upload(
        account.address,
        fs.readFileSync(
          join(__dirname, '../../../artifacts/drop_rewards_manager.wasm'),
        ),
        1.5,
      );
      expect(res.codeId).toBeGreaterThan(0);
      context.codeIds.rewardsManager = res.codeId;
    }
    {
      const res = await client.upload(
        account.address,
        fs.readFileSync(join(__dirname, '../../../artifacts/drop_staker.wasm')),
        1.5,
      );
      expect(res.codeId).toBeGreaterThan(0);
      context.codeIds.staker = res.codeId;
    }
    {
      const res = await client.upload(
        account.address,
        fs.readFileSync(
          join(__dirname, '../../../artifacts/drop_factory.wasm'),
        ),
        1.5,
      );
      expect(res.codeId).toBeGreaterThan(0);
      context.codeIds.factory = res.codeId;
    }
  });

  it('instantiate factory instances', async () => {
    const { client, account, codeIds } = context;
    const factory_instantiate_message = {
      sdk_version: process.env.SDK_VERSION || '0.46.0',
      code_ids: {
        core_code_id: context.codeIds.core,
        token_code_id: context.codeIds.token,
        withdrawal_voucher_code_id: context.codeIds.withdrawalVoucher,
        withdrawal_manager_code_id: context.codeIds.withdrawalManager,
        strategy_code_id: context.codeIds.strategy,
        staker_code_id: context.codeIds.staker,
        distribution_code_id: context.codeIds.distribution,
        validators_set_code_id: context.codeIds.validatorsSet,
        puppeteer_code_id: context.codeIds.puppeteer,
        rewards_manager_code_id: context.codeIds.rewardsManager,
      },
      remote_opts: {
        connection_id: 'connection-0',
        transfer_channel_id: 'channel-0',
        port_id: 'transfer',
        denom: 'stake',
        update_period: 2,
      },
      salt: '1',
      subdenom: 'drop',
      token_metadata: {
        description: 'Drop token',
        display: 'drop',
        exponent: 6,
        name: 'Drop liquid staking token',
        symbol: 'DROP',
        uri: null,
        uri_hash: null,
      },
      base_denom: context.neutronIBCDenom,
      core_params: {
        idle_min_interval: 40,
        puppeteer_timeout: 60,
        unbond_batch_switch_time: 60,
        unbonding_safe_period: 10,
        unbonding_period: 360,
        lsm_redeem_threshold: 2,
        lsm_min_bond_amount: '1000',
        lsm_redeem_max_interval: 60_000,
        bond_limit: '100000',
        min_stake_amount: '2',
        icq_update_delay: 5,
      },
      staker_params: {
        min_stake_amount: '10000',
        min_ibc_transfer: '10000',
      },
    };
    const instantiateRes = await DropFactory.Client.instantiate(
      client,
      account.address,
      codeIds.factory,
      factory_instantiate_message,
      'drop-staking-factory',
      'auto',
      [],
    );
    console.log(instantiateRes);
  });
});
