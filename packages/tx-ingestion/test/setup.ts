/* External Imports */
import chai = require('chai')
import chaiAsPromised = require('chai-as-promised')

chai.use(chaiAsPromised)
const should = chai.should()

// Commonly used test mnemonic
export const mnemonic =
  'abandon abandon abandon abandon abandon abandon ' +
  'abandon abandon abandon abandon abandon about'

// Address derived at m/44'/60'/0'/0 of test mnemonic
export const etherbase = '0x9858EfFD232B4033E47d90003D41EC34EcaEda94'
