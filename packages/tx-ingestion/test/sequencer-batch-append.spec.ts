/**
 * Copyright 2020, Optimism PBC
 * MIT License
 * https://github.com/ethereum-optimism
 */

import { Config, etherbase, sleep } from '../../../common'
import { Web3Provider, JsonRpcProvider } from '@ethersproject/providers'
import { ganache } from '@eth-optimism/ovm-toolchain'
import { OptimismProvider } from '@eth-optimism/provider'
import { deployContract } from 'ethereum-waffle'
import assert = require('assert')
import ERC20 = require('../build/ERC20.json');

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

  const initalSupply = 1000
  before(async () => {
    signer = await provider.getSigner()
    token = await deployContract(signer, ERC20, [initalSupply, 'Foo', 8, 'FOO'])
  })

  it('should send a transaction', async () => {
    const chainId = await signer.getChainId()
    const address = await signer.getAddress()
    const nonce = await provider.getTransactionCount(address)

    const result = await token.transfer(etherbase, 1)
    const receipt = await result.wait()
    assert(receipt)
  })

  it('should batch submit', async () => {
    do {
      const tip = await provider.getBlock('latest')
      console.log(tip)
      await sleep(5000)
    } while (true)
  })
})
