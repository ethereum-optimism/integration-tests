const path = require('path')
const solc = require.resolve('solc')

module.exports = {
  compilerVersion: path.dirname(solc),
  sourceDirectory: path.join(__dirname, 'contracts'),
  outputDirectory: path.join(__dirname, '..', '..', 'contracts', 'build'),
}
