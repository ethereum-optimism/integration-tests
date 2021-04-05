import { expect } from 'chai'

/* Imports: External */
import { Contract, ContractFactory, Wallet } from 'ethers'
import { JsonRpcProvider } from '@ethersproject/providers'
import { Watcher } from '@eth-optimism/watcher'
import { getContractInterface } from '@eth-optimism/contracts'

/* Imports: Internal */
import { Config, getl2Provider } from '../../../common'
import l1SimpleStorageJson = require('../../../contracts/build/SimpleStorage.json')
import l2SimpleStorageJson = require('../../../contracts/build-ovm/SimpleStorage.json')

describe('Basic L1<>L2 Communication', async () => {
  const l1Provider = getl2Provider()
  const l2Provider = new JsonRpcProvider(Config.L2NodeUrlWithPort())

  let l1Wallet: Wallet
  let l2Wallet: Wallet
  before(() => {
    l1Wallet = new Wallet(Config.DeployerPrivateKey(), l1Provider)
    l2Wallet = new Wallet(Config.DeployerPrivateKey(), l2Provider)
  })

  let AddressManager: Contract
  before(() => {
    const addressManagerAddress = Config.AddressResolverAddress()
    const addressManagerInterface = getContractInterface('Lib_AddressManager')
    AddressManager = new Contract(
      addressManagerAddress,
      addressManagerInterface,
      l1Provider
    )
  })

  let Factory__L1SimpleStorage: ContractFactory
  let Factory__L2SimpleStorage: ContractFactory
  before(() => {
    Factory__L1SimpleStorage = new ContractFactory(
      l1SimpleStorageJson.abi,
      l1SimpleStorageJson.bytecode,
      l1Wallet
    )
    Factory__L2SimpleStorage = new ContractFactory(
      l2SimpleStorageJson.abi,
      l2SimpleStorageJson.bytecode,
      l2Wallet
    )
  })

  let L1CrossDomainMessenger: Contract
  let L2CrossDomainMessenger: Contract
  before(async () => {
    const l1MessengerAddress = await AddressManager.getAddress(
      'Proxy__OVM_L1CrossDomainMessenger'
    )
    const l2MessengerAddress = await AddressManager.getAddress(
      'OVM_L2CrossDomainMessenger'
    )

    L1CrossDomainMessenger = new Contract(
      l1MessengerAddress,
      await getContractInterface('iOVM_L1CrossDomainMessenger'),
      l1Wallet
    )

    L2CrossDomainMessenger = new Contract(
      l2MessengerAddress,
      await getContractInterface('iOVM_L2CrossDomainMessenger'),
      l2Wallet
    )
  })

  let watcher: Watcher
  before(() => {
    watcher = new Watcher({
      l1: {
        provider: l1Provider,
        messengerAddress: L1CrossDomainMessenger.address,
      },
      l2: {
        provider: l2Provider,
        messengerAddress: L2CrossDomainMessenger.address,
      },
    })
  })

  let L1SimpleStorage: Contract
  let L2SimpleStorage: Contract
  beforeEach(async () => {
    L1SimpleStorage = await Factory__L1SimpleStorage.deploy()
    await L1SimpleStorage.deployTransaction.wait()
    L2SimpleStorage = await Factory__L2SimpleStorage.deploy()
    await L2SimpleStorage.deployTransaction.wait()
  })

  it('should withdraw from L2 -> L1', async () => {
    const value = `0x${'77'.repeat(32)}`

    // Send L2 -> L1 message.
    const transaction = await L2CrossDomainMessenger.sendMessage(
      L1SimpleStorage.address,
      L1SimpleStorage.interface.encodeFunctionData('setValue', [value]),
      5000000,
      { gasLimit: 7000000 }
    )

    // Wait for the L2 transaction to be mined.
    await transaction.wait()

    // Wait for the transaction to be relayed on L1.
    const messageHashes = await watcher.getMessageHashesFromL2Tx(
      transaction.hash
    )
    await watcher.getL1TransactionReceipt(messageHashes[0])

    expect(await L1SimpleStorage.msgSender()).to.equal(
      L1CrossDomainMessenger.address
    )
    expect(await L1SimpleStorage.xDomainSender()).to.equal(l2Wallet.address)
    expect(await L1SimpleStorage.value()).to.equal(value)
    expect((await L1SimpleStorage.totalCount()).toNumber()).to.equal(1)
  })

  it('should deposit from L1 -> L2', async () => {
    const value = `0x${'42'.repeat(32)}`

    // Send L1 -> L2 message.
    const transaction = await L1CrossDomainMessenger.sendMessage(
      L2SimpleStorage.address,
      L2SimpleStorage.interface.encodeFunctionData('setValue', [value]),
      5000000,
      { gasLimit: 7000000 }
    )

    // Wait for the L1 transaction to be mined.
    await transaction.wait()

    // Wait for the transaction to be included on L2.
    const messageHashes = await watcher.getMessageHashesFromL1Tx(
      transaction.hash
    )
    await watcher.getL2TransactionReceipt(messageHashes[0])

    expect(await L2SimpleStorage.msgSender()).to.equal(
      L2CrossDomainMessenger.address
    )
    expect(await L2SimpleStorage.xDomainSender()).to.equal(l1Wallet.address)
    expect(await L2SimpleStorage.value()).to.equal(value)
    expect((await L2SimpleStorage.totalCount()).toNumber()).to.equal(1)
  })
})
