import * as fs from 'fs';
import { Config, sleep } from '../../../common'
import { Watcher } from '@eth-optimism/watcher'
import { ganache } from '@eth-optimism/ovm-toolchain'
import { getContractInterface, getContractFactory } from '@eth-optimism/contracts'
import { JsonRpcProvider, Web3Provider } from '@ethersproject/providers'
import assert = require('assert')

import {
  Contract, ContractFactory, providers, Wallet,
} from 'ethers';

let SimpleStorage
let l1MessengerAddress
let l2MessengerAddress
const L1_USER_PRIVATE_KEY = Config.DeployerPrivateKey()
const L2_USER_PRIVATE_KEY = Config.DeployerPrivateKey()
const goerliURL = Config.L1NodeUrlWithPort()
const optimismURL = Config.L2NodeUrlWithPort()
const l1Provider = new JsonRpcProvider(goerliURL)
const l2Provider = new JsonRpcProvider(optimismURL)
const l1Wallet = new Wallet(L1_USER_PRIVATE_KEY, l1Provider)
const l2Wallet = new Wallet(L2_USER_PRIVATE_KEY, l2Provider)
const l1MessengerJSON = getContractInterface('iOVM_BaseCrossDomainMessenger')
const l2MessengerJSON = getContractFactory('OVM_L2CrossDomainMessenger')
const addressManagerAddress = Config.AddressResolverAddress()
const addressManagerInterface = getContractInterface('Lib_AddressManager')
const AddressManager = new Contract(addressManagerAddress, addressManagerInterface, l1Provider)

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

const deploySimpleStorage = async () => {
  const SimpleStorageJson = JSON.parse(fs.readFileSync('contracts/build/SimpleStorage.json').toString())
  const SimpleStorageFactory = new ContractFactory(SimpleStorageJson.abi, SimpleStorageJson.bytecode, l2Wallet)
  const dummy = await SimpleStorageFactory.deploy()
  await dummy.deployTransaction.wait()
  return SimpleStorageFactory.deploy()
}

const deposit = async (amount, value) => {
  const L1Messenger = new Contract(l1MessengerAddress, l1MessengerJSON, l1Wallet)
  const calldata = SimpleStorage.interface.encodeFunctionData('setValue', [value])
  const l1ToL2Tx = await L1Messenger.sendMessage(
    SimpleStorage.address,
    calldata,
    5000000,
    { gasLimit: 7000000 }
  )
  await l1ToL2Tx.wait()
  const [msgHash] = await watcher.getMessageHashesFromL1Tx(l1ToL2Tx.hash)
  const receipt = await watcher.getL2TransactionReceipt(msgHash)
}

describe('Messages', async () => {
  before(async () => {
    const web3 = new Web3Provider(
      ganache.provider({
        mnemonic: Config.Mnemonic(),
      })
    )
  })

  it('should initialize the watcher', async () => {
    watcher = await initWatcher()
  })

  it('should deploy the simple storage contract', async () => {
    SimpleStorage = await deploySimpleStorage()
  })

  it('should deposit from L1->L2', async () => {
    const value = `0x${'42'.repeat(32)}`
    await deposit(1, value)
    const msgSender = await SimpleStorage.msgSender()
    const l1ToL2Sender = await SimpleStorage.l1ToL2Sender()
    const storageVal = await SimpleStorage.value()
    const count = await SimpleStorage.totalCount()

    msgSender.should.be.eq(l2MessengerAddress)
    l1ToL2Sender.should.be.eq(l1Wallet.address)
    storageVal.should.be.eq(value)
    count.toNumber().should.be.eq(1)
  })
})
