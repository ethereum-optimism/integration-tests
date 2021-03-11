import { sleep } from '../../common'
import { expect } from 'chai'

export const spamL1Deposits = async (
  l1DepositInitiator,
  ctcAddress,
  l2DepositTrackerAddress,
  numTxsToSend,
  wallet
) => {
  const numDeposits = (await l1DepositInitiator.numDeposits()).toNumber()
  for (let i = numDeposits; i < numDeposits + numTxsToSend; i++) {
    while (true) {
      try {
        const tx = await l1DepositInitiator
          .connect(wallet)
          .initiateDeposit(i, ctcAddress, l2DepositTrackerAddress)
        console.log('sent deposit', i, tx.hash)
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

export const spamL2Txs = async (l2TxStorage, numTxsToSend, wallet) => {
  const numTxs = (await l2TxStorage.numTxs()).toNumber()
  for (let i = numTxs; i < numTxs + numTxsToSend; i++) {
    while (true) {
      try {
        const tx = await l2TxStorage
          .connect(wallet)
          .sendTx(i, Math.round(Date.now() / 1000))
        console.log('sent tx', i, tx.hash)
        break
      } catch (error) {
        console.error('error sending tx', i, 'retrying in 1 second')
        await sleep(1000)
      }
    }
  }
}

export const verifyL2Txs = async (l2TxStorage) => {
  const numTxs = (await l2TxStorage.numTxs()).toNumber()
  console.log('found', numTxs, 'txs')
  for (let i = 0; i < numTxs; i++) {
    const getTx = await l2TxStorage.l2Txs(i)
    expect(getTx.txIndex.toNumber()).to.equal(
      i,
      'tx sent index does not received index in storage'
    )
    const receivedTime = getTx.timestampReceived.toNumber()
    const sentTime = getTx.realWorldTimeSent.toNumber()
    if (sentTime > receivedTime) {
      console.log(
        `received tx ${i}: ${sentTime - receivedTime} seconds in the past`
      )
    } else {
      console.log(`received tx ${i} after `, receivedTime - sentTime, 'seconds')
    }
  }
}

export const verifyL2Deposits = async (
  l1DepositInitiator,
  l2DepositTracker,
  walletAddress,
  actualIndexes
) => {
  const numInitiatedDeposits = (
    await l1DepositInitiator.numDeposits()
  ).toNumber()
  const numDeposits = (await l2DepositTracker.numDeposits()).toNumber()
  //expect(numDeposits).to.equal(numInitiatedDeposits, 'Not all initiated deposits have been received...')

  console.log('found', numDeposits, 'completed deposits')
  for (let i = 0; i < numDeposits; i++) {
    const deposit = await l2DepositTracker.l2Deposits(i)
    expect(deposit.depositerAddress).to.equal(
      walletAddress,
      'Received Depositer Address does not match up'
    )
    const receivedTime = deposit.receivedTimestamp.toNumber()
    const sentTime = deposit.initiatedTimestamp.toNumber()
    console.log(
      `deposit ${i} received after ${receivedTime - sentTime} seconds`
    )
    expect(deposit.depositIndex.toNumber()).to.equal(
      actualIndexes[i],
      'Received Deposit index does not match up to array index'
    )
  }
}

export const verifyL1Deposits = async (l1DepositInitiator, walletAddress) => {
  const numDeposits = (await l1DepositInitiator.numDeposits()).toNumber()
  console.log('found', numDeposits, ' initiated deposits')
  const actualIndexes = []
  for (let i = 0; i < numDeposits; i++) {
    const deposit = await l1DepositInitiator.l1Deposits(i)
    expect(deposit.depositerAddress).to.equal(
      walletAddress,
      'Sent Depositer Address does not match up'
    )
    if (deposit.depositIndex.toNumber() !== i) {
      console.error(
        `Sent Deposit index ${deposit.depositIndex.toNumber()} does not match up to array index ${i}`
      )
    }
    actualIndexes.push(deposit.depositIndex.toNumber())
    // expect(deposit.depositIndex.toNumber()).to.equal(i, 'Sent Deposit index does not match up to array index')
    console.log('deposit', i, 'initiated successfully')
  }
  return actualIndexes
}
