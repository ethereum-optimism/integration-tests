"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.etherbase = exports.poll = exports.sleep = exports.Config = exports.getl2Provider = exports.getL1Provider = exports.mnemonic = void 0;
const path = require("path");
const chai = require("chai");
const dotenv = require("dotenv");
const chaiAsPromised = require("chai-as-promised");
const providers_1 = require("@ethersproject/providers");
chai.use(chaiAsPromised);
const should = chai.should();
if (process.env.NODE_ENV === 'local') {
    const envPath = path.join(__dirname, '/.env');
    dotenv.config({ path: envPath });
}
exports.mnemonic = process.env.MNEMONIC ||
    'abandon abandon abandon abandon abandon abandon ' +
        'abandon abandon abandon abandon abandon about';
let l1Provider;
exports.getL1Provider = () => {
    if (!l1Provider) {
        l1Provider = new providers_1.JsonRpcProvider(Config.L1NodeUrlWithPort());
    }
    return l1Provider;
};
let l2Provider;
exports.getl2Provider = () => {
    if (!l2Provider) {
        l2Provider = new providers_1.JsonRpcProvider(Config.L2NodeUrlWithPort());
    }
    return l2Provider;
};
class Config {
    static L1NodeUrlWithPort() {
        return process.env.L1_NODE_WEB3_URL;
    }
    static L2NodeUrlWithPort() {
        return process.env.L2_NODE_WEB3_URL;
    }
    static Mnemonic() {
        return process.env.MNEMONIC || exports.mnemonic;
    }
    static CanonicalTransactionChainContractAddress() {
        return process.env.CANONICAL_TRANSACTION_CHAIN_CONTRACT_ADDRESS;
    }
    static AddressResolverAddress() {
        return process.env.ETH1_ADDRESS_RESOLVER_ADDRESS;
    }
    static StateCommitmentChainContractAddress() {
        return process.env.STATE_COMMITMENT_CHAIN_CONTRACT_ADDRESS;
    }
    static SequencerPrivateKey() {
        return process.env.SEQUENCER_PRIVATE_KEY;
    }
    static DeployerUrl() {
        return process.env.DEPLOYER_URL || 'http://localhost:8080';
    }
    static DeployerPrivateKey() {
        return process.env.DEPLOYER_PRIVATE_KEY;
    }
    static TargetGasLimit() {
        const targetGasLimit = process.env.TARGET_GAS_LIMIT || '8000000';
        return parseInt(targetGasLimit, 10);
    }
    static ChainID() {
        const chainid = process.env.CHAIN_ID || '420';
        return parseInt(chainid, 10);
    }
}
exports.Config = Config;
exports.sleep = (m) => new Promise((r) => setTimeout(r, m));
exports.poll = async (functionToCall, timeout, successCondition = (res) => res !== null && res.length !== 0, pollInterval = 100) => {
    for (let i = 0; i < timeout; i += pollInterval) {
        const res = await functionToCall();
        if (successCondition(res)) {
            return res;
        }
        await exports.sleep(pollInterval);
    }
};
exports.etherbase = '0x9858EfFD232B4033E47d90003D41EC34EcaEda94';
//# sourceMappingURL=common.js.map