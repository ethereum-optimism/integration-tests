"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
const chai_1 = require("chai");
const assert = require("assert");
const providers_1 = require("@ethersproject/providers");
const common_1 = require("../../../common");
const watcher_1 = require("@eth-optimism/watcher");
const contracts_1 = require("@eth-optimism/contracts");
const simpleStorageJson = require("../../../contracts/build-ovm/SimpleStorage.json");
const l1SimnpleStorageJson = require("../../../contracts/build/L1SimpleStorage.json");
const erc20Json = require("../../../contracts/build-ovm/ERC20.json");
const ethers_1 = require("ethers");
let erc20;
const simpleStorage = null;
let l1SimpleStorage;
let l1MessengerAddress;
let l2MessengerAddress;
const L1_USER_PRIVATE_KEY = common_1.Config.DeployerPrivateKey();
const L2_USER_PRIVATE_KEY = common_1.Config.DeployerPrivateKey();
const SEQUENCER_PRIVATE_KEY = common_1.Config.SequencerPrivateKey();
const goerliURL = common_1.Config.L1NodeUrlWithPort();
const optimismURL = common_1.Config.L2NodeUrlWithPort();
const l1Provider = new providers_1.JsonRpcProvider(goerliURL);
const l2Provider = new providers_1.JsonRpcProvider(optimismURL);
const l1Wallet = new ethers_1.Wallet(L1_USER_PRIVATE_KEY, l1Provider);
const l2Wallet = new ethers_1.Wallet(L2_USER_PRIVATE_KEY, l2Provider);
const l1MessengerJSON = contracts_1.getContractInterface('iOVM_BaseCrossDomainMessenger');
const l2MessengerJSON = contracts_1.getContractFactory('OVM_L2CrossDomainMessenger');
const addressManagerAddress = common_1.Config.AddressResolverAddress();
const addressManagerInterface = contracts_1.getContractInterface('Lib_AddressManager');
const AddressManager = new ethers_1.Contract(addressManagerAddress, addressManagerInterface, l1Provider);
const simpleStorageFactory = new ethers_1.ContractFactory(simpleStorageJson.abi, simpleStorageJson.bytecode, l2Wallet);
const l1SimpleStorageFactory = new ethers_1.ContractFactory(l1SimnpleStorageJson.abi, l1SimnpleStorageJson.bytecode, l1Wallet);
const ERC20Factory = new ethers_1.ContractFactory(erc20Json.abi, erc20Json.bytecode, l2Wallet);
let watcher;
const initWatcher = async () => {
    l1MessengerAddress = await AddressManager.getAddress('Proxy__OVM_L1CrossDomainMessenger');
    l2MessengerAddress = await AddressManager.getAddress('OVM_L2CrossDomainMessenger');
    return new watcher_1.Watcher({
        l1: {
            provider: l1Provider,
            messengerAddress: l1MessengerAddress
        },
        l2: {
            provider: l2Provider,
            messengerAddress: l2MessengerAddress
        }
    });
};
const deposit = async (amount, value) => {
    const L1Messenger = new ethers_1.Contract(l1MessengerAddress, l1MessengerJSON, l1Wallet);
    const calldata = simpleStorage.interface.encodeFunctionData('setValue', [value]);
    const l1ToL2Tx = await L1Messenger.sendMessage(simpleStorage.address, calldata, 5000000, { gasLimit: 7000000 });
    await l1ToL2Tx.wait();
    const [msgHash] = await watcher.getMessageHashesFromL1Tx(l1ToL2Tx.hash);
    const receipt = await watcher.getL2TransactionReceipt(msgHash);
};
const withdraw = async (value) => {
    const L2Messenger = new ethers_1.Contract(l2MessengerAddress, l2MessengerJSON.interface, l2Wallet);
    const calldata = l1SimpleStorage.interface.encodeFunctionData('setValue', [value]);
    const l2ToL1Tx = await L2Messenger.sendMessage(l1SimpleStorage.address, calldata, 5000000, { gasLimit: 7000000 });
    await l2ToL1Tx.wait();
    const [msgHash] = await watcher.getMessageHashesFromL2Tx(l2ToL1Tx.hash);
    const receipt = await watcher.getL1TransactionReceipt(msgHash);
};
describe('SimpleStorage', async () => {
    before(async () => {
        watcher = await initWatcher();
        l1SimpleStorage = await l1SimpleStorageFactory.deploy();
        await l1SimpleStorage.deployTransaction.wait();
    });
    it.skip('should deposit from L1->L2', async () => {
        const value = `0x${'42'.repeat(32)}`;
        await deposit(1, value);
        const msgSender = await simpleStorage.msgSender();
        const l1ToL2Sender = await simpleStorage.l1ToL2Sender();
        const storageVal = await simpleStorage.value();
        const count = await simpleStorage.totalCount();
        msgSender.should.be.eq(l2MessengerAddress);
        l1ToL2Sender.should.be.eq(l1Wallet.address);
        storageVal.should.be.eq(value);
        count.toNumber().should.be.eq(1);
    });
    it('should withdraw from L2->L1', async () => {
        const value = `0x${'77'.repeat(32)}`;
        await withdraw(value);
        const msgSender = await l1SimpleStorage.msgSender();
        const l2ToL1Sender = await l1SimpleStorage.l2ToL1Sender();
        const storageVal = await l1SimpleStorage.value();
        const count = await l1SimpleStorage.totalCount();
        msgSender.should.be.eq(l1MessengerAddress);
        l2ToL1Sender.should.be.eq(l2Wallet.address);
        storageVal.should.be.eq(value);
        count.toNumber().should.be.eq(1);
    });
});
describe('ERC20', async () => {
    const alice = new ethers_1.Wallet(SEQUENCER_PRIVATE_KEY, l2Provider);
    const INITIAL_AMOUNT = 1000;
    const NAME = 'OVM Test';
    const DECIMALS = 8;
    const SYMBOL = 'OVM';
    before(async () => {
        erc20 = await ERC20Factory.deploy(INITIAL_AMOUNT, NAME, DECIMALS, SYMBOL);
    });
    it('should set the total supply', async () => {
        const totalSupply = await erc20.totalSupply();
        chai_1.expect(totalSupply.toNumber()).to.equal(INITIAL_AMOUNT);
    });
    it('should get the token name', async () => {
        const name = await erc20.name();
        chai_1.expect(name).to.equal(NAME);
    });
    it('should get the token decimals', async () => {
        const decimals = await erc20.decimals();
        chai_1.expect(decimals).to.equal(DECIMALS);
    });
    it('should get the token symbol', async () => {
        const symbol = await erc20.symbol();
        chai_1.expect(symbol).to.equal(SYMBOL);
    });
    it('should assign initial balance', async () => {
        const balance = await erc20.balanceOf(l2Wallet.address);
        chai_1.expect(balance.toNumber()).to.equal(INITIAL_AMOUNT);
    });
    it('should transfer amount to destination account', async () => {
        const transfer = await erc20.transfer(alice.address, 100);
        const receipt = await transfer.wait();
        assert.strictEqual(receipt.events.length, 2);
        const transferFeeEvent = receipt.events[0];
        const transferEvent = receipt.events[1];
        assert.strictEqual(transferEvent.args._from, l1Wallet.address);
        assert.strictEqual(transferFeeEvent.args._value.toString(), '0');
        assert.strictEqual(transferEvent.args._value.toString(), '100');
        const receiverBalance = await erc20.balanceOf(alice.address);
        chai_1.expect(receiverBalance.toNumber()).to.equal(100);
        const senderBalance = await erc20.balanceOf(l2Wallet.address);
        chai_1.expect(senderBalance.toNumber()).to.equal(900);
    });
});
//# sourceMappingURL=actions.spec.js.map