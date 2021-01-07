import * as fs from 'fs'
import { expect, use } from 'chai'
import assert = require('assert')
import { JsonRpcProvider, Web3Provider } from '@ethersproject/providers'
import { solidity } from 'ethereum-waffle'

import { Config, sleep, etherbase } from '../../../common'
import { Watcher } from '@eth-optimism/watcher'
import { ganache } from '@eth-optimism/ovm-toolchain'
import { OptimismProvider } from '@eth-optimism/provider'
import { getContractInterface, getContractFactory } from '@eth-optimism/contracts'
import simpleStorageJson = require('../../../contracts/build/SimpleStorage.json')
import SimpleStorageJson = require('../../../contracts/build/L1SimpleStorage.json')

let SimpleStorage
import erc20Json = require('../../../contracts/build/ERC20.json')

import {
  Contract, ContractFactory, providers, Wallet,
} from 'ethers'

let erc20
let simpleStorage
let l1SimpleStorage
let l1MessengerAddress
let l2MessengerAddress
let L2Messenger
const L1_USER_PRIVATE_KEY = Config.DeployerPrivateKey()
const L2_USER_PRIVATE_KEY = Config.DeployerPrivateKey()
const SEQUENCER_PRIVATE_KEY = Config.SequencerPrivateKey()
const goerliURL = Config.L1NodeUrlWithPort()
const optimismURL = Config.L2NodeUrlWithPort()
const l1Provider = new JsonRpcProvider(goerliURL)
const l2Provider = new JsonRpcProvider(optimismURL)
const l1Wallet = new Wallet(L1_USER_PRIVATE_KEY, l1Provider)
const l2Wallet = new Wallet(L2_USER_PRIVATE_KEY, l2Provider)
const l1MessengerJSON = getContractInterface('iOVM_BaseCrossDomainMessenger')
// const l2MessengerJSON = getContractFactory('OVM_L2CrossDomainMessenger')
const l2MessengerJSON = JSON.parse(fs.readFileSync('../../contracts/build/OVM_L2CrossDomainMessenger.json').toString())

L2Messenger = new Contract(process.env.L2_MESSENGER_ADDRESS, l2MessengerJSON.abi, l2Wallet)

console.log(l2MessengerJSON)
const addressManagerAddress = Config.AddressResolverAddress()
const addressManagerInterface = getContractInterface('Lib_AddressManager')
const AddressManager = new Contract(addressManagerAddress, addressManagerInterface, l1Provider)
const simpleStorageFactory = new ContractFactory(
  simpleStorageJson.abi, simpleStorageJson.bytecode, l2Wallet
)

