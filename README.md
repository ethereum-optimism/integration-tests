# @eth-optimism/integration-tests

Hello!
This is a TypeScript-based integration testing repository for Optimistic Ethereum.
Tests within this repository can be run locally or as part of [optimism-integration](https://github.com/ethereum-optimism/optimism-integration).

## Structure
Each test suite is defined as its own package inside the [./packages](./packages) directory.
This structure simplifies the process of executing test suites selectively.
Packages must not depend on one other.

## Running via optimism-integration
[optimism-integration](https://github.com/ethereum-optimism/optimism-integration) can be used to automatically configure and run the test suites found in this repository.
Docker images found on [Dockerhub](https://hub.docker.com/u/ethereumoptimism) are used when running the test suites this way.
Refer to the [README](https://github.com/ethereum-optimism/optimism-integration/blob/master/README.md) for detailed usage information.

## Running locally (aka how to write new tests)
Tests in this repository can be executed against a set of local services, but all configuration has to be handled by the user (aka you).
You'll probably need to do this if you plan to develop in this repo (e.g., to write new tests).

First, set up a `.env` file:
1. Make a copy of `.env.example` and name it `.env`.
2. Set the variables inside the `.env` file to your desired variables (default will likely suffice).

Now start up the services that you want to test.
The easiest way to run every Optimistic Ethereum service is to use the [up.sh](https://github.com/ethereum-optimism/optimism-integration/#upsh) script.
Follow the instructions in [optimism-integration](https://github.com/ethereum-optimism/optimism-integration#optimism-integration) to get this set up.

Finally, run the tests.
At the moment you'll need to set environment variable `NODE_ENV=local` to signal that you want to run these tests locally:
```bash
NODE_ENV=local yarn test
```

You can also run specific tests via:
```bash
$ yarn test:x-domain
$ yarn test:tx-ingestion
$ yarn test:sequencer-interactions
```

## Configuration
The environment variables that are used by this repository can be found in the `Config` class within `common.ts`.

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
