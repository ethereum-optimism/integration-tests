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
const l1MessengerInterface = getContractInterface('iAbs_BaseCrossDomainMessenger')
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
  const l1Messenger = new Contract(l1MessengerAddress, l1MessengerInterface, l1Wallet)
  const calldata = l2SimpleStorage.interface.encodeFunctionData('setValue', [value])
  const l1ToL2Tx = await l1Messenger.sendMessage(
    l2SimpleStorage.address,
    calldata,
    5000000,
    { gasLimit: 7000000 }
  )
  await l1ToL2Tx.wait()
  const [msgHash] = await watcher.getMessageHashesFromL1Tx(l1ToL2Tx.hash)
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
    const xDomainSender = await l1SimpleStorage.xDomainSender()
    const storageVal = await l1SimpleStorage.value()
    const count = await l1SimpleStorage.totalCount()

    msgSender.should.be.eq(l1MessengerAddress)
    xDomainSender.should.be.eq(l2Wallet.address)
    storageVal.should.be.eq(value)
    count.toNumber().should.be.eq(1)
  })
})

describe('L2 SimpleStorage', async () => {
  before(async () => {
    watcher = await initWatcher()
    l2SimpleStorage = await l2SimpleStorageFactory.deploy()
    await l2SimpleStorage.deployTransaction.wait()
  })

  it('should deposit from L1->L2', async () => {
    const value = `0x${'42'.repeat(32)}`
    await deposit(1, value)
    const msgSender = await l2SimpleStorage.msgSender()
    const xDomainSender = await l2SimpleStorage.xDomainSender()
    const storageVal = await l2SimpleStorage.value()
    const count = await l2SimpleStorage.totalCount()

    msgSender.should.be.eq(l2MessengerAddress)
    xDomainSender.should.be.eq(l1Wallet.address)
    storageVal.should.be.eq(value)
    count.toNumber().should.be.eq(1)
  })
})

