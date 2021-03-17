/**
 * Copyright 2020, Optimism PBC
 * MIT License
 * https://github.com/ethereum-optimism
 */

import { expect } from './setup'

/* Imports: External */
import { Web3Provider } from '@ethersproject/providers'
import { ganache } from '@eth-optimism/plugins/ganache'
import { OptimismProvider } from '@eth-optimism/provider'
import assert = require('assert')

/* Imports: Internal */
import { Config, sleep } from '../../../common'

// TODO: Move this into its own file.
const DUMMY_ADDRESS = '0x' + '1234'.repeat(10)

describe('Basic RPC tests', () => {
  let provider: OptimismProvider
  let signer: any
  let chainId: number
  let defaultTransaction: any
  before(async () => {
    provider = new OptimismProvider(
      Config.L2NodeUrlWithPort(),
      new Web3Provider(
        ganache.provider({
          mnemonic: Config.Mnemonic(),
        })
      )
    )

    signer = provider.getSigner()
    chainId = await signer.getChainId()
    defaultTransaction = {
      to: DUMMY_ADDRESS,
      nonce: 0,
      gasLimit: 4000000,
      gasPrice: 0,
      data: '0x',
      value: 0,
      chainId,
    }
  })

  describe('eth_sendTransaction', () => {
    it('should correctly process a valid transaction', async () => {
      const tx = defaultTransaction

      const result = await signer.sendTransaction(tx)
      await result.wait()

      // "from" is calculated client side here, so
      // make sure that it is computed correctly.
      expect(result.from).to.equal(await signer.getAddress())
      expect(result.nonce).to.equal(tx.nonce)
      expect(result.gasLimit.toNumber()).to.equal(tx.gasLimit)
      expect(result.gasPrice.toNumber()).to.equal(tx.gasPrice)
      expect(result.data).to.equal(tx.data)
    })

    it('should not accept a transaction with the wrong chain ID', async () => {
      const tx = {
        ...defaultTransaction,
        chainId: chainId + 1,
      }

      // TODO: Unfortunately ethers is catching this error. Need to redo this test so that the
      // error doesn't get caught by ethers before we send it off.
      await expect(signer.sendTransaction(tx)).to.eventually.be.rejectedWith(
        'chainId address mismatch'
      )
    })

    it('should not accept a transaction without a chain ID', async () => {
      const tx = {
        ...defaultTransaction,
        chainId: null, // Disables EIP155 transaction signing.
      }

      // TODO: Not sure why this isn't being rejected. OptimismProvider?
      // await expect(signer.sendTransaction(tx)).to.eventually.be.rejectedWith(
      //   'REPLACE_ME'
      // )
    })
  })

  describe('eth_getTransactionByHash', () => {
    it('should be able to get all relevant l1/l2 transaction data', async () => {
      const tx = defaultTransaction
      const result = await signer.sendTransaction(tx)
      await result.wait()

      const transaction = await provider.getTransaction(result.hash)

      expect(transaction.txType).to.equal('EthSign')
      expect(transaction.queueOrigin).to.equal('sequencer')
      expect(transaction.transactionIndex).to.equal(0) // Only one transaction per block!
      expect(transaction.gasLimit).to.equal(tx.gasLimit)
      expect(transaction.chainId).to.equal(Config.ChainID())
    })
  })

  describe('eth_getBlockByHash', () => {
    it('should return the block and all included transactions', async () => {
      // Send a transaction and wait for it to be mined.
      const tx = defaultTransaction
      const result = await signer.sendTransaction(tx)
      const receipt = await result.wait()

      const block = await provider.getBlockWithTransactions(receipt.blockHash)

      expect(block.number).to.not.equal(0)
      expect(typeof block.stateRoot).to.equal('string')
      expect(block.transactions.length).to.equal(1)
      expect(block.transactions[0].txType).to.equal('EthSign')
      expect(block.transactions[0].queueOrigin).to.equal('sequencer')
      expect(block.transactions[0].l1TxOrigin).to.equal(null)
    })
  })

  describe('eth_chainId', () => {
    it('should get the correct chainid', async () => {
      const expected = Config.ChainID()
      const result = await provider.send('eth_chainId', [])

      expect(parseInt(result, 16)).to.equal(expected)
    })
  })

  describe('eth_gasPrice', () => {
    it('gas price should be 0', async () => {
      const expected = 0
      const price = await provider.getGasPrice()

      expect(price.toNumber()).to.equal(expected)
    })
  })

  describe('eth_estimateGas', () => {
    it('should return block gas limit minus one', async () => {
      // We currently fix gas price to TargetGasLimit-1
      const expected = Config.TargetGasLimit() - 1

      // Repeat this test for a series of possible transaction sizes to demonstrate that we always
      // get the same estimate.
      for (const size of [0, 2, 8, 64, 256]) {
        const estimate = await provider.estimateGas({
          ...defaultTransaction,
          data: '0x' + '00'.repeat(size),
        })

        expect(estimate.toNumber()).to.equal(expected)
      }
    })
  })

  // // There was a bug that causes transactions to be reingested over
  // // and over again only when a single transaction was in the
  // // canonical transaction chain. This test catches this by
  // // querying for the latest block and then waits and then queries
  // // the latest block again and then asserts that they are the same.
  // it('should not reingest transactions', async () => {
  //   const one = await provider.getBlockWithTransactions('latest')
  //   await sleep(2000)
  //   const two = await provider.getBlockWithTransactions('latest')
  //   assert.deepEqual(one, two)
  // })
})
