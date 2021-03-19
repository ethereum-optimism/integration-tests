import { expect } from 'chai'

/* Imports: External */
import { JsonRpcProvider } from '@ethersproject/providers'
import { Contract, ContractFactory, Wallet } from 'ethers'

/* Imports: Internal */
import { Config } from '../../../common'
import ERC20ABI = require('../../../contracts/build-ovm/ERC20.json')
import UpgradeableProxyABI = require('../../../contracts/build-ovm/UpgradeableProxy.json')

describe('Reading events from proxy contracts', () => {
  let l2Provider: JsonRpcProvider
  let l2Wallet: Wallet
  before(async () => {
    l2Provider = new JsonRpcProvider(Config.L2NodeUrlWithPort())
    l2Wallet = new Wallet(Config.DeployerPrivateKey()).connect(l2Provider)
  })

  it('should read transfer events from a proxy ERC20', async () => {
    // Set up our contract factories in advance.
    const Factory__ERC20 = new ContractFactory(
      ERC20ABI.abi,
      ERC20ABI.bytecode,
      l2Wallet
    )
    const Factory__UpgradeableProxy = new ContractFactory(
      [...ERC20ABI.abi, ...UpgradeableProxyABI.abi],
      UpgradeableProxyABI.bytecode,
      l2Wallet
    )

    // Deploy the underlying ERC20 implementation.
    const ERC20 = await Factory__ERC20.deploy()
    await ERC20.deployTransaction.wait()

    // Deploy the upgradeable proxy and execute the init function.
    const ProxyERC20 = await Factory__UpgradeableProxy.deploy(
      ERC20.address,
      ERC20.interface.encodeFunctionData('init', [
        1000, // initial supply
        'Cool Token Name Goes Here', // token name
      ])
    )
    await ProxyERC20.deployTransaction.wait()

    // Make two transfers.
    const recipient = '0x0000000000000000000000000000000000000000'
    const transfer1 = await ProxyERC20.transfer(recipient, 1)
    await transfer1.wait()
    const transfer2 = await ProxyERC20.transfer(recipient, 1)
    await transfer2.wait()

    const _queryFilterTransfer = async (
      queryContract: Contract,
      filterContract: Contract
    ) => {
      // Get the filter
      const filter = filterContract.filters.Transfer(null, null, null)
      // Query the filter
      return queryContract.queryFilter(filter, 0, 'latest')
    }

    // Make sure events are being emitted in the right places.
    expect((await _queryFilterTransfer(ERC20, ERC20)).length).to.eq(0)
    expect((await _queryFilterTransfer(ERC20, ProxyERC20)).length).to.eq(0)
    expect((await _queryFilterTransfer(ProxyERC20, ERC20)).length).to.eq(2)
    expect((await _queryFilterTransfer(ProxyERC20, ProxyERC20)).length).to.eq(2)
  })
})
