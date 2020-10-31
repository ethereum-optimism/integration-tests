/**
 * Copyright 2020, Optimism PBC
 * MIT License
 * https://github.com/ethereum-optimism
 */

import { Config, sleep, poll } from '../../../common'

import {
  Provider,
  Web3Provider,
  JsonRpcProvider,
} from '@ethersproject/providers'
import { Wallet } from '@ethersproject/wallet'
import { Contract } from '@ethersproject/contracts'
import { add0x } from '@eth-optimism/core-utils'
import { ganache } from '@eth-optimism/ovm-toolchain'
import { OptimismProvider } from '@eth-optimism/provider'
import { getContractAddress } from '@ethersproject/address'
import { computeAddress } from '@ethersproject/transactions'
import { getContractFactory } from '@eth-optimism/contracts'
import assert = require('assert')

describe('Transaction Ingestion', () => {
  let l1Provider: JsonRpcProvider
  let l1Signer: Wallet
  let l2Provider: JsonRpcProvider
  let addressResolver: Contract

  let canonicalTransactionChain: Contract
  let ctcAddress: string

  const mnemonic = Config.Mnemonic()

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

    const addressResolverAddress = add0x(Config.AddressResolverAddress())
    const AddressResolverFactory = getContractFactory('Lib_AddressManager')
    addressResolver = AddressResolverFactory.connect(l1Signer).attach(
      addressResolverAddress
    )

    ctcAddress = await addressResolver.getAddress('OVM_CanonicalTransactionChain')

    const CanonicalTransactionChainFactory = getContractFactory(
      'OVM_CanonicalTransactionChain'
    )

    canonicalTransactionChain = CanonicalTransactionChainFactory.connect(
      l1Signer
    ).attach(ctcAddress)

    l2Provider.on('pending', (tx) => {
      console.log('PENDING TX')
      console.log(tx)
    })
  })

  it('should enqueue some transactions', async () => {
    const receipts = []

    pre = await l2Provider.getBlock('latest')

    for (let i = 0; i < 5; i++) {
      const input = ['0x' + `${i}`.repeat(40), 500_000, `0x0${i}`]
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

  it('should wait and fetch blocks', async () => {
    // wait until each tx from the previous test has
    // been processed
    let tip;
    do {
      tip = await l2Provider.getBlock('latest')
      console.log(`l2 height: ${tip.number}`)
      await sleep(5000)
    } while (tip.number !== pre.number + 5)

    for (let i = pre.number + 1; i < pre.number + 5; i++) {
      const block = await l2Provider.getBlock(i)
      const hash = block.transactions[0]
      const tx = await l2Provider.getTransaction(hash)
      console.log(tx)
      assert.equal(tx.to, '0x' + `${i-1}`.repeat(40))
    }
  }).timeout(10000000)
}).timeout(1000000000)
