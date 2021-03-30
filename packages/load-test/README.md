# Load Tests

To run these load tests against a live network, you must specify a `DEPLOYER_PRIVATE_KEY` that holds ETH:
```
L1_NODE_WEB3_URL=https://eth-kovan.alchemyapi.io/v2/API_KEY \
L2_NODE_WEB3_URL=http://kovan.optimism.io \
DEPLOYER_PRIVATE_KEY=0x... \
ETH1_ADDRESS_RESOLVER_ADDRESS=0x72e6F5244828C10737cbC9659378B207246D26B2 \
yarn test:load-test
```
If you have already deployed the helper contracts and would like to use these existing contracts with your load tests, you can specify their addresses:
```
L2_DEPOSIT_TRACKER_ADDRESS=0x903318bF1157Cbb30F669DAA698487fbD005eF68 \
L1_DEPOSIT_INITIATOR_ADDRESS=0x57ad067240aC0A64801c04bD218189039Ed8461C \
L2_TX_STORAGE_ADDRESS=0x3B6442159b6c43cC9125892C12e74e1C3EB3ad20 \
L1_NODE_WEB3_URL=https://eth-kovan.alchemyapi.io/v2/API_KEY \
L2_NODE_WEB3_URL=http://kovan.optimism.io \
DEPLOYER_PRIVATE_KEY=0x... \
ETH1_ADDRESS_RESOLVER_ADDRESS=0x72e6F5244828C10737cbC9659378B207246D26B2 \
yarn test:load-test
```
