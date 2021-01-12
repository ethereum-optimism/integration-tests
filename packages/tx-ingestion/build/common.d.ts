import { Provider } from '@ethersproject/providers';
export declare const mnemonic: string;
export declare const getL1Provider: () => Provider;
export declare const getl2Provider: () => Provider;
export declare class Config {
    static L1NodeUrlWithPort(): string;
    static L2NodeUrlWithPort(): string;
    static Mnemonic(): string;
    static CanonicalTransactionChainContractAddress(): string;
    static AddressResolverAddress(): string;
    static StateCommitmentChainContractAddress(): string;
    static SequencerPrivateKey(): string;
    static DeployerUrl(): string;
    static DeployerPrivateKey(): string;
    static TargetGasLimit(): number;
    static ChainID(): number;
}
export declare const sleep: (m: any) => Promise<unknown>;
export declare const poll: (functionToCall: Function, timeout: number, successCondition?: Function, pollInterval?: number) => Promise<any>;
export declare const etherbase = "0x9858EfFD232B4033E47d90003D41EC34EcaEda94";
