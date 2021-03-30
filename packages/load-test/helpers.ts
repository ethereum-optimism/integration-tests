import { sleep } from '../../common'
import { expect } from 'chai'
/* External Imports */
import { deployContract } from 'ethereum-waffle'
import L2DepositTracker = require('../../contracts/build-ovm/L2DepositTracker.json')
import L1DepositInitiator = require('../../contracts/build/L1DepositInitiator.json')
import L2TxStorage = require('../../contracts/build-ovm/L2TxStorage.json')
import { Contract } from '@ethersproject/contracts'
import { Wallet } from '@ethersproject/wallet'
import { Logger } from '@eth-optimism/core-utils'

export const deployLoadTestContracts = async (
  l1Wallet: Wallet,
  l2Wallet: Wallet,
  logger: Logger,
  L2_DEPOSIT_TRACKER_ADDRESS?: string,
  L1_DEPOSIT_INITIATOR_ADDRESS?: string,
  L2_TX_STORAGE_ADDRESS?: string
) => {
  let l2DepositTracker
  let l1DepositInitiator
  let l2TxStorage
  logger.info(`connected to L2 wallet at: ${l2Wallet.address}`)
  logger.info(`connected to L1 wallet at: ${l1Wallet.address}`)
  if (!L2_DEPOSIT_TRACKER_ADDRESS) {
    l2DepositTracker = await deployContract(l2Wallet, L2DepositTracker)
    logger.info(`l2DepositTracker address on L2: ${l2DepositTracker.address}`)
  } else {
    l2DepositTracker = new Contract(
      L2_DEPOSIT_TRACKER_ADDRESS,
      L2DepositTracker.abi,
      l2Wallet.provider
    )
    logger.info(
      `connecting to existing l2DepositTracker at ${L2_DEPOSIT_TRACKER_ADDRESS}`
    )
  }
  if (!L1_DEPOSIT_INITIATOR_ADDRESS) {
    l1DepositInitiator = await deployContract(l1Wallet, L1DepositInitiator)
    logger.info(
      `l1DepositInitiator address on L1: ${l1DepositInitiator.address}`
    )
  } else {
    l1DepositInitiator = new Contract(
      L1_DEPOSIT_INITIATOR_ADDRESS,
      L1DepositInitiator.abi,
      l1Wallet.provider
    )
    logger.info(
      `connecting to existing l1DepositInitiator at ${L1_DEPOSIT_INITIATOR_ADDRESS}`
    )
  }
  if (!L2_TX_STORAGE_ADDRESS) {
    l2TxStorage = await deployContract(l2Wallet, L2TxStorage)
    logger.info(`l2TxStorage address on L2: ${l2TxStorage.address}`)
  } else {
    l2TxStorage = new Contract(
      L2_TX_STORAGE_ADDRESS,
      L2TxStorage.abi,
      l2Wallet.provider
    )
    logger.info(
      `connecting to existing l2TxStorage at ${L2_TX_STORAGE_ADDRESS}`
    )
  }
  expect(
    (await l2Wallet.provider.getCode(l2TxStorage.address)).length > 2,
    'no L2 Tx storage code stored'
  )
  return {
    l2TxStorage,
    l2DepositTracker,
    l1DepositInitiator,
  }
}

export const spamL1Deposits = async (
  l1DepositInitiator,
  ctcAddress,
  l2DepositTrackerAddress,
  numTxsToSend,
  wallet,
  logger: Logger
) => {
  logger.info(`sending ${numTxsToSend} l1->l2 messages`)
  const numDeposits = (await l1DepositInitiator.numDeposits()).toNumber()
  for (let i = numDeposits; i < numDeposits + numTxsToSend; i++) {
    while (true) {
      try {
        const tx = await l1DepositInitiator
          .connect(wallet)
          .initiateDeposit(i, ctcAddress, l2DepositTrackerAddress)
        logger.info(`sent deposit ${i} - ${tx.hash}`)
        await tx.wait()
        break
      } catch (error) {
        i
        console.error('error sending deposit', i, 'retrying in 5 seconds')
        await sleep(5000)
      }
    }
  }
}

