/**
 * Copyright 2020, Optimism PBC
 * MIT License
 * https://github.com/ethereum-optimism
 */

import { Config, sleep, poll, getL1Provider } from '../../../common'
import { expect } from 'chai'
import assert = require('assert')
import {
  Provider,
  Web3Provider,
  JsonRpcProvider,
} from '@ethersproject/providers'
import { Wallet } from '@ethersproject/wallet'
import { Contract } from '@ethersproject/contracts'

import { getContractInterface } from '@eth-optimism/contracts'
import { deployContract } from 'ethereum-waffle'
import L2DepositTracker = require('../../../contracts/build-ovm/L2DepositTracker.json')
import L1DepositInitiator = require('../../../contracts/build/L1DepositInitiator.json')
import L2TxStorage = require('../../../contracts/build-ovm/L2TxStorage.json')



const L2_DEPOSIT_TRACKER_ADDRESS = Config.L2DepositTrackerAddress()
const L1_DEPOSIT_INITIATOR_ADDRESS = Config.L1DepositIntiatorAddress()
const L2_TX_STORAGE_ADDRESS = Config.L2TxStorageAddress()
const l1Provider = new JsonRpcProvider(Config.L1NodeUrlWithPort())
const l1Wallet = new Wallet(Config.DeployerPrivateKey(), l1Provider)
const l2Provider = new JsonRpcProvider(Config.L2NodeUrlWithPort())
const l2Wallet = new Wallet(Config.DeployerPrivateKey(), l2Provider)

const addressManagerAddress = Config.AddressResolverAddress()
const addressManagerInterface = getContractInterface('Lib_AddressManager')
const AddressManager = new Contract(addressManagerAddress, addressManagerInterface, l1Provider)

describe.only('Deposit Load Test', async () => {
  const numDepositsToSend = 10
  const numTxsToSend = 15
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

  it('should perform deposits and L2 transactions', async () => {
    const actualIndexes = await verifyL1Deposits()
    await verifyL2Deposits(actualIndexes)
    await verifyL2Txs()
  }).timeout(0)
}) 