# Integration Tests

Typescript based integration test repo for Optimistic Ethereum.

Test suites are defined as a package in the `packages` directory.
This repo can be ran on its own or as part of
[Optimism Integration](https://github.com/ethereum-optimism/optimism-integration).


## Running with Optimism Integration

The [Optimism Integration](https://github.com/ethereum-optimism/optimism-integration)
repo can be used to automatically configure and run the test suites found
in this repo. See the [README](https://github.com/ethereum-optimism/optimism-integration/blob/master/README.md)
for usage information.

It is assumed that each test suite gets a fresh state when running this way.
This means that the packages must not depend on each other.

Docker images found on [Dockerhub](https://hub.docker.com/u/ethereumoptimism)
are used when running the test suites this way.

## Running locally

This repo can be ran locally against existing services but the configuration
must be handled by the user. A `.env` file will be used to populate the
configuration when then environment variable `NODE_ENV` is set to `local`.

There should be a `yarn` script for each package found in `packages`.

```bash
$ yarn test:x-domain
$ yarn test:tx-ingestion
$ yarn test:sequencer-interactions
$ yarn test:synthetix
```

The environment variables that are used by this repository can be found in
the `Config` class in `common.ts`.

| Environment Variable            | Description |
| -----------                     | ----------- |
| `L1_NODE_WEB3_URL`              | L1 HTTP endpoint |
| `L2_NODE_WEB3_URL`              | L2 HTTP endpoint |
| `MNEMONIC`                      | Mnemonic used to derive keys |
| `ETH1_ADDRESS_RESOLVER_ADDRESS` | Address Resolver Address |
| `SEQUENCER_PRIVATE_KEY`         | Private key used by sequencer |
| `DEPLOYER_PRIVATE_KEY`          | Private key used by deployer |
| `TARGET_GAS_LIMIT`              | L2 gas limit |
| `CHAIN_ID`                      | L2 Chain ID |


The test suites must not run in parallel.