const ERC20Factory = new ContractFactory(
  erc20Json.abi, erc20Json.bytecode, l2Wallet
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

const deposit = async (amount, value) => {
  const L1Messenger = new Contract(l1MessengerAddress, l1MessengerJSON, l1Wallet)
  const calldata = simpleStorage.interface.encodeFunctionData('setValue', [value])
  const l1ToL2Tx = await L1Messenger.sendMessage(
    simpleStorage.address,
    calldata,
    5000000,
    { gasLimit: 7000000 }
  )
  await l1ToL2Tx.wait()
  const [msgHash] = await watcher.getMessageHashesFromL1Tx(l1ToL2Tx.hash)
  const receipt = await watcher.getL2TransactionReceipt(msgHash)
}

const withdraw = async (value) => {
  const calldata = l1SimpleStorage.interface.encodeFunctionData('setValue', [`0x${'77'.repeat(32)}`])
  const l2ToL1Tx = await L2Messenger.sendMessage(
    l1SimpleStorage.address,
    calldata,
    5000000,
    { gasLimit: 7000000 }
  )
  await l2Provider.waitForTransaction(l2ToL1Tx.hash)

  console.log(l1SimpleStorage)
  console.log('L2->L1 setValue tx complete: http://https://l2-explorer.surge.sh/tx/' + l2ToL1Tx.hash)
  const count = (await l1SimpleStorage.totalCount()).toString()
  // while (true) {
  //   console.log('simple storage msg.sender', await l1SimpleStorage.msgSender())
  //   console.log('simple storage xDomainMessageSender', await l1SimpleStorage.l2ToL1Sender())
  //   console.log('simple storage value', await l1SimpleStorage.value())
  //   console.log('totalCount', (await l1SimpleStorage.totalCount()).toString())
  //   console.log('sleeping 1 minute...')
  //   await sleep(60000)
  // }
}

describe('SimpleStorage', async () => {
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
    simpleStorage = await simpleStorageFactory.deploy()
    await simpleStorage.deployTransaction.wait()
  })

  it('should deploy the l1 simple storage contract', async () => {
    const SimpleStorageFactory = new ContractFactory(SimpleStorageJson.abi, SimpleStorageJson.bytecode, l1Wallet)
    SimpleStorage = await SimpleStorageFactory.deploy()
    await SimpleStorage.deployTransaction.wait()
    console.log('Deployed SimpleStorage to', SimpleStorage.address)
    console.log('deployment tx: https://goerli.etherscan.io/tx/' + SimpleStorage.deployTransaction.hash)
    await sleep(3000)
  })

  it.skip('should deposit from L1->L2', async () => {
    const value = `0x${'42'.repeat(32)}`
    await deposit(1, value)
    const msgSender = await simpleStorage.msgSender()
    const l1ToL2Sender = await simpleStorage.l1ToL2Sender()
    const storageVal = await simpleStorage.value()
    const count = await simpleStorage.totalCount()

    msgSender.should.be.eq(l2MessengerAddress)
    l1ToL2Sender.should.be.eq(l1Wallet.address)
    storageVal.should.be.eq(value)
    count.toNumber().should.be.eq(1)
  })

  it('should withdraw from L2->L1', async () => {
    const calldata = SimpleStorage.interface.encodeFunctionData('setValue', [`0x${'77'.repeat(32)}`])
    const l2ToL1Tx = await L2Messenger.sendMessage(
      SimpleStorage.address,
      calldata,
      5000000,
      { gasLimit: 7000000 }
    )
    await l2Provider.waitForTransaction(l2ToL1Tx.hash)
    console.log('L2->L1 setValue tx complete: http://https://l2-explorer.surge.sh/tx/' + l2ToL1Tx.hash)
    const count = (await SimpleStorage.totalCount()).toString()
    console.log('simple storage msg.sender', await SimpleStorage.msgSender())
    console.log('simple storage xDomainMessageSender', await SimpleStorage.l2ToL1Sender())
    console.log('simple storage value', await SimpleStorage.value())
    console.log('totalCount', (await SimpleStorage.totalCount()).toString())
    console.log('sleeping 1 minute...')
    await sleep(60000)
  })
})

describe.skip('ERC20', async () => {
  const alice = new Wallet(SEQUENCER_PRIVATE_KEY, l2Provider)
  const INITIAL_AMOUNT = 1000
  const NAME = 'OVM Test'
  const DECIMALS = 8
  const SYMBOL = 'OVM'

  it('should deploy the erc20 contract', async () => {
    erc20 = await ERC20Factory.deploy(
      INITIAL_AMOUNT, NAME, DECIMALS, SYMBOL
    )
  })

  it('should set the total supply', async () => {
    const totalSupply = await erc20.totalSupply()
    expect(totalSupply.toNumber()).to.equal(INITIAL_AMOUNT)
  })

  it('should get the token name', async () => {
    const name = await erc20.name()
    expect(name).to.equal(NAME)
  })

  it('should get the token decimals', async () => {
    const decimals = await erc20.decimals()
    expect(decimals).to.equal(DECIMALS)
  })

  it('should get the token symbol', async () => {
    const symbol = await erc20.symbol()
    expect(symbol).to.equal(SYMBOL)
  })

  it('should assign initial balance', async () => {
    const balance = await erc20.balanceOf(l2Wallet.address)
    expect(balance.toNumber()).to.equal(INITIAL_AMOUNT)
  })

  it('should transfer amount to destination account', async () => {
    const transfer = await erc20.transfer(alice.address, 100)
    const receipt = await transfer.wait()

    // There are two events from the transfer with the first being
    // the fee of value 0 and the second of the value transfered (100)
    assert.strictEqual(receipt.events.length, 2)
    const transferFeeEvent = receipt.events[0]
    const transferEvent = receipt.events[1]
    assert.strictEqual(transferEvent.args._from, l1Wallet.address);
    assert.strictEqual(transferFeeEvent.args._value.toString(), '0');
    assert.strictEqual(transferEvent.args._value.toString(), '100');
    const receiverBalance = await erc20.balanceOf(alice.address)
    expect(receiverBalance.toNumber()).to.equal(100)
    const senderBalance = await erc20.balanceOf(l2Wallet.address)
    expect(senderBalance.toNumber()).to.equal(900)
  })
})
