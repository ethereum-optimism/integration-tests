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
import chai = require('chai')
const expect = chai.expect

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

  const initialSupply = 1000
  before(async () => {
    signer = await provider.getSigner()
    token = await (await deployContract(signer, ERC20, [initialSupply, 'Foo', 8, 'FOO'])).connect(signer)
  })

  it('should send a transaction', async () => {
    console.log('We did a test yayyayay')
    const chainId = await signer.getChainId()
    console.log('TRANSFERING CONTRACT')
    const balanceBefore = (await token.balanceOf(await signer.getAddress())).toNumber()
    const friendAddress = '0x' + '11'.repeat(20)
    const amountToSend = 10
    const res = await token.transfer(friendAddress, amountToSend)
    const balanceAfter = (await token.balanceOf(await signer.getAddress())).toNumber()
    const friendBalance = (await token.balanceOf(friendAddress)).toNumber()
    // Verify the transfer was correctly executed
    expect(balanceBefore).to.equal(initialSupply)
    expect(balanceAfter).to.equal(initialSupply - amountToSend)
    expect(friendBalance).to.equal(amountToSend)

    // Now verify that the batch submitter works!
    // TODO: Make this actually check for events instead of just waiting.
    // console.log('Submitted tx!!! NOW WE ARE WAITING\n~~~~~~~~~~~~~~~~~~~\n~~~~~~~~~~~~~~~~~~~~~\n~~~~~~~~~~~~~~~~~')
    // await new Promise(r => setTimeout(r, 100000));
  })
})