describe('ERC20', async () => {
  const alice = new Wallet(SEQUENCER_PRIVATE_KEY, l2Provider)
  const initialAmount = 1000
  const tokenName = 'OVM Test'
  const tokenDecimals = 8
  const TokenSymbol = 'OVM'

  before(async () => {
    erc20 = await ERC20Factory.deploy(
      initialAmount, tokenName, tokenDecimals, TokenSymbol
    )
  })

  it('should set the total supply', async () => {
    const totalSupply = await erc20.totalSupply()
    expect(totalSupply.toNumber()).to.equal(initialAmount)
  })

  it('should get the token name', async () => {
    const name = await erc20.name()
    expect(name).to.equal(tokenName)
  })

  it('should get the token decimals', async () => {
    const decimals = await erc20.decimals()
    expect(decimals).to.equal(tokenDecimals)
  })

  it('should get the token symbol', async () => {
    const symbol = await erc20.symbol()
    expect(symbol).to.equal(TokenSymbol)
  })

  it('should assign initial balance', async () => {
    const balance = await erc20.balanceOf(l2Wallet.address)
    expect(balance.toNumber()).to.equal(initialAmount)
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

describe.only('Deposit Load Test', async () => {
  const numDepositsToSend = 10
  const numTxsToSend = 150
  let l2DepositTracker
  let l1DepositInitiator
  let ctcAddress
  let l2TxStorage
  const spamL1Deposits = async (numTxsToSend, wallet) => {
    const numDeposits = (await l1DepositInitiator.numDeposits()).toNumber()
    for (let i=numDeposits; i < numDeposits+numTxsToSend; i++) {
      while (true) {
        try {
          const tx = await l1DepositInitiator.connect(wallet).initiateDeposit(
            i,
            ctcAddress,
            l2DepositTracker.address
          )
          console.log('sent deposit', i, tx.hash)
          await tx.wait()
          break
        } catch (error) {i
          console.error('error sending deposit', i, 'retrying in 5 seconds')
          await sleep(5000)
        }
      }
    }
  }

  const spamL2Txs = async (numTxsToSend, wallet) => {
    const numTxs = (await l2TxStorage.numTxs()).toNumber()
    for (let i=numTxs; i < numTxs + numTxsToSend; i++) {
      while (true) {
        try {
          const tx = await l2TxStorage.connect(wallet).sendTx(i, Math.round(Date.now() / 1000))
          console.log('sent tx', i, tx.hash)
          break
        } catch (error) {
          console.error('error sending tx', i, 'retrying in 1 second')
          await sleep(1000)
        }
      }
    }
  }

  const verifyL2Txs = async () => {
    const numTxs = (await l2TxStorage.numTxs()).toNumber()
    console.log('found', numTxs, 'txs')
    for (let i=0; i < numTxs; i++) {
      const getTx = await l2TxStorage.l2Txs(i)
      expect(getTx.txIndex.toNumber()).to.equal(i, 'tx sent index does not received index in storage')
      const receivedTime = getTx.timestampReceived.toNumber()
      const sentTime = getTx.realWorldTimeSent.toNumber()
      if(sentTime > receivedTime) {
        console.log(`received tx ${i}: ${sentTime - receivedTime} seconds in the past`)
      } else {
        console.log(`received tx ${i} after `, receivedTime - sentTime, 'seconds')
      }
    }
  }
  const verifyL2Deposits = async (actualIndexes) => {
    const numInitiatedDeposits = (await l1DepositInitiator.numDeposits()).toNumber()
    const numDeposits = (await l2DepositTracker.numDeposits()).toNumber()
    //expect(numDeposits).to.equal(numInitiatedDeposits, 'Not all initiated deposits have been received...')

    console.log('found', numDeposits, 'completed deposits')
    for (let i=0; i < numDeposits; i++) {
      const deposit = await l2DepositTracker.l2Deposits(i)
      expect(deposit.depositerAddress).to.equal(l2Wallet.address, 'Received Depositer Address does not match up')
      const receivedTime = deposit.receivedTimestamp.toNumber()
      const sentTime = deposit.initiatedTimestamp.toNumber()
      console.log(`deposit ${i} received after ${receivedTime - sentTime} seconds`)
      expect(deposit.depositIndex.toNumber()).to.equal(actualIndexes[i], 'Received Deposit index does not match up to array index')
    }
  }

  const verifyL1Deposits = async () => {
    const numDeposits = (await l1DepositInitiator.numDeposits()).toNumber()
    console.log('found', numDeposits, ' initiated deposits')
    const actualIndexes = []
    for (let i=0; i < numDeposits; i++) {
      const deposit = await l1DepositInitiator.l1Deposits(i)
      expect(deposit.depositerAddress).to.equal(l2Wallet.address, 'Sent Depositer Address does not match up')
      if(deposit.depositIndex.toNumber() !== i) {
        console.error(`Sent Deposit index ${deposit.depositIndex.toNumber()} does not match up to array index ${i}`)
      }
      actualIndexes.push(deposit.depositIndex.toNumber())
      // expect(deposit.depositIndex.toNumber()).to.equal(i, 'Sent Deposit index does not match up to array index')
      console.log('deposit', i, 'initiated successfully')
    }
    return actualIndexes
  }

  before(async () => {
    console.log('connected to L2 wallet at:', l2Wallet.address)
    console.log('connected to L1 wallet at:', l1Wallet.address)
    if (!L2_DEPOSIT_TRACKER_ADDRESS) {
      l2DepositTracker = await deployContract(l2Wallet, L2DepositTracker)
      console.log('l2DepositTracker address on L2:', l2DepositTracker.address)
    } else {
      l2DepositTracker = new Contract(L2_DEPOSIT_TRACKER_ADDRESS, L2DepositTracker.abi, l2Provider)
      console.log('connecting to existing l2DepositTracker at', L2_DEPOSIT_TRACKER_ADDRESS)
    }
    if (!L1_DEPOSIT_INITIATOR_ADDRESS) {
      l1DepositInitiator = await deployContract(l1Wallet, L1DepositInitiator)
      console.log('l1DepositInitiator address on L1:', l1DepositInitiator.address)
    } else {
      l1DepositInitiator = new Contract(L1_DEPOSIT_INITIATOR_ADDRESS, L1DepositInitiator.abi, l1Provider)
      console.log('connecting to existing l1DepositInitiator at', L1_DEPOSIT_INITIATOR_ADDRESS)
    }
    if (!L2_TX_STORAGE_ADDRESS) {
      l2TxStorage = await deployContract(l2Wallet, L2TxStorage)
      console.log('l2TxStorage address on L2:', l2TxStorage.address)
    } else {
      l2TxStorage = new Contract(L2_TX_STORAGE_ADDRESS, L2TxStorage.abi, l2Provider)
      console.log('connecting to existing l2TxStorage at', L2_TX_STORAGE_ADDRESS)
    }
    assert((await l2Provider.getCode(l2TxStorage.address)).length > 2, 'no L2 Tx storage code stored')
    ctcAddress = await AddressManager.getAddress('OVM_CanonicalTransactionChain')
    console.log('L1 CTC address:', ctcAddress)
  })

  it('should perform deposits and L2 transactions', async () => {
    const tasks = [
      spamL1Deposits(numDepositsToSend, l1Wallet),
      spamL2Txs(numTxsToSend, l2Wallet)
    ]
    await Promise.all(tasks)
    console.log('done sending txs, sleeping for 2 minutes...')
    await sleep(1000 * 60 * 2)
  }).timeout(0)

  it.only('should perform deposits and L2 transactions', async () => {
    const actualIndexes = await verifyL1Deposits()
    await verifyL2Deposits(actualIndexes)
    await verifyL2Txs()
  }).timeout(0)
})
