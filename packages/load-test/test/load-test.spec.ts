/**
 * Copyright 2020, Optimism PBC
 * MIT License
 * https://github.com/ethereum-optimism
 */

import { Config, sleep, poll, getL1Provider } from '../../../common'
import {
  deploySpamContracts,
  spamL1Deposits,
  spamL2Txs,
  verifyL1Deposits,
  verifyL2Deposits,
  verifyL2Txs,
} from '../helpers'
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
const AddressManager = new Contract(
  addressManagerAddress,
  addressManagerInterface,
  l1Provider
)

describe('Deposit Load Test', async () => {
  const numDepositsToSend = 10
  const numTxsToSend = 15
  let l2DepositTracker
  let l1DepositInitiator
  let ctcAddress
  let l2TxStorage

  before(async () => {
    ({ l2DepositTracker, l1DepositInitiator, l2TxStorage } = await deploySpamContracts(
      l1Wallet,
      l2Wallet,
      L2_DEPOSIT_TRACKER_ADDRESS,
      L1_DEPOSIT_INITIATOR_ADDRESS,
      L2_TX_STORAGE_ADDRESS
    ))
    ctcAddress = await AddressManager.getAddress(
      'OVM_CanonicalTransactionChain'
    )
    console.log('L1 CTC address:', ctcAddress)
  })

  it('should perform deposits and L2 transactions', async () => {
    const tasks = [
      spamL1Deposits(
        l1DepositInitiator,
        ctcAddress,
        l2DepositTracker.address,
        numDepositsToSend,
        l1Wallet
      ),
      spamL2Txs(l2TxStorage, numTxsToSend, l2Wallet),
    ]
    await Promise.all(tasks)
    console.log('done sending txs, sleeping for 2 minutes...')
    await sleep(1000 * 60 * 2)
  }).timeout(0)

  it('should perform deposits and L2 transactions', async () => {
    const actualIndexes = await verifyL1Deposits(
      l1DepositInitiator,
      l1Wallet.address
    )
    await verifyL2Deposits(
      l1DepositInitiator,
      l2DepositTracker,
      l1Wallet.address,
      actualIndexes
    )
    await verifyL2Txs(l2TxStorage)
  }).timeout(0)
})
