/**
 * Copyright 2020, Optimism PBC
 * MIT License
 * https://github.com/ethereum-optimism
 */

import { Config } from '../../../common'
import { Web3Provider } from '@ethersproject/providers'
import { ganache } from '@eth-optimism/ovm-toolchain'
import { OptimismProvider, sighashEthSign } from '@eth-optimism/provider'
import { verifyMessage } from '@ethersproject/wallet'
import { computeAddress, parse } from '@ethersproject/transactions'
import { SignatureLike, joinSignature } from '@ethersproject/bytes'
import assert = require('assert')

const DUMMY_ADDRESS = '0x' + '1234'.repeat(10)

describe.only('Transactions', () => {
  let provider

  before(async () => {
    const web3 = new Web3Provider(
      ganache.provider({
        mnemonic: Config.Mnemonic(),
      })
    )
    provider = new OptimismProvider(Config.L2NodeUrlWithPort(), web3)
  })

  it('should send eth_sendRawEthSignTransaction', async () => {
    const signer = provider.getSigner()
    const chainId = await signer.getChainId()

    const address = await signer.getAddress()
    const nonce = await provider.getTransactionCount(address)

    const tx = {
      to: DUMMY_ADDRESS,
      nonce,
      gasLimit: 4000000,
      gasPrice: 0,
      data: '0x',
      value: 0,
      chainId,
    }

    const hex = await signer.signTransaction(tx)

    const txid = await provider.send('eth_sendRawEthSignTransaction', [hex])
    await provider.waitForTransaction(txid)

    const transaction = await provider.getTransaction(txid)
    assert(transaction !== null)
    // The correct signature hashing was performed
    address.should.eq(transaction.from)

    // The correct transaction is being returned
    tx.to.should.eq(transaction.to)
    tx.value.should.eq(transaction.value.toNumber())
    tx.nonce.should.eq(transaction.nonce)
    tx.gasLimit.should.eq(transaction.gasLimit.toNumber())
    tx.gasPrice.should.eq(transaction.gasPrice.toNumber())
    tx.data.should.eq(transaction.data)

    // Fetching the transaction receipt works correctly
    const receipt = await provider.getTransactionReceipt(txid)
    address.should.eq(receipt.from)
    tx.to.should.eq(receipt.to)
  })

  it('should sendTransaction', async () => {
    const signer = provider.getSigner()
    const chainId = await signer.getChainId()

    const address = await signer.getAddress()
    const nonce = await provider.getTransactionCount(address)

    const tx = {
      to: DUMMY_ADDRESS,
      nonce,
      gasLimit: 4000000,
      gasPrice: 0,
      data: '0x',
      value: 0,
      chainId,
    }

    const result = await signer.sendTransaction(tx)
    await result.wait()

    // "from" is calculated client side here, so
    // make sure that it is computed correctly.
    result.from.should.eq(address)

    tx.nonce.should.eq(result.nonce)
    tx.gasLimit.should.eq(result.gasLimit.toNumber())
    tx.gasPrice.should.eq(result.gasPrice.toNumber())
    tx.data.should.eq(result.data)
  })

  it('gas price should be 0', async () => {
    const price = await provider.getGasPrice()
    const num = price.toNumber()
    num.should.eq(0)
  })

  it.skip('should estimate gas', async () => {
    const template = {
      to: DUMMY_ADDRESS,
      gasLimit: 4000000,
      gasPrice: 0,
      value: 0,
      data: '',
    }

    // The gas price is the same with different
    // transaction sizes.
    const cases = ['0x', '0x' + '00'.repeat(256)]

    const estimates = []
    for (const c of cases) {
      template.data = c
      const estimate = await provider.estimateGas(template)
      estimates.push(estimate)
    }

    // Pull in the env var that configures the target
    // gas limit in l2 geth
    const targetGasLimit = Config.TargetGasLimit()

    for (const estimate of estimates) {
      estimate.toNumber().should.eq(targetGasLimit - 1)
    }
  })

  it('should get correct chainid', async () => {
    const chainId = await provider.send('eth_chainId', [])
    const expected = Config.ChainID()
    chainId.should.eq('0x' + expected.toString(16))
    parseInt(chainId, 16).should.eq(expected)
  })

  it('should get transaction (l2 metadata)', async () => {
    const tx = {
      to: DUMMY_ADDRESS,
      gasLimit: 4000000,
      gasPrice: 0,
      data: '0x',
      value: 0,
    }

    const signer = provider.getSigner()
    const result = await signer.sendTransaction(tx)
    await result.wait()
    const txn = await provider.getTransaction(result.hash)

    txn.txType.should.be.a('string')
    txn.queueOrigin.should.be.a('string')
  })

  // This test depends on previous transactions being mined
  it('should get block with transactions', async () => {
    const block = await provider.getBlockWithTransactions('latest')
    assert(block.number !== 0)
    // ethers JsonRpcProvider does not return the state root
    // but the OptimismProvider does.
    assert(typeof block.stateRoot === 'string')
    // There must be a single transaction
    assert(block.transactions.length === 1)
    const tx = block.transactions[0]
    // The `OptimismProvider` creates EthSign transactions
    assert(tx.txType === 'EthSign')
    // The transaction was sent directly to the sequencer so the
    // queue origin is sequencer
    assert(tx.queueOrigin === 'sequencer')
    // The queue origin is the sequencer, not L1, so there is
    // no L1TxOrigin
    assert(tx.l1TxOrigin === null)
  })

  it('should not accept transactions with incorrect chainid', async () => {
    // set err initially to false so that it can be set to true
    // in the `try/catch` below
    let err = false
    const chainId = await provider.send('eth_chainId', [])
    const signer = provider.getSigner()
    try {
      await signer.sendTransaction({
        to: DUMMY_ADDRESS,
        gasLimit: 4000000,
        gasPrice: 0,
        data: '0x',
        value: 0,
        chainId: parseInt(chainId, 16) + 1
      })
      assert(false)
    } catch (e) {
      err = true
    }
    assert(err)
  })
})
