/**
 * Copyright 2020, Optimism PBC
 * MIT License
 * https://github.com/ethereum-optimism
 */

import { Config, etherbase, sleep } from '../../../common'
import { Web3Provider, JsonRpcProvider } from '@ethersproject/providers'
import { ganache } from '@eth-optimism/plugins/ganache'
import { OptimismProvider } from '@eth-optimism/provider'
import { deployContract } from 'ethereum-waffle'
import assert = require('assert')
import ERC20 = require('../../../contracts/build/ERC20.json')

// TODO(mark): Remove the skip of this test when
// the verifier is enabled in geth
describe('Queue Origin Sequencer Transactions', () => {
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
    const pre = await provider.getBlock('latest')

    signer = await provider.getSigner()
    token = await deployContract(signer, ERC20, [initalSupply, 'Foo', 8, 'FOO'])

    // Allow the batch to be submitted
    do {
      const tip = await provider.getBlock('latest')
      await sleep(5000)
      if (tip.number === pre.number + 1) {
        break
      }
    } while (true)
  })

  it('should sequencer batch append', async () => {
    const chainId = await signer.getChainId()
    const address = await signer.getAddress()
    const nonce = await provider.getTransactionCount(address)

    const result = await token.transfer(etherbase, 1)
    const receipt = await result.wait()
    assert(receipt)
  })
})
