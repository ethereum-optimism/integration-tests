/**
 * Copyright 2020, Optimism PBC
 * MIT License
 * https://github.com/ethereum-optimism
 */

import { Config } from '../../../common'

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
import { getContractFactory } from '@eth-optimism/rollup-contracts'

describe('Transaction Ingestion', () => {
  let l1Provider: JsonRpcProvider
  let l1Signer: Wallet
  let l2Provider: JsonRpcProvider
  let addressResolver: Contract

  let canonicalTransactionChain: Contract
  let ctcAddress: string

  const mnemonic = Config.Mnemonic()

  before(async () => {
    l1Provider = new JsonRpcProvider(Config.L1NodeUrlWithPort())
    l1Signer = Wallet.fromMnemonic(mnemonic).connect(l1Provider)
    const web3 = new Web3Provider(
      ganache.provider({
        mnemonic,
      })
    )

    l2Provider = new OptimismProvider(Config.L2NodeUrlWithPort(), web3)

    // Set up address resolver which we can use to resolve any required contract addresses
    const deployerAddress = computeAddress(
      add0x(Config.DeployerPrivateKey())
    )

    const addressResolverAddress = add0x(Config.AddressResolverAddress())

    const AddressResolverFactory = getContractFactory('AddressManager')
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

    //await l1Provider.send('evm_mine_interval', [2])
  })

  it('should send a ton of transactions', async () => {
    const receipts = []

    for (let i = 0; i < 5; i++) {
      const input = ['0x' + '01'.repeat(20), 500_000, '0x' + '00']
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

    // TODO(mark): add watcher and interleave txs directly to L2
    for (const receipt of receipts) {
      receipt.should.be.a('object')
    }
  }).timeout(1000000)
})
