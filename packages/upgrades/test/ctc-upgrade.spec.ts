/**
 * Copyright 2020, Optimism PBC
 * MIT License
 * https://github.com/ethereum-optimism
 */

import { Config, sleep } from '../../../common'

import { JsonRpcProvider } from '@ethersproject/providers'
import { Wallet } from '@ethersproject/wallet'
import { Contract } from '@ethersproject/contracts'
import { add0x } from '@eth-optimism/core-utils'
import { getContractFactory } from '@eth-optimism/contracts'
// import { L1DataTransportClient } from '@eth-optimism/data-transport-layer'
import assert = require('assert')
import {
  deploySpamContracts,
  spamL1Deposits,
  spamL2Txs,
  verifyL1Deposits,
  verifyL2Deposits,
  verifyL2Txs,
} from '../../load-test/helpers'
import { expect } from 'chai'

describe('CTC upgrade', () => {
  let l1Provider: JsonRpcProvider
  let l1Signer: Wallet
  let l2Signer
  let l2Provider: JsonRpcProvider
  let addressResolver: Contract
  // const dtlClient =  new L1DataTransportClient('http://data_transport_layer:7878')

  let canonicalTransactionChain: Contract
  let newCanonicalTransactionChain: Contract
  let ctcAddress: string

  const mnemonic = Config.Mnemonic()

  const FORCE_INCLUSION_PERIOD_SECONDS = 600
  const FORCE_INCLUSION_PERIOD_BLOCKS = 600 / 12
  const MAX_GAS_LIMIT = 8_000_000
  let pre
  let l2DepositTracker
  let l1DepositInitiator
  let l2TxStorage

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
    console.log('ctc at', ctcAddress)

    const CanonicalTransactionChainFactory = getContractFactory(
      'OVM_CanonicalTransactionChain'
    ).connect(l1Signer)

    canonicalTransactionChain = CanonicalTransactionChainFactory.attach(
      ctcAddress
    )
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
    } = await deploySpamContracts(l1Signer, l2Signer))
  })

  // The transactions are enqueue'd with a `to` address of i.repeat(40)
  // meaning that the `to` value is different each iteration in a deterministic
  // way. They need to be inserted into the L2 chain in an ascending order.
  // Keep track of the receipts so that the blockNumber can be compared
  // against the `L1BlockNumber` on the tx objects.
  it('should perform deposits and L2 transactions', async () => {
    const numTxsToSend = 15
    const numDepositsToSend = 10
    const tasks = [
      spamL1Deposits(
        l1DepositInitiator,
        ctcAddress,
        l2DepositTracker.address,
        numDepositsToSend,
        l1Signer
      ),
      spamL2Txs(l2TxStorage, numTxsToSend, l2Signer),
    ]
    await Promise.all(tasks)
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
      console.log(newCTCAddress)
      expect(newCTCAddress).to.equal(newCanonicalTransactionChain.address)
    })

    it('should perform deposits and L2 transactions on new CTC', async () => {
      const numTxsToSend = 15
      const numDepositsToSend = 10
      const tasks = [
        spamL1Deposits(
          l1DepositInitiator,
          newCanonicalTransactionChain.address,
          l2DepositTracker.address,
          numDepositsToSend,
          l1Signer
        ),
        spamL2Txs(l2TxStorage, numTxsToSend, l2Signer),
      ]
      await Promise.all(tasks)
      console.log('done sending txs, sleeping for 2 minutes...')
    }).timeout(0)

    it('should verify deposits and L2 transactions', async () => {
      const actualIndexes = await verifyL1Deposits(
        l1DepositInitiator,
        l1Signer.address
      )
      await verifyL2Deposits(
        l1DepositInitiator,
        l2DepositTracker,
        l1Signer.address,
        actualIndexes
      )
      await verifyL2Txs(l2TxStorage)
    }).timeout(0)

    it('should have batch submitted all transactions', async () => {
      const numOldElements = await canonicalTransactionChain.getTotalElements()
      const numNewElements = await newCanonicalTransactionChain.getTotalElements()
      const numOldQueued = await newCanonicalTransactionChain.getQueueLength()
      const numNewQueued = await newCanonicalTransactionChain.getQueueLength()
      console.log(
        'old new old new',
        numOldElements,
        numNewElements,
        numOldQueued,
        numNewQueued
      )
    }).timeout(0)

    it('should have picked up all transactions in DTL', async () => {}).timeout(
      0
    )
  })
})
