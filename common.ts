import * as path from 'path';
import chai = require('chai')
import dotenv = require('dotenv')
import chaiAsPromised = require('chai-as-promised')
import { JsonRpcProvider, Provider } from '@ethersproject/providers'

chai.use(chaiAsPromised)
const should = chai.should()

// Load up env variables if running locally
if (process.env.NODE_ENV === 'local') {
  const envPath = path.join(__dirname, '/.env');
  dotenv.config({ path: envPath })
}

// Commonly used test mnemonic
export const mnemonic = process.env.MNEMONIC ||
  'abandon abandon abandon abandon abandon abandon ' +
  'abandon abandon abandon abandon abandon about'

let l1Provider: Provider
export const getL1Provider = (): Provider => {
  if (!l1Provider) {
    l1Provider = new JsonRpcProvider(Config.L1NodeUrlWithPort())
  }
  return l1Provider
}

let l2Provider: Provider
export const getl2Provider = (): Provider => {
  if (!l2Provider) {
    l2Provider = new JsonRpcProvider(Config.L2NodeUrlWithPort())
  }
  return l2Provider
}

export class Config {
  public static L1NodeUrlWithPort(): string {
    if (process.env.L1_NODE_WEB3_URL === undefined) {
      throw new Error('L1_NODE_WEB3_URL is undefined')
    }
    return process.env.L1_NODE_WEB3_URL
  }

  public static L2NodeUrlWithPort(): string {
    if (process.env.L1_NODE_WEB3_URL === undefined) {
      throw new Error('L2_NODE_WEB3_URL is undefined')
    }
    return process.env.L2_NODE_WEB3_URL
  }

  public static Mnemonic(): string {
    return process.env.MNEMONIC || mnemonic
  }

  /* Contracts */

  public static L2DepositTrackerAddress(): string {
    return process.env.L2_DEPOSIT_TRACKER_ADDRESS
  }

  public static L1DepositIntiatorAddress(): string {
    return process.env.L1_DEPOSIT_INITIATOR_ADDRESS
  }

  public static L2TxStorageAddress(): string {
    return process.env.L2_TX_STORAGE_ADDRESS
  }

  // TODO: this is the address manager
  public static AddressResolverAddress(): string {
    if (process.env.ETH1_ADDRESS_RESOLVER_ADDRESS === undefined) {
      throw new Error('ETH1_ADDRESS_RESOLVER_ADDRESS is undefined')
    }
    return process.env.ETH1_ADDRESS_RESOLVER_ADDRESS
  }

  public static SequencerPrivateKey(): string {
    if (process.env.SEQUENCER_PRIVATE_KEY === undefined) {
      throw new Error('SEQUENCER_PRIVATE_KEY is undefined')
    }
    return process.env.SEQUENCER_PRIVATE_KEY
  }

  public static DeployerUrl(): string {
    return process.env.DEPLOYER_URL || 'http://localhost:8080'
  }

  public static DeployerPrivateKey(): string {
    if (process.env.DEPLOYER_PRIVATE_KEY === undefined) {
      throw new Error('DEPLOYER_PRIVATE_KEY is undefined')
    }
    return process.env.DEPLOYER_PRIVATE_KEY
  }

  public static TargetGasLimit(): number {
    const targetGasLimit = process.env.TARGET_GAS_LIMIT || '9000000'
    return parseInt(targetGasLimit, 10)
  }

  public static ChainID(): number {
    const chainid = process.env.CHAIN_ID || '420'
    return parseInt(chainid, 10)
  }
}

export const sleep = (m) => new Promise((r) => setTimeout(r, m))

export const poll = async (
  functionToCall: Function,
  timeout: number,
  successCondition: Function = (res: any[]) => res !== null && res.length !== 0,
  pollInterval: number = 100
) => {
  for (let i = 0; i < timeout; i += pollInterval) {
    const res = await functionToCall()
    if (successCondition(res)) {
      return res
    }
    await sleep(pollInterval)
  }
}

// Address derived at m/44'/60'/0'/0 of test mnemonic
export const etherbase = '0x9858EfFD232B4033E47d90003D41EC34EcaEda94'
