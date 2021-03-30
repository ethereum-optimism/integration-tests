/**
 * Copyright 2020, Optimism PBC
 * MIT License
 * https://github.com/ethereum-optimism
 */

import { Config, sleep } from '../../../common'

import { JsonRpcProvider } from '@ethersproject/providers'
import { Wallet } from '@ethersproject/wallet'
import { Contract } from '@ethersproject/contracts'
import { add0x, Logger } from '@eth-optimism/core-utils'
import { getContractFactory } from '@eth-optimism/contracts'
import { L1DataTransportClient } from '@eth-optimism/data-transport-layer'
import {
  deployLoadTestContracts,
  spamL1Deposits,
  spamL2Txs,
  verifyL1Deposits,
  verifyL2Deposits,
  verifyL2Txs,
} from '../../load-test/helpers'
import { solidity } from 'ethereum-waffle'
import chai = require('chai')

chai.use(solidity)
const expect = chai.expect

describe('CTC upgrade', () => {
  let l1Provider: JsonRpcProvider
  let l1Signer: Wallet
  let l2Signer: Wallet
  let l2Provider: JsonRpcProvider
  let addressResolver: Contract
  const dtlClient = new L1DataTransportClient('http://localhost:7878')
  const logger = new Logger({ name: 'ctc-upgrade' })

  let newCanonicalTransactionChain: Contract
  let ctcAddress: string

  const FORCE_INCLUSION_PERIOD_SECONDS = 2592000 // 30 days
  const FORCE_INCLUSION_PERIOD_BLOCKS = Math.floor(2592000 / 13) //30 days of blocks
  const MAX_GAS_LIMIT = 8_000_000
  const NUM_TXS_TO_SEND = 15
  const NUM_DEPOSITS_TO_SEND = 10

  let l2DepositTracker: Contract
  let l1DepositInitiator: Contract
  let l2TxStorage: Contract
  let startingDTLTxIndex: number
  let startingNumElements: number
  let startingNumQueued: number

  before(async () => {
    l1Provider = new JsonRpcProvider(Config.L1NodeUrlWithPort())
    l2Provider = new JsonRpcProvider(Config.L2NodeUrlWithPort())
    l1Signer = new Wallet(Config.DeployerPrivateKey()).connect(l1Provider)
    l2Signer = new Wallet(Config.DeployerPrivateKey()).connect(l2Provider)

    const addressResolverAddress = add0x(Config.AddressResolverAddress())
    const AddressResolverFactory = getContractFactory('Lib_AddressManager')
    addressResolver = AddressResolverFactory.connect(l1Signer).attach(
      addressResolverAddress
    )

    ctcAddress = await addressResolver.getAddress(
      'OVM_CanonicalTransactionChain'
    )
    logger.info(
      `connected to existing CanonicalTransactionChain at ${ctcAddress}`
    )

    const CanonicalTransactionChainFactory = getContractFactory(
      'OVM_CanonicalTransactionChain'
    ).connect(l1Signer)

    newCanonicalTransactionChain = await CanonicalTransactionChainFactory.deploy(
      addressResolverAddress,
      FORCE_INCLUSION_PERIOD_SECONDS,
      FORCE_INCLUSION_PERIOD_BLOCKS,
      MAX_GAS_LIMIT
    )
    ;({
      l2DepositTracker,
      l1DepositInitiator,
      l2TxStorage,
    } = await deployLoadTestContracts(l1Signer, l2Signer, logger))
    logger.info('deployed all contracts, sleeping for 30 seconds')
    await sleep(1000 * 30)
    const latestDTLTx = await dtlClient.getLatestTransacton()
    startingDTLTxIndex = latestDTLTx.transaction.index
    logger.info(`starting dtl tx index: ${startingDTLTxIndex}`)
    startingNumElements = (
      await newCanonicalTransactionChain.getTotalElements()
    ).toNumber()
    startingNumQueued = await newCanonicalTransactionChain.getQueueLength()
  })

  // The transactions are enqueue'd with a `to` address of i.repeat(40)
  // meaning that the `to` value is different each iteration in a deterministic
  // way. They need to be inserted into the L2 chain in an ascending order.
  // Keep track of the receipts so that the blockNumber can be compared
  // against the `L1BlockNumber` on the tx objects.
  it('should perform deposits and L2 transactions', async () => {
    const tasks = [
      spamL1Deposits(
        l1DepositInitiator,
        ctcAddress,
        l2DepositTracker.address,
        NUM_DEPOSITS_TO_SEND,
        l1Signer,
        logger
      ),
      spamL2Txs(l2TxStorage, NUM_TXS_TO_SEND, l2Signer, logger),
    ]
    await Promise.all(tasks)
  }).timeout(0)

  it('should revert when trying to enqueue to new CTC', async () => {
    await expect(
      l1DepositInitiator
        .connect(l1Signer)
        .initiateDeposit(
          100,
          newCanonicalTransactionChain.address,
          l2DepositTracker.address
        )
    ).to.be.revertedWith(
      'OVM_ChainStorageContainer: Function can only be called by the owner.'
    )
  }).timeout(0)

  describe('Switching over CTC', async () => {
    before(async () => {
      await addressResolver.setAddress(
        'OVM_CanonicalTransactionChain',
        newCanonicalTransactionChain.address
      )
      const newCTCAddress = await addressResolver.getAddress(
        'OVM_CanonicalTransactionChain'
      )
      logger.info(`deployed new CanonicalTransactionChain to ${newCTCAddress}`)
      expect(newCTCAddress).to.equal(newCanonicalTransactionChain.address)
    })

    it('should perform deposits and L2 transactions on new CTC', async () => {
      const tasks = [
        spamL1Deposits(
          l1DepositInitiator,
          newCanonicalTransactionChain.address,
          l2DepositTracker.address,
          NUM_DEPOSITS_TO_SEND,
          l1Signer,
          logger
        ),
        spamL2Txs(l2TxStorage, NUM_TXS_TO_SEND, l2Signer, logger),
      ]
      await Promise.all(tasks)
      logger.info('done sending txs, sleeping for 30 seconds...')
      await sleep(1000 * 30)
    }).timeout(0)

    it('should verify deposits and L2 transactions', async () => {
      const actualIndexes = await verifyL1Deposits(
        l1DepositInitiator,
        l1Signer.address,
        logger
      )
      await verifyL2Deposits(
        l1DepositInitiator,
        l2DepositTracker,
        l1Signer.address,
        actualIndexes,
        logger
      )
      await verifyL2Txs(l2TxStorage, logger)
    }).timeout(0)

    it('should have batch submitted all transactions', async () => {
      const numElements = await newCanonicalTransactionChain.getTotalElements()
      const numQueued = await newCanonicalTransactionChain.getQueueLength()
      const expectedNumElements =
        startingNumElements + (NUM_DEPOSITS_TO_SEND + NUM_TXS_TO_SEND) * 2
      expect(numElements.toNumber()).to.equal(expectedNumElements)
      const expectedNumQueued = startingNumQueued + NUM_DEPOSITS_TO_SEND * 2
      expect(numQueued).to.equal(expectedNumQueued)
    }).timeout(0)

    it('should have picked up all transactions in DTL', async () => {
      const latestDTLTx = await dtlClient.getLatestTransacton()
      const expectedDTLIndex =
        startingDTLTxIndex + (NUM_DEPOSITS_TO_SEND + NUM_TXS_TO_SEND) * 2
      expect(latestDTLTx.transaction.index).to.equal(expectedDTLIndex)
    }).timeout(0)

    it('should revert when trying to enqueue to old CTC', async () => {
      await expect(
        l1DepositInitiator
          .connect(l1Signer)
          .initiateDeposit(100, ctcAddress, l2DepositTracker.address)
      ).to.be.revertedWith(
        'OVM_ChainStorageContainer: Function can only be called by the owner.'
      )
    }).timeout(0)
  })
})
