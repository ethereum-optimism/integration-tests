/**
 * Copyright 2020, Optimism PBC
 * MIT License
 * https://github.com/ethereum-optimism
 */

import { Config, etherbase } from '../../../common'
import { Web3Provider, JsonRpcProvider } from '@ethersproject/providers'
import { ganache } from '@eth-optimism/ovm-toolchain'
import { OptimismProvider } from '@eth-optimism/provider'
import { deployContract } from 'ethereum-waffle'

const ERC20 = require('../build/ERC20.json');

describe.only('Queue Origin Sequencer Transactions', () => {
  let optimismProvider
  let provider: JsonRpcProvider
  let token
  let signer

  before(async () => {
    const web3 = new Web3Provider(
      ganache.provider({
        mnemonic: Config.Mnemonic(),
      })
    )

    optimismProvider = new OptimismProvider(Config.L2NodeUrlWithPort(), web3)
    provider = new JsonRpcProvider(Config.L2NodeUrlWithPort())
  })

  before(async () => {
    signer = await provider.getSigner()
    token = await deployContract(signer, ERC20, [1000, 'Foo', 8, 'FOO'])
  })

  it('should send a transaction', async () => {
    const chainId = await signer.getChainId()
    const address = await signer.getAddress()
    const nonce = await provider.getTransactionCount(address)

    const result = await token.transfer(etherbase, 100000, {
      nonce,
      gasLimit: 41004,
      gasPrice: 0,
    })

    console.log(result)
    const receipt = await result.wait()
    console.log(receipt)
  })
})
