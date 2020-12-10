import { Config, sleep } from '../../../common'
import { Watcher } from '@eth-optimism/watcher'
import { ganache } from '@eth-optimism/ovm-toolchain'
import { JsonRpcProvider, Web3Provider } from '@ethersproject/providers'
import assert = require('assert')
import * as fs from 'fs';

import {
  Contract, ContractFactory, providers, Wallet,
} from 'ethers';

let SimpleStorage
const L1_USER_PRIVATE_KEY = Config.L1UserPrivateKey()
const L2_USER_PRIVATE_KEY = Config.L2UserPrivateKey()
const goerliURL = Config.L1NodeUrlWithPort()
const optimismURL = Config.L2NodeUrlWithPort()
const l1Provider = new JsonRpcProvider(goerliURL)
const l2Provider = new JsonRpcProvider(optimismURL)
const l1Wallet = new Wallet(L1_USER_PRIVATE_KEY, l1Provider)
const l2Wallet = new Wallet(L2_USER_PRIVATE_KEY, l2Provider)
const messengerJSON = JSON.parse(fs.readFileSync('contracts/build/iOVM_BaseCrossDomainMessenger.json').toString())
const l2MessengerJSON = JSON.parse(fs.readFileSync('contracts/build/OVM_L2CrossDomainMessenger.json').toString())

let watcher
const initWatcher = () => {
  return new Watcher({
    l1: {
      provider: l1Provider,
      messengerAddress: process.env.L1_MESSENGER_ADDRESS
    },
    l2: {
      provider: l2Provider,
      messengerAddress: process.env.L2_MESSENGER_ADDRESS
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
  const L1Messenger = new Contract(Config.L1MessengerAddress(), messengerJSON.abi, l1Wallet)
  const L2Messenger = new Contract(Config.L2MessengerAddress(), l2MessengerJSON.abi, l2Wallet)
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

    msgSender.should.be.eq('0x4200000000000000000000000000000000000007')
    l1ToL2Sender.should.be.eq('0x023fFdC1530468eb8c8EEbC3e38380b5bc19Cc5d')
    storageVal.should.be.eq(`0x${'42'.repeat(32)}`)
    count.toNumber().should.be.eq(1)
  })
})
