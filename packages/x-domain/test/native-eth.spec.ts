import { expect } from 'chai'
import assert = require('assert')
import { JsonRpcProvider } from '@ethersproject/providers'

import { Config } from '../../../common'
import { Watcher } from '@eth-optimism/watcher'
import { getContractInterface, getContractFactory } from '@eth-optimism/contracts'
import l1SimnpleStorageJson = require('../../../contracts/build/SimpleStorage.json')
import l2SimpleStorageJson = require('../../../contracts/build-ovm/SimpleStorage.json')
import erc20Json = require('../../../contracts/build-ovm/ERC20.json')

import {
  Contract, ContractFactory, Wallet,
} from 'ethers'

let erc20
let l1SimpleStorage
let l2SimpleStorage
let l1MessengerAddress
let l2MessengerAddress
const L1_USER_PRIVATE_KEY = Config.DeployerPrivateKey()
const L2_USER_PRIVATE_KEY = Config.DeployerPrivateKey()
const SEQUENCER_PRIVATE_KEY = Config.SequencerPrivateKey()
const goerliURL = Config.L1NodeUrlWithPort()
const optimismURL = Config.L2NodeUrlWithPort()
const l1Provider = new JsonRpcProvider(goerliURL)
const l2Provider = new JsonRpcProvider(optimismURL)
const l1Wallet = new Wallet(L1_USER_PRIVATE_KEY, l1Provider)
const l2Wallet = new Wallet(L2_USER_PRIVATE_KEY, l2Provider)
const l1MessengerInterface = getContractInterface('iOVM_BaseCrossDomainMessenger')
const l2MessengerFactory = getContractFactory('OVM_L2CrossDomainMessenger')

const addressManagerAddress = Config.AddressResolverAddress()
const addressManagerInterface = getContractInterface('Lib_AddressManager')
const AddressManager = new Contract(addressManagerAddress, addressManagerInterface, l1Provider)

const OVM_ETH_ADDRESS = '0x4200000000000000000000000000000000000006'

let watcher
const initWatcher = async () => {
  l1MessengerAddress = await AddressManager.getAddress('Proxy__OVM_L1CrossDomainMessenger')
  l2MessengerAddress = await AddressManager.getAddress('OVM_L2CrossDomainMessenger')
  return new Watcher({
    l1: {
      provider: l1Provider,
      messengerAddress: l1MessengerAddress
    },
    l2: {
      provider: l2Provider,
      messengerAddress: l2MessengerAddress
    }
  })
}

const deposit = async (OVM_L1ETHGateway: Contract, value) => {
  const depositTx = await OVM_L1ETHGateway.deposit({
    value,
    gasLimit: '0x100000'
  })
  await depositTx.wait()

  const [msgHash] = await watcher.getMessageHashesFromL1Tx(depositTx.hash)
  const receipt = await watcher.getL2TransactionReceipt(msgHash)
}

const withdraw = async (value) => {
  const l2Messenger = new Contract(l2MessengerAddress, l2MessengerFactory.interface, l2Wallet)
  const calldata = l1SimpleStorage.interface.encodeFunctionData('setValue', [value])
  const l2ToL1Tx = await l2Messenger.sendMessage(
    l1SimpleStorage.address,
    calldata,
    5000000,
    { gasLimit: 7000000 }
  )
  await l2ToL1Tx.wait()
  const [msgHash] = await watcher.getMessageHashesFromL2Tx(l2ToL1Tx.hash)
  const receipt = await watcher.getL1TransactionReceipt(msgHash)
}

describe('Native ETH', async () => {
  let OVM_L1ETHGateway: Contract 

  let OVM_ETH: Contract
  
  before(async () => {
    watcher = await initWatcher()
    
    OVM_L1ETHGateway = new Contract(
      await AddressManager.getAddress('OVM_L1ETHGateway'),
      getContractInterface('OVM_L1ETHGateway'),
      l1Wallet
    )

    OVM_ETH = new Contract(
      OVM_ETH_ADDRESS,
      getContractInterface('OVM_ETH'),
      l2Wallet
    )
  })

  it('deposit', async () => {
    await deposit(OVM_L1ETHGateway,10)
  })
})
