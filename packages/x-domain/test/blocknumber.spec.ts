import assert = require('assert')
import { Config, sleep } from '../../../common'
import { JsonRpcProvider } from '@ethersproject/providers'
import { getContractFactory } from '@eth-optimism/contracts'

import BlockNumberStorage = require('../../../contracts/build-ovm/BlockNumberStorage.json')
import { Contract, ContractFactory, Wallet } from 'ethers'

const provider = new JsonRpcProvider(Config.L2NodeUrlWithPort())

/**
 * `block.number` of a L1 -> L2 transaction must be the same blocknumber
 * on L2 as the L1 blocknumber
 */

describe('block.number', () => {
  let address: string
  let contract: Contract
  let ctc: Contract

  const l1Provider = new JsonRpcProvider(Config.L1NodeUrlWithPort())
  const l2Provider = new JsonRpcProvider(Config.L2NodeUrlWithPort())

  before(async () => {
    // Create providers and signers
    const l1Wallet = new Wallet(Config.DeployerPrivateKey()).connect(l1Provider)
    const l2Wallet = Wallet.createRandom().connect(l2Provider)

    // deploy the contract
    const factory = new ContractFactory(
      BlockNumberStorage.abi,
      BlockNumberStorage.bytecode,
      l2Wallet
    )

    contract = await factory.deploy()
    const receipt = await contract.deployTransaction.wait()
    address = contract.address

    const addressResolverAddress = Config.AddressResolverAddress()
    const AddressResolverFactory = getContractFactory('Lib_AddressManager')
    const addressResolver = AddressResolverFactory
      .attach(addressResolverAddress)
      .connect(l1Provider)
    const ctcAddress = await addressResolver.getAddress('OVM_CanonicalTransactionChain')
    const CanonicalTransactionChainFactory = getContractFactory('OVM_CanonicalTransactionChain')

    ctc = CanonicalTransactionChainFactory.connect(l1Wallet).attach(ctcAddress)
  })

  it('The blocknumber of the enqueue should be `block.number`', async () => {
    for (let i = 0; i < 5; i++) {
      const l2Tip = await l2Provider.getBlock('latest')
      const tx = await ctc.enqueue(address, 500_000, '0x')

      // Wait for the enqueue to be ingested
      while (true) {
        const tip = await l2Provider.getBlock('latest')
        if (tip.number === l2Tip.number + 1) {
          break
        }
        await sleep(500)
      }

      // Get the receipt
      const receipt = await tx.wait()

      const blockNumber = await contract.blockNumbers(i)
      assert.deepEqual(receipt.blockNumber, blockNumber.toNumber())
    }
  })
})