export const spamL2Txs = async (
  l2TxStorage,
  numTxsToSend,
  wallet,
  logger: Logger
) => {
  const numTxs = (await l2TxStorage.numTxs()).toNumber()
  logger.info(`sending ${numTxsToSend} l2 transactions`)
  for (let i = numTxs; i < numTxs + numTxsToSend; i++) {
    while (true) {
      try {
        const tx = await l2TxStorage
          .connect(wallet)
          .sendTx(i, Math.round(Date.now() / 1000))
        await tx.wait()
        logger.info(`sent tx ${i} - ${tx.hash}`)
        break
      } catch (error) {
        logger.error(`error sending tx ${i} retrying in 1 second`)
        await sleep(1000)
      }
    }
  }
}

export const verifyL2Txs = async (l2TxStorage, logger: Logger) => {
  const numTxs = (await l2TxStorage.numTxs()).toNumber()
  logger.info(`found ${numTxs} txs`)
  for (let i = 0; i < numTxs; i++) {
    const getTx = await l2TxStorage.l2Txs(i)
    expect(getTx.txIndex.toNumber()).to.equal(
      i,
      'tx sent index does not match received index in storage'
    )
    const receivedTime = getTx.timestampReceived.toNumber()
    const sentTime = getTx.realWorldTimeSent.toNumber()
    if (sentTime > receivedTime) {
      logger.info(
        `received tx ${i}: ${sentTime - receivedTime} seconds in the past`
      )
    } else {
      logger.info(`received tx ${i} after ${receivedTime - sentTime} seconds`)
    }
  }
}

export const verifyL2Deposits = async (
  l1DepositInitiator,
  l2DepositTracker,
  walletAddress,
  actualIndexes,
  logger: Logger
) => {
  const numInitiatedDeposits = (
    await l1DepositInitiator.numDeposits()
  ).toNumber()
  const numDeposits = (await l2DepositTracker.numDeposits()).toNumber()

  logger.info('found', numDeposits, 'completed deposits')
  for (let i = 0; i < numDeposits; i++) {
    const deposit = await l2DepositTracker.l2Deposits(i)
    expect(deposit.depositerAddress).to.equal(
      walletAddress,
      'Received Depositer Address does not match up'
    )
    const receivedTime = deposit.receivedTimestamp.toNumber()
    const sentTime = deposit.initiatedTimestamp.toNumber()
    logger.info(
      `deposit ${i} received after ${receivedTime - sentTime} seconds`
    )
    expect(deposit.depositIndex.toNumber()).to.equal(
      actualIndexes[i],
      'Received Deposit index does not match up to array index'
    )
  }
}

export const verifyL1Deposits = async (
  l1DepositInitiator,
  walletAddress,
  logger: Logger
) => {
  const numDeposits = (await l1DepositInitiator.numDeposits()).toNumber()
  logger.info(`found ${numDeposits} initiated deposits`)
  const actualIndexes = []
  for (let i = 0; i < numDeposits; i++) {
    const deposit = await l1DepositInitiator.l1Deposits(i)
    expect(deposit.depositerAddress).to.equal(
      walletAddress,
      'Sent Depositer Address does not match up'
    )
    if (deposit.depositIndex.toNumber() !== i) {
      logger.error(
        `Sent Deposit index ${deposit.depositIndex.toNumber()} does not match up to array index ${i}`
      )
    }
    actualIndexes.push(deposit.depositIndex.toNumber())
    expect(deposit.depositIndex.toNumber()).to.equal(
      i,
      'Sent Deposit index does not match up to array index'
    )
    logger.info(`deposit ${i} initiated successfully`)
  }
  return actualIndexes
}
