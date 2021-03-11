/**
 * Copyright 2020, Optimism PBC
 * MIT License
 * https://github.com/ethereum-optimism
 */

import { Config, sleep, poll, getL1Provider } from '../../../common'

import {
  Provider,
  Web3Provider,
  JsonRpcProvider,
} from '@ethersproject/providers'
import { Wallet } from '@ethersproject/wallet'
import { Contract } from '@ethersproject/contracts'
import { add0x } from '@eth-optimism/core-utils'
import { ganache } from '@eth-optimism/plugins/ganache'
import { OptimismProvider } from '@eth-optimism/provider'
import { getContractAddress } from '@ethersproject/address'
import { computeAddress } from '@ethersproject/transactions'
import { getContractFactory } from '@eth-optimism/contracts'
import assert = require('assert')

describe('CTC upgrade', () => {
  let l1Provider: JsonRpcProvider
  let l1Signer: Wallet
  let l2Signer
  let l2Provider: JsonRpcProvider
  let addressResolver: Contract

  let canonicalTransactionChain: Contract
  let newCanonicalTransactionChain: Contract
  let ctcAddress: string

  const mnemonic = Config.Mnemonic()

  const FORCE_INCLUSION_PERIOD_SECONDS = 600
  const FORCE_INCLUSION_PERIOD_BLOCKS = 600 / 12
  const MAX_GAS_LIMIT = 8_000_000
  let pre

  before(async () => {
    l1Provider = new JsonRpcProvider(Config.L1NodeUrlWithPort())
    l1Signer = new Wallet(Config.DeployerPrivateKey()).connect(l1Provider)
    const web3 = new Web3Provider(
      ganache.provider({
        mnemonic,
      })
    )
    l2Provider = new OptimismProvider(Config.L2NodeUrlWithPort(), web3)
    l2Signer = await l2Provider.getSigner()

    const addressResolverAddress = add0x(Config.AddressResolverAddress())
    const AddressResolverFactory = getContractFactory('Lib_AddressManager')
    addressResolver = AddressResolverFactory.connect(l1Signer).attach(
      addressResolverAddress
    )

    ctcAddress = await addressResolver.getAddress(
      'OVM_CanonicalTransactionChain'
    )

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
  })

  // The transactions are enqueue'd with a `to` address of i.repeat(40)
  // meaning that the `to` value is different each iteration in a deterministic
  // way. They need to be inserted into the L2 chain in an ascending order.
  // Keep track of the receipts so that the blockNumber can be compared
  // against the `L1BlockNumber` on the tx objects.
  const receipts = []
  it('should enqueue some transactions', async () => {
    // Keep track of the L2 tip before submitting any transactions so that
    // the subsequent transactions can be queried for in the next test
    pre = await l2Provider.getBlock('latest')

    // Enqueue some transactions by building the calldata and then sending
    // the transaction to Layer 1
    for (let i = 0; i < 5; i++) {
      const input = ['0x' + `${i + 1}`.repeat(40), 500_000, `0x0${i}`]
      const calldata = await canonicalTransactionChain.interface.encodeFunctionData(
        'enqueue',
        input
      )

      const txResponse = await l1Signer.sendTransaction({
        data: calldata,
        to: ctcAddress,
      })

      const receipt = await txResponse.wait()
      receipts.push(receipt)
    }

    for (const receipt of receipts) {
      receipt.should.be.a('object')
    }
  })

  before(async () => {
    const CanonicalTransactionChainFactory = getContractFactory(
      'OVM_CanonicalTransactionChain'
    )
  })
})
