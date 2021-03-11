import { expect } from 'chai'
import { JsonRpcProvider } from '@ethersproject/providers'
import { ContractFactory, Wallet } from 'ethers'
import { Config } from '../../../common'
import erc20Json = require('../../../contracts/build-ovm/ERC20.json')

describe('Read proxy event', () => {
  let l2Provider: JsonRpcProvider
  let l2Wallet: Wallet

  const mnemonic = Config.Mnemonic()

  before(async () => {
    // l1Provider = new JsonRpcProvider(Config.L1NodeUrlWithPort())
    // l1Signer = new Wallet(Config.DeployerPrivateKey()).connect(l1Provider))
    l2Provider = new JsonRpcProvider(Config.L2NodeUrlWithPort())
    l2Wallet = new Wallet(Config.DeployerPrivateKey()).connect(l2Provider)
    // l2Wallet = await l2Provider.getSigner()
  })

  it('should read the event correctly', async () => {
    const implFactory = new ContractFactory(
      [...erc20Json.abi], 
      erc20Json.bytecode, 
     l2Wallet 
    )
    const impl = await implFactory.deploy([])

    // TODO(annie): copy over factory and compile during test
    const proxyFactory = new ContractFactory(
      [...erc20Json.abi], // need to add upgradable contract abi
      erc20Json.bytecode, // use upgradeableProxy here 
     l2Wallet 
    )
    const contract = await proxyFactory.deploy([impl.address, Buffer.from("")])

    // Init ERC20 contract
    const payload = ["1000", "TOK", {gasPrice: 0, gasLimit: 8999999 }];
    const initTx = await contract.init(...payload);
    await initTx.wait();

    const _transfer = async (to, amount) => {
      const transferTx = await contract.transfer(to, amount);
      await transferTx.wait();
    };
  
    // Make 2x Transfer
    const to = "0x0000000000000000000000000000000000000000";
    await _transfer(to, "1");
    await _transfer(to, "1");
  
    const _queryFilterTransfer = async (queryContract, filterContract) => {
      // Get the filter
      const filter = filterContract.filters.Transfer(null, null, null);
      // Query the filter
      return await queryContract.queryFilter(filter, 0, "latest");
    };

    expect((await _queryFilterTransfer(impl, impl)).length).to.eq(0)
    expect((await _queryFilterTransfer(impl, contract)).length).to.eq(0)
    expect((await _queryFilterTransfer(contract, impl)).length).to.eq(2)
    expect((await _queryFilterTransfer(contract, contract)).length).to.eq(2)
  })
})
