import assert = require('assert')
import { Config, sleep } from '../../../common'
import { JsonRpcProvider } from '@ethersproject/providers'
import { getContractFactory } from '@eth-optimism/contracts'

import OVMContextStorageArtifact = require('../../../contracts/build-ovm/OVMContextStorage.json')
import OVMMulticallArtifact = require('../../../contracts/build-ovm/OVMMulticall.json')
import { Contract, ContractFactory, Wallet, BigNumber } from 'ethers'

/**
 * `block.number` of a L1 -> L2 transaction must be the same blocknumber
 * on L2 as the L1 blocknumber. `block.timestamp` must be the same timestamp
 * on L2 as the L1 timestamp
 */

describe('OVM Context', () => {
  let address: string
  let CanonicalTransactionChain: Contract
  let OVMMulticall: Contract
  let OVMContextStorage: Contract

  const l1Provider = new JsonRpcProvider(Config.L1NodeUrlWithPort())
  const l2Provider = new JsonRpcProvider(Config.L2NodeUrlWithPort())

  before(async () => {
    // Create providers and signers
    const l1Wallet = new Wallet(Config.DeployerPrivateKey()).connect(l1Provider)
    const l2Wallet = Wallet.createRandom().connect(l2Provider)

    // deploy the contract
    const OVMContextStorageFactory = new ContractFactory(
      OVMContextStorageArtifact.abi,
      OVMContextStorageArtifact.bytecode,
      l2Wallet
    )

    OVMContextStorage = await OVMContextStorageFactory.deploy()
    const receipt = await OVMContextStorage.deployTransaction.wait()
    address = OVMContextStorage.address

    const addressResolverAddress = Config.AddressResolverAddress()
    const AddressResolverFactory = getContractFactory('Lib_AddressManager')
    const addressResolver = AddressResolverFactory
      .attach(addressResolverAddress)
      .connect(l1Provider)
    const ctcAddress = await addressResolver.getAddress('OVM_CanonicalTransactionChain')
    const CanonicalTransactionChainFactory = getContractFactory('OVM_CanonicalTransactionChain')

    CanonicalTransactionChain = CanonicalTransactionChainFactory.connect(l1Wallet).attach(ctcAddress)

    const OVMMulticallFactory = new ContractFactory(
      OVMMulticallArtifact.abi,
      OVMMulticallArtifact.bytecode,
      l2Wallet,
    )
    OVMMulticall = await OVMMulticallFactory.deploy()
    await OVMMulticall.deployTransaction.wait()
  })

  it('Enqueue: `block.number` and `block.timestamp`', async () => {
    for (let i = 0; i < 5; i++) {
      const l2Tip = await l2Provider.getBlock('latest')
      const tx = await CanonicalTransactionChain.enqueue(OVMContextStorage.address, 500_000, '0x')

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
      // The transaction did not revert
      assert.equal(receipt.status, 1)

      // Get the L1 block that the enqueue transaction was in so that
      // the timestamp can be compared against the layer two contract
      const block = await l1Provider.getBlock(receipt.blockNumber)

      // The contact is a fallback function that keeps `block.number`
      // and `block.timestamp` in a mapping based on an index that
      // increments each time that there is a transaction.
      const blockNumber = await OVMContextStorage.blockNumbers(i)
      assert.deepEqual(receipt.blockNumber, blockNumber.toNumber())
      const timestamp = await OVMContextStorage.timestamps(i)
      assert.deepEqual(block.timestamp, timestamp.toNumber())
    }
  })

  it('should return same timestamp and blocknumbers between `eth_call` and `rollup_getInfo`', async () => {
    // As atomically as possible, call `rollup_getInfo` and OVMMulticall for the
    // blocknumber and timestamp
    const [info, [, returnData]] = await Promise.all([
      l2Provider.send('rollup_getInfo', []),
      OVMMulticall.callStatic.aggregate([
        [OVMMulticall.address, OVMMulticall.interface.encodeFunctionData('getCurrentBlockTimestamp')],
        [OVMMulticall.address, OVMMulticall.interface.encodeFunctionData('getCurrentBlockNumber')]
      ])
    ])

    const timestamp = BigNumber.from(returnData[0])
    const blockNumber = BigNumber.from(returnData[1])

    // TODO: this is a bug and needs to be fixed
    //assert.deepEqual(info.ethContext.blockNumber, blockNumber.toNumber())
    assert.deepEqual(info.ethContext.timestamp, timestamp.toNumber())
  })
})
