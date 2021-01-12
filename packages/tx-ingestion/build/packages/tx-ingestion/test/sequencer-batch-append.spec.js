"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
const common_1 = require("../../../common");
const providers_1 = require("@ethersproject/providers");
const ovm_toolchain_1 = require("@eth-optimism/ovm-toolchain");
const provider_1 = require("@eth-optimism/provider");
const ethereum_waffle_1 = require("ethereum-waffle");
const assert = require("assert");
const ERC20 = require("../../../contracts/build/ERC20.json");
describe('Queue Origin Sequencer Transactions', () => {
    let optimismProvider;
    let provider;
    let token;
    let signer;
    before(async () => {
        const web3 = new providers_1.Web3Provider(ovm_toolchain_1.ganache.provider({
            mnemonic: common_1.Config.Mnemonic(),
        }));
        optimismProvider = new provider_1.OptimismProvider(common_1.Config.L2NodeUrlWithPort(), web3);
        provider = new providers_1.JsonRpcProvider(common_1.Config.L2NodeUrlWithPort());
    });
    const initalSupply = 1000;
    before(async () => {
        const pre = await provider.getBlock('latest');
        signer = await provider.getSigner();
        token = await ethereum_waffle_1.deployContract(signer, ERC20, [initalSupply, 'Foo', 8, 'FOO']);
        do {
            const tip = await provider.getBlock('latest');
            await common_1.sleep(5000);
            if (tip.number === pre.number + 1) {
                break;
            }
        } while (true);
    });
    it('should sequencer batch append', async () => {
        const chainId = await signer.getChainId();
        const address = await signer.getAddress();
        const nonce = await provider.getTransactionCount(address);
        const result = await token.transfer(common_1.etherbase, 1);
        const receipt = await result.wait();
        assert(receipt);
    });
});
//# sourceMappingURL=sequencer-batch-append.spec.js.map