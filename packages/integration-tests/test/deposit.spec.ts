import { Config } from '../../../common'

import {
  Provider,
  Web3Provider,
  JsonRpcProvider,
} from '@ethersproject/providers'
import { Wallet } from '@ethersproject/wallet'
import { ganache } from '@eth-optimism/ovm-toolchain'
import { PostgresDB } from '@eth-optimism/core-db'
import { add0x } from '@eth-optimism/core-utils'
import { OptimismProvider, sighashEthSign } from '@eth-optimism/provider'
import { getContractFactory } from '@eth-optimism/rollup-contracts'
import { getContractAddress } from '@ethersproject/address'
import { Contract } from '@ethersproject/contracts'
import { computeAddress } from '@ethersproject/transactions'
import { QueueOrigin, BatchSubmissionStatus } from '@eth-optimism/rollup-core'

describe('Transactions', () => {
  let l1Provider: JsonRpcProvider
  let l1Wallet: Wallet
  let l2Provider: JsonRpcProvider
  let addressResolver: Contract

  const mnemonic = Config.Mnemonic()

  before(async () => {
    l1Provider = new JsonRpcProvider(Config.L1NodeUrlWithPort())
    l1Wallet = Wallet.fromMnemonic(mnemonic).connect(l1Provider)
    const web3 = new Web3Provider(
      ganache.provider({
        mnemonic,
      })
    )

    l2Provider = new OptimismProvider(Config.L2NodeUrlWithPort(), web3)

    const addressResolverAddress = Config.AddressResolverAddress()
    const AddressResolverFactory = getContractFactory('AddressManager')
    addressResolver = AddressResolverFactory.connect(l1Wallet).attach(
      addressResolverAddress
    )
    //await l1Provider.send('evm_mine_interval', [2])
  })

  after(async () => {
    //await l1Provider.send('evm_mine_interval', [0])
  })

  it('should send a lot of transactions', async () => {
    const ctcAddress = await addressResolver.getAddress('OVM_CanonicalTransactionChain')

    const CanonicalTransactionChainFactory = getContractFactory(
      'OVM_CanonicalTransactionChain'
    )
    const canonicalTransactionChain: Contract = CanonicalTransactionChainFactory.connect(
      l1Wallet
    ).attach(ctcAddress)

    const input = ['0x' + '01'.repeat(20), 500_000, '0x' + '00']
    const calldata = await canonicalTransactionChain.interface.encodeFunctionData(
      'enqueue',
      input
    )

    const txResponse = await l1Wallet.sendTransaction({
      data: calldata,
      to: ctcAddress,
    })
    const txReceipt = await txResponse.wait()

    console.log(txResponse)
  }).timeout(10000)
})
