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
import ERC20 = require('../../../contracts/build-ovm/ERC20.json')
import L2TxStorage = require('../../../contracts/build-ovm/L2TxStorage.json')

// TODO(mark): Remove the skip of this test when
// the verifier is enabled in geth
describe('Queue Origin Sequencer Transactions', () => {
  let optimismProvider
  let provider: JsonRpcProvider
  let token
  let l2TxStorage
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
    assert((await provider.getCode(token.address)).length > 2, 'no L2 ERC20 code stored')
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
  before(async () => {
    l2TxStorage = await deployContract(signer, L2TxStorage)
    assert((await provider.getCode(l2TxStorage.address)).length > 2, 'no L2 Tx storage code stored')
  })
  it('should process many transactions correctly', async () => {
    const numTxsToSend = 1000
    for (let i=0; i < numTxsToSend; i++) {
      console.log('sending tx', i)
      while (true) {
        try {
          await l2TxStorage.sendTx(i, Math.round(Date.now() / 1000))
          break
        } catch (error) {
          console.error('error sending tx', i, error)
        }
      }
    }
    for (let i=0; i < numTxsToSend; i++) {
      const getTx = await l2TxStorage.l2Txs(i)
      console.log('checking tx', i)
      assert(i === getTx.txIndex.toNumber(), 'tx sent index does not received index in storage')
      const receivedTime = getTx.timestampReceived.toNumber()
      const sentTime = getTx.realWorldTimeSent.toNumber()
      if(sentTime > receivedTime) {
        console.log('sentTime is ahead of receivedTime by', sentTime - receivedTime, 'seconds')
      } else {
        console.log('sentTime is behind receivedTime by', receivedTime - sentTime, 'seconds')
      }
    }
  })
})
