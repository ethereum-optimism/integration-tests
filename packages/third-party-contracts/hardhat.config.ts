import { HardhatUserConfig } from 'hardhat/types'

import '@nomiclabs/hardhat-ethers'
import '@eth-optimism/plugins/hardhat/compiler'
import '@eth-optimism/plugins/hardhat/ethers'

const config: HardhatUserConfig = {
  solidity: {
    version: '0.7.6',
  },
  ovm: {
    solcVersion: '0.7.6',
  },
  mocha: {
    timeout: 100_000,
  },
}

export default config
