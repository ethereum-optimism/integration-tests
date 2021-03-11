import { expect } from 'chai'
import { JsonRpcProvider } from '@ethersproject/providers'
import { Contract, ContractFactory, Wallet } from 'ethers'
import { Config } from '../../../common'
import erc20Json = require('../../../contracts/build-ovm/ERC20.json')
import upgradeableProxyJson = require('../../../contracts/build-ovm/UpgradeableProxy.json')

describe('Read proxy event', () => {
  let l2Provider: JsonRpcProvider
  let l2Wallet: Wallet

  before(async () => {
    // l1Provider = new JsonRpcProvider(Config.L1NodeUrlWithPort())
    // l1Signer = new Wallet(Config.DeployerPrivateKey()).connect(l1Provider))
    const key =
    '0xa35617f4fe630bf50024fcbe2c051d2dffe5ea19695b2d660ce4db7a5acdcc30'
    l2Provider = new JsonRpcProvider(Config.L2NodeUrlWithPort())
    l2Wallet = new Wallet(key).connect(l2Provider)
    // l2Wallet = await l2Provider.getSigner()
  })

  it('should read the event correctly', async () => {
    const initialAmount = 1000
    const tokenName = 'OVM Test'
    const tokenDecimals = 8
    const TokenSymbol = 'TOK'

    const implFactory = new ContractFactory(
      erc20Json.abi,
      erc20Json.bytecode,
      l2Wallet
    )
    const impl = await implFactory.deploy(initialAmount, tokenName, tokenDecimals, TokenSymbol)
    await impl.deployTransaction.wait()

    // erc20Json.abi[0].inputs = []
    const proxyFactory = new ContractFactory(
      upgradeableProxyJson.abi,
      // [...erc20Json.abi, ...upgradeableProxyJson.abi],
      upgradeableProxyJson.bytecode,
      l2Wallet
    )
    const proxy = await proxyFactory.deploy(impl.address, Buffer.from(''))
    await proxy.deployTransaction.wait()

    const contract = new Contract(proxy.address, erc20Json.abi, l2Wallet)

    const _transfer = async (to, amount) => {
      const transferTx = await contract.transfer(to, amount);
      await transferTx.wait();
    };

    // Make 2x Transfer
    const recipient = '0x0000000000000000000000000000000000000000';
    await _transfer(recipient, '1');
    await _transfer(recipient, '1');

    const _queryFilterTransfer = async (queryContract, filterContract) => {
      // Get the filter
      const filter = filterContract.filters.Transfer(null, null, null);
      // Query the filter
      return queryContract.queryFilter(filter, 0, 'latest');
    };

    expect((await _queryFilterTransfer(impl, impl)).length).to.eq(0)
    expect((await _queryFilterTransfer(impl, contract)).length).to.eq(0)
    expect((await _queryFilterTransfer(contract, impl)).length).to.eq(2)
    expect((await _queryFilterTransfer(contract, contract)).length).to.eq(2)
  })
})
