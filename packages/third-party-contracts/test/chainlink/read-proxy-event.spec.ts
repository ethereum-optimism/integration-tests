import { expect } from 'chai'

/* Imports: External */
import { JsonRpcProvider } from '@ethersproject/providers'
import { l2ethers } from 'hardhat'
import { Contract, Wallet } from 'ethers'

/* Imports: Internal */
import { Config } from '../../../../common'

describe('Reading events from proxy contracts', () => {
  let l2Provider: JsonRpcProvider
  let l2Wallet: Wallet
  before(async () => {
    l2Provider = new JsonRpcProvider(Config.L2NodeUrlWithPort())
    l2Wallet = new Wallet(Config.DeployerPrivateKey()).connect(l2Provider)
  })

  it('should read transfer events from a proxy ERC20', async () => {
    // Set up our contract factories in advance.
    const Factory__ERC20 = await l2ethers.getContractFactory('ChainlinkERC20')
    const Factory__UpgradeableProxy = await l2ethers.getContractFactory(
      'UpgradeableProxy'
    )

    // Deploy the underlying ERC20 implementation.
    const ERC20 = await Factory__ERC20.deploy()
    await ERC20.deployTransaction.wait()

    // Deploy the upgradeable proxy and execute the init function.
    const UpgradeableProxy = await Factory__UpgradeableProxy.deploy(
      ERC20.address,
      ERC20.interface.encodeFunctionData('init', [
        1000, // initial supply
        'Cool Token Name Goes Here', // token name
      ])
    )
    await UpgradeableProxy.deployTransaction.wait()

    // Create a reference to the proxy but with the interface of an ERC20.
    const ProxyERC20 = new Contract(
      UpgradeableProxy.address,
      ERC20.interface,
      l2Wallet
    )

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
