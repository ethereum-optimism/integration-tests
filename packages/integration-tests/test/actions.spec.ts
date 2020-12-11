import * as fs from 'fs';
import { Config, sleep, etherbase } from '../../../common'
import { Watcher } from '@eth-optimism/watcher'
import { ganache } from '@eth-optimism/ovm-toolchain'
import { getContractInterface, getContractFactory } from '@eth-optimism/contracts'
import { JsonRpcProvider, Web3Provider } from '@ethersproject/providers'
import { OptimismProvider } from '@eth-optimism/provider'
import assert = require('assert')

import {
  Contract, ContractFactory, providers, Wallet,
} from 'ethers';

let ERC20
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

const deployERC20 = async () => {
  const ERC20Json = JSON.parse(fs.readFileSync('contracts/build/ERC20.json').toString())
  const ERC20Factory = new ContractFactory(ERC20Json.abi, ERC20Json.bytecode, l2Wallet)
  const dummy = await ERC20Factory.deploy()
  await dummy.deployTransaction.wait()
  return ERC20Factory.deploy()
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

const withdraw = async (value) => {
  const L2Messenger = new Contract(l2MessengerAddress, l2MessengerJSON, l2Wallet)
  const calldata = SimpleStorage.interface.encodeFunctionData('setValue', [value])
  const l2ToL1Tx = await L2Messenger.sendMessage(
    SimpleStorage.address,
    calldata,
    5000000,
    { gasLimit: 7000000 }
  )
  await l2Provider.waitForTransaction(l2ToL1Tx.hash)
  console.log('L2->L1 setValue tx complete: http://https://l2-explorer.surge.sh/tx/' + l2ToL1Tx.hash)
  const count = (await SimpleStorage.totalCount()).toString()
  while (true) {
    console.log('simple storage msg.sender', await SimpleStorage.msgSender())
    console.log('simple storage xDomainMessageSender', await SimpleStorage.l2ToL1Sender())
    console.log('simple storage value', await SimpleStorage.value())
    console.log('totalCount', (await SimpleStorage.totalCount()).toString())
    console.log('sleeping 1 minute...')
    await sleep(60000)
  }
}

describe('Messages', async () => {
  let optimismProvider
  let provider: JsonRpcProvider
  let token

  before(async () => {
    const web3 = new Web3Provider(
      ganache.provider({
        mnemonic: Config.Mnemonic(),
      })
    )

    optimismProvider = new OptimismProvider(Config.L2NodeUrlWithPort(), web3)
    provider = new JsonRpcProvider(Config.L2NodeUrlWithPort())
  })

  it('should initialize the watcher', async () => {
    watcher = await initWatcher()
  })

  it('should deploy the simple storage contract', async () => {
    SimpleStorage = await deploySimpleStorage()
  })

  it('should deploy the erc20 contract', async () => {
    ERC20 = await deployERC20()
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
