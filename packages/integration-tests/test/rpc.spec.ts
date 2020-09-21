/**
 * Copyright 2020, Optimism PBC
 * MIT License
 * https://github.com/ethereum-optimism
 */

import './setup'
import { Config } from '../src/config'

import { JsonRpcServer } from '@eth-optimism/core-utils'
import { Web3Provider } from '@ethersproject/providers'
import { ganache } from '@eth-optimism/ovm-toolchain'
import { OptimismProvider, sighashEthSign } from '@eth-optimism/provider'
import { verifyMessage } from '@ethersproject/wallet'
import { parse } from '@ethersproject/transactions'
import { SignatureLike, joinSignature } from '@ethersproject/bytes'

// Commonly used test mnemonic
const mnemonic =
  'abandon abandon abandon abandon abandon abandon ' +
  'abandon abandon abandon abandon abandon about'

// Address derived at m/44'/60'/0'/0 of test mnemonic
const etherbase = '0x9858EfFD232B4033E47d90003D41EC34EcaEda94'

describe('sendTransaction', () => {
  let provider

  before(async () => {
    const web3 = new Web3Provider(
      ganache.provider({
        mnemonic,
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
      to: etherbase,
      nonce,
      gasLimit: 21004,
      gasPrice: 0,
      data: '0x',
      value: 0,
      chainId,
    }

    const hex = await signer.signTransaction(tx)

    const txid = await provider.send('eth_sendRawEthSignTransaction', [hex])
    const transaction = await provider.getTransaction(txid)

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
      to: etherbase,
      nonce,
      gasLimit: 21004,
      gasPrice: 0,
      data: '0x',
      value: 0,
      chainId,
    }

    const result = await signer.sendTransaction(tx)

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
    ;(0).should.eq(price.toNumber())
  })

  it('should estimate gas', async () => {
    const template = {
      to: etherbase,
      gasLimit: 21000,
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

    for (const estimate of estimates) {
      estimate.toNumber().should.eq(7999999)
    }
  })
})
