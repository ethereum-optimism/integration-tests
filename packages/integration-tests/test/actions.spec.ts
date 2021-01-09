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
import l1SimnpleStorageJson = require('../../../contracts/build/L1SimpleStorage.json')
import erc20Json = require('../../../contracts/build/ERC20.json')

import {
  Contract, ContractFactory, providers, Wallet,
} from 'ethers'

let erc20
// TODO: Change simpleStorage back to let simpleStorage
const simpleStorage = null
let l1SimpleStorage
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
const l1MessengerJSON = getContractInterface('iOVM_BaseCrossDomainMessenger')
const l2MessengerJSON = getContractFactory('OVM_L2CrossDomainMessenger')

const addressManagerAddress = Config.AddressResolverAddress()
const addressManagerInterface = getContractInterface('Lib_AddressManager')
const AddressManager = new Contract(addressManagerAddress, addressManagerInterface, l1Provider)
const simpleStorageFactory = new ContractFactory(
  simpleStorageJson.abi, simpleStorageJson.bytecode, l2Wallet
)
const l1SimpleStorageFactory = new ContractFactory(
  l1SimnpleStorageJson.abi, l1SimnpleStorageJson.bytecode, l1Wallet
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
  const L2Messenger = new Contract(l2MessengerAddress, l2MessengerJSON.interface, l2Wallet)
  const calldata = l1SimpleStorage.interface.encodeFunctionData('setValue', [value])
  const l2ToL1Tx = await L2Messenger.sendMessage(
    l1SimpleStorage.address,
    calldata,
    5000000,
    { gasLimit: 7000000 }
  )
  await l2ToL1Tx.wait()
  const [msgHash] = await watcher.getMessageHashesFromL2Tx(l2ToL1Tx.hash)
  const receipt = await watcher.getL1TransactionReceipt(msgHash)
}

describe('SimpleStorage', async () => {
  before(async () => {
    watcher = await initWatcher()
    // TODO: Currently observing some unexpected behavior given
    // multiple contracts deployed.
    // There are two contracts at the moment. One used by deposit (SimpleStorage)
    // and another used by withdrawal (L1SimpleStorage)
    // These are almost identical, but SimpleStorage has a variable l1ToL2Sender
    // and L1SimpleStorage has the variable l2ToL1Sender
    // These should be consolidated into one contract and these variables should be
    // abstracted in naming to just xDomainSender.
    // With that said, there is another issue in that the contract will have to be deployed
    // twice given two factories via ContractFactory from the ethersjs library
    // (Using l2Wallet for the simpleStorageFactory and l1Wallet for the l1SimpleStorageFactory)
    // For additional clarity all instances of SimpleStorage that are for L2 should be renamed
    // such as l2SimpleStorage.
    // The problem experienced at the moment is that when both of these contracts are deployed via
    // their factories they appear to be interfering with each other
    // For example if a deposit from L1->L2 is called before withdraw, the withdraw function
    // ends up breaking and hanging and an error message is output from the message relayer with
    // the following: `VM Exception while processing transaction: revert Invalid inclusion proof`
    // More research is necessary to determine the cause of this error and will be the focus for
    // upcoming commits.
    // To reproduce the issue, first run `docker-compose pull`, then start the system with `./up.sh`
    // Run the integration tests from within the integration-tests repo using the command
    // `yarn test:integration-tests`.
    // You can enable and disable each contract deployment with the lines directly deploy
    // You can enable a set of tests by using the .only modifier on the mocha test or
    // disable specific tests using the .skip modifier

    // simpleStorage = await simpleStorageFactory.deploy()
    // await simpleStorage.deployTransaction.wait()
    l1SimpleStorage = await l1SimpleStorageFactory.deploy()
    await l1SimpleStorage.deployTransaction.wait()
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

describe('ERC20', async () => {
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
