"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
const common_1 = require("../../../common");
const providers_1 = require("@ethersproject/providers");
const wallet_1 = require("@ethersproject/wallet");
const core_utils_1 = require("@eth-optimism/core-utils");
const ovm_toolchain_1 = require("@eth-optimism/ovm-toolchain");
const provider_1 = require("@eth-optimism/provider");
const contracts_1 = require("@eth-optimism/contracts");
const assert = require("assert");
describe('Transaction Ingestion', () => {
    let l1Provider;
    let l1Signer;
    let l2Signer;
    let l2Provider;
    let addressResolver;
    let canonicalTransactionChain;
    let ctcAddress;
    const mnemonic = common_1.Config.Mnemonic();
    let pre;
    before(async () => {
        l1Provider = new providers_1.JsonRpcProvider(common_1.Config.L1NodeUrlWithPort());
        l1Signer = new wallet_1.Wallet(common_1.Config.DeployerPrivateKey()).connect(l1Provider);
        const web3 = new providers_1.Web3Provider(ovm_toolchain_1.ganache.provider({
            mnemonic,
        }));
        l2Provider = new provider_1.OptimismProvider(common_1.Config.L2NodeUrlWithPort(), web3);
        l2Signer = await l2Provider.getSigner();
        const addressResolverAddress = core_utils_1.add0x(common_1.Config.AddressResolverAddress());
        const AddressResolverFactory = contracts_1.getContractFactory('Lib_AddressManager');
        addressResolver = AddressResolverFactory.connect(l1Signer).attach(addressResolverAddress);
        ctcAddress = await addressResolver.getAddress('OVM_CanonicalTransactionChain');
        const CanonicalTransactionChainFactory = contracts_1.getContractFactory('OVM_CanonicalTransactionChain');
        canonicalTransactionChain = CanonicalTransactionChainFactory.connect(l1Signer).attach(ctcAddress);
    });
    const receipts = [];
    it('should enqueue some transactions', async () => {
        pre = await l2Provider.getBlock('latest');
        for (let i = 0; i < 5; i++) {
            const input = ['0x' + `${i + 1}`.repeat(40), 500000, `0x0${i}`];
            const calldata = await canonicalTransactionChain.interface.encodeFunctionData('enqueue', input);
            const txResponse = await l1Signer.sendTransaction({
                data: calldata,
                to: ctcAddress,
            });
            const receipt = await txResponse.wait();
            receipts.push(receipt);
        }
        for (const receipt of receipts) {
            receipt.should.be.a('object');
        }
    });
    it('should order transactions correctly', async () => {
        let tip;
        do {
            tip = await l2Provider.getBlock('latest');
            await common_1.sleep(5000);
        } while (tip.number !== pre.number + 5);
        const from = await l1Signer.getAddress();
        let receiptIndex = 0;
        for (let i = pre.number + 1; i < pre.number + 5; i++) {
            const block = await l2Provider.getBlock(i);
            const hash = block.transactions[0];
            assert(typeof hash === 'string');
            const tx = await l2Provider.getTransaction(hash);
            assert.equal(tx.to, '0x' + `${i}`.repeat(40));
            assert.equal(tx.txType, 'EIP155');
            assert.equal(tx.queueOrigin, 'l1');
            assert.equal(tx.l1TxOrigin, from.toLowerCase());
            assert.equal(typeof tx.l1BlockNumber, 'number');
            const receipt = receipts[receiptIndex++];
            assert.equal(tx.l1BlockNumber, receipt.blockNumber);
        }
    }).timeout(100000);
});
//# sourceMappingURL=batch-append.spec.js.map