/**
 * Copyright 2020, Optimism PBC
 * MIT License
 * https://github.com/ethereum-optimism
 */

import { expect } from './setup'

/* Imports: External */
import { ethers } from 'ethers'

/* Imports: Internal */
import { Config } from '../../../common'
import { makeRandomHexString } from '../helpers'

// TODO: Move this into its own file.
const DEFAULT_TRANSACTION = {
  to: '0x' + '1234'.repeat(10),
  gasLimit: 4000000,
  gasPrice: 0,
  data: '0x',
  value: 0,
}

describe('Basic RPC tests', () => {
  let provider: ethers.providers.JsonRpcProvider
  before(async () => {
    provider = new ethers.providers.JsonRpcProvider(Config.L2NodeUrlWithPort())
  })

  let wallet: ethers.Wallet
  beforeEach(async () => {
    // Generate a new random wallet before each test. Otherwise we'll run into stateful issues with
    // nonces and whatnot.
    wallet = new ethers.Wallet(makeRandomHexString(64), provider)
  })

  describe('eth_sendRawTransaction', () => {
    it('should correctly process a valid transaction', async () => {
      const tx = {
        ...DEFAULT_TRANSACTION,
        nonce: 0,
      }

      const result = await wallet.sendTransaction(tx)
      await result.wait()

      // "from" is calculated client side here, so
      // make sure that it is computed correctly.
      expect(result.from).to.equal(wallet.address)
      expect(result.nonce).to.equal(tx.nonce)
      expect(result.gasLimit.toNumber()).to.equal(tx.gasLimit)
      expect(result.gasPrice.toNumber()).to.equal(tx.gasPrice)
      expect(result.data).to.equal(tx.data)
    })

    it('should not accept a transaction with the wrong chain ID', async () => {
      const tx = {
        ...DEFAULT_TRANSACTION,
        chainId: (await wallet.getChainId()) + 1,
      }

      await expect(
        provider.sendTransaction(await wallet.signTransaction(tx))
      ).to.eventually.be.rejectedWith('invalid transaction: invalid sender')
    })

    it('should not accept a transaction without a chain ID', async () => {
      const tx = {
        ...DEFAULT_TRANSACTION,
        chainId: null, // Disables EIP155 transaction signing.
      }

      await expect(
        provider.sendTransaction(await wallet.signTransaction(tx))
      ).to.eventually.be.rejectedWith('Cannot submit unprotected transaction')
    })
  })

  describe('eth_getTransactionByHash', () => {
    it('should be able to get all relevant l1/l2 transaction data', async () => {
      const tx = DEFAULT_TRANSACTION
      const result = await wallet.sendTransaction(tx)
      await result.wait()

      const transaction = await provider.send('eth_getTransactionByHash', [
        result.hash,
      ])

      expect(transaction.txType).to.equal('EIP155')
      expect(transaction.queueOrigin).to.equal('sequencer')
      expect(
        ethers.BigNumber.from(transaction.transactionIndex).toNumber()
      ).to.equal(0) // Only one transaction per block!
      expect(ethers.BigNumber.from(transaction.gas).toNumber()).to.equal(
        tx.gasLimit
      )
    })
  })

  describe('eth_getBlockByHash', () => {
    it('should return the block and all included transactions', async () => {
      // Send a transaction and wait for it to be mined.
      const tx = DEFAULT_TRANSACTION
      const result = await wallet.sendTransaction(tx)
      const receipt = await result.wait()

      const block = await provider.send('eth_getBlockByHash', [
        receipt.blockHash,
        true,
      ])

      expect(block.number).to.not.equal(0)
      expect(typeof block.stateRoot).to.equal('string')
      expect(block.transactions.length).to.equal(1)
      expect(block.transactions[0].txType).to.equal('EIP155')
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
          ...DEFAULT_TRANSACTION,
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
