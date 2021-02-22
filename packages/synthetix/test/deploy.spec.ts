/**
 * Copyright 2020, Optimism PBC
 * MIT License
 * https://github.com/ethereum-optimism
 */

import { Config, sleep } from '../../../common'
import { Contract, Wallet } from 'ethers'
import { JsonRpcProvider, Web3Provider } from '@ethersproject/providers'
import { OptimismProvider } from '@eth-optimism/provider'
import { ganache } from '@eth-optimism/ovm-toolchain'
import axios from 'axios'
import assert = require('assert')

// The signer must use the same key that was used to deploy the contracts
// See `DEPLOYER_PRIVATE_KEY_2` in the docker env, it is a key that
// is derived from the mnemonic and has genesis ETH

describe('OVM testnet deploy', async () => {
  let deployerURL = Config.SynthetixDeployerURL()
  if (!deployerURL) {
    deployerURL = 'localhost:8081'
  }
  const deployer = `${deployerURL}/deployment.json`

  const mnemonic = Config.Mnemonic()
  const web3 = new Web3Provider(ganache.provider({mnemonic}))
  const provider = new OptimismProvider(Config.L2NodeUrlWithPort(), web3)
  const pk = Config.DeployerPrivateKey2()
  const wallet = new Wallet(pk).connect(provider)
  let synthetix: Contract
  let proxysUSD: Contract

  let deployment
  before('Synthetix deployment', async () => {
    for (let i = 0; i < 100; i++) {
      try {
        const response = await axios.get(deployer)
        deployment = response.data
      } catch (e) {
        console.log(`Waiting for contracts to be deployed: ${i}`)
        await sleep(3000)
      }
    }
    // On L2, its `MintableSynthetix`, on L1 it is just `Synthetix`
    synthetix = new Contract(deployment.targets.Synthetix.address, deployment.sources.MintableSynthetix.abi, provider);
    synthetix = synthetix.connect(wallet)
    proxysUSD = new Contract(deployment.targets.ProxysUSD.address, deployment.sources.Synth.abi)
    proxysUSD = proxysUSD.connect(wallet)
  })

  it('should get balance', async () => {
    const addr = await wallet.getAddress()
    const snx = await synthetix.balanceOf(addr)
    assert(snx)
    assert.equal(snx.eq(0), false)
    const balance = await proxysUSD.balanceOf(addr)
    assert(balance.eq(0))
  })

  it('should issue synths', async () => {
    const addr = await wallet.getAddress()
    const tx = await synthetix.issueSynths(1)
    assert(tx)

    // TODO: make sure hash is computed correctly
    // when using OptimismProvider
    //const receipt = await tx.wait()
    await sleep(2000)

    const balance = await proxysUSD.balanceOf(addr)
    //assert.equal(balance.toNumber(), 1)
  })
});
