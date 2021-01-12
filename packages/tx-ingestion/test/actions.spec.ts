import { expect } from 'chai'
import assert = require('assert')
import { JsonRpcProvider, Web3Provider } from '@ethersproject/providers'

import { Config, sleep, etherbase } from '../../../common'
import { Watcher } from '@eth-optimism/watcher'
import { ganache } from '@eth-optimism/ovm-toolchain'
import { OptimismProvider } from '@eth-optimism/provider'
import { getContractInterface, getContractFactory } from '@eth-optimism/contracts'
import l1SimnpleStorageJson = require('../../../contracts/build/L1SimpleStorage.json')
import l2SimpleStorageJson = require('../../../contracts/build-ovm/SimpleStorage.json')
import erc20Json = require('../../../contracts/build-ovm/ERC20.json')

import {
  Contract, ContractFactory, providers, Wallet,
} from 'ethers'

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
const l2SimpleStorageFactory = new ContractFactory(
  l2SimpleStorageJson.abi, l2SimpleStorageJson.bytecode, l2Wallet
)

const l1SimpleStorageFactory = new ContractFactory(
  l1SimnpleStorageJson.abi, l1SimnpleStorageJson.bytecode, l1Wallet
)

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

describe('L1 SimpleStorage', async () => {
  before(async () => {
    watcher = await initWatcher()
    l1SimpleStorage = await l1SimpleStorageFactory.deploy()
    await l1SimpleStorage.deployTransaction.wait()
  })

  it('should withdraw from L2->L1', async () => {
    const value = `0x${'77'.repeat(32)}`
    await withdraw(value)

    const msgSender = await l1SimpleStorage.msgSender()
    const l2ToL1Sender = await l1SimpleStorage.l2ToL1Sender()
    const storageVal = await l1SimpleStorage.value()
    const count = await l1SimpleStorage.totalCount()

    msgSender.should.be.eq(l1MessengerAddress)
    l2ToL1Sender.should.be.eq(l2Wallet.address)
    storageVal.should.be.eq(value)
    count.toNumber().should.be.eq(1)
  })
})