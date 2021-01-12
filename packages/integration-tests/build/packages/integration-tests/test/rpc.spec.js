"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
const common_1 = require("../../../common");
const providers_1 = require("@ethersproject/providers");
const ovm_toolchain_1 = require("@eth-optimism/ovm-toolchain");
const provider_1 = require("@eth-optimism/provider");
const assert = require("assert");
const DUMMY_ADDRESS = '0x' + '1234'.repeat(10);
describe('Transactions', () => {
    let provider;
    before(async () => {
        const web3 = new providers_1.Web3Provider(ovm_toolchain_1.ganache.provider({
            mnemonic: common_1.Config.Mnemonic(),
        }));
        provider = new provider_1.OptimismProvider(common_1.Config.L2NodeUrlWithPort(), web3);
    });
    it('should send eth_sendRawEthSignTransaction', async () => {
        const signer = provider.getSigner();
        const chainId = await signer.getChainId();
        const address = await signer.getAddress();
        const nonce = await provider.getTransactionCount(address);
        const tx = {
            to: DUMMY_ADDRESS,
            nonce,
            gasLimit: 4000000,
            gasPrice: 0,
            data: '0x',
            value: 0,
            chainId,
        };
        const hex = await signer.signTransaction(tx);
        const txid = await provider.send('eth_sendRawEthSignTransaction', [hex]);
        await provider.waitForTransaction(txid);
        const transaction = await provider.getTransaction(txid);
        assert(transaction !== null);
        address.should.eq(transaction.from);
        tx.to.should.eq(transaction.to);
        tx.value.should.eq(transaction.value.toNumber());
        tx.nonce.should.eq(transaction.nonce);
        tx.gasLimit.should.eq(transaction.gasLimit.toNumber());
        tx.gasPrice.should.eq(transaction.gasPrice.toNumber());
        tx.data.should.eq(transaction.data);
        const receipt = await provider.getTransactionReceipt(txid);
        address.should.eq(receipt.from);
        tx.to.should.eq(receipt.to);
    });
    it('should sendTransaction', async () => {
        const signer = provider.getSigner();
        const chainId = await signer.getChainId();
        const address = await signer.getAddress();
        const nonce = await provider.getTransactionCount(address);
        const tx = {
            to: DUMMY_ADDRESS,
            nonce,
            gasLimit: 4000000,
            gasPrice: 0,
            data: '0x',
            value: 0,
            chainId,
        };
        const result = await signer.sendTransaction(tx);
        await result.wait();
        result.from.should.eq(address);
        tx.nonce.should.eq(result.nonce);
        tx.gasLimit.should.eq(result.gasLimit.toNumber());
        tx.gasPrice.should.eq(result.gasPrice.toNumber());
        tx.data.should.eq(result.data);
    });
    it('gas price should be 0', async () => {
        const price = await provider.getGasPrice();
        const num = price.toNumber();
        num.should.eq(0);
    });
    it.skip('should estimate gas', async () => {
        const template = {
            to: DUMMY_ADDRESS,
            gasLimit: 4000000,
            gasPrice: 0,
            value: 0,
            data: '',
        };
        const cases = ['0x', '0x' + '00'.repeat(256)];
        const estimates = [];
        for (const c of cases) {
            template.data = c;
            const estimate = await provider.estimateGas(template);
            estimates.push(estimate);
        }
        const targetGasLimit = common_1.Config.TargetGasLimit();
        for (const estimate of estimates) {
            estimate.toNumber().should.eq(targetGasLimit - 1);
        }
    });
    it('should get correct chainid', async () => {
        const chainId = await provider.send('eth_chainId', []);
        const expected = common_1.Config.ChainID();
        chainId.should.eq('0x' + expected.toString(16));
        parseInt(chainId, 16).should.eq(expected);
    });
    it('should get transaction (l2 metadata)', async () => {
        const tx = {
            to: DUMMY_ADDRESS,
            gasLimit: 4000000,
            gasPrice: 0,
            data: '0x',
            value: 0,
        };
        const signer = provider.getSigner();
        const result = await signer.sendTransaction(tx);
        await result.wait();
        const txn = await provider.getTransaction(result.hash);
        txn.txType.should.be.a('string');
        txn.queueOrigin.should.be.a('string');
    });
    it('should get block with transactions', async () => {
        const block = await provider.getBlockWithTransactions('latest');
        assert(block.number !== 0);
        assert(typeof block.stateRoot === 'string');
        assert(block.transactions.length === 1);
        const tx = block.transactions[0];
        assert(tx.txType === 'EthSign');
        assert(tx.queueOrigin === 'sequencer');
        assert(tx.l1TxOrigin === null);
    });
});
//# sourceMappingURL=rpc.spec.js.map