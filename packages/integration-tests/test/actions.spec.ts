import { Config } from '../../../common'
import { Web3Provider } from '@ethersproject/providers'
import { ganache } from '@eth-optimism/ovm-toolchain'
import assert = require('assert')

// TODO Clean up
const {
  Contract,
  ContractFactory,
  providers: { JsonRpcProvider },
  Wallet,
} = require('ethers');
const fs = require('fs')

const sleep = ms => new Promise(resolve => setTimeout(resolve, ms))

// TODO - clean up
const L1_USER_PRIVATE_KEY = '0x754fde3f5e60ef2c7649061e06957c29017fe21032a8017132c0078e37f6193a'
const L2_USER_PRIVATE_KEY = '0x29f3edee0ad3abf8e2699402e0e28cd6492c9be7eaab00d732a791c33552f797'
// L1_URL = 'http://0.0.0.0:9545/'
// L2_URL = 'http://0.0.0.0:8545/'
// L1_MESSENGER_ADDRESS = '0x6418E5Da52A3d7543d393ADD3Fa98B0795d27736'
// L2_MESSENGER_ADDRESS = '0x4200000000000000000000000000000000000007'
const goerliURL = 'http://0.0.0.0:9545/'
const optimismURL = 'http://0.0.0.0:8545/'
const l1Provider = new JsonRpcProvider(goerliURL)
const l2Provider = new JsonRpcProvider(optimismURL)

const l1Wallet = new Wallet(L1_USER_PRIVATE_KEY, l1Provider)
const l2Wallet = new Wallet(L2_USER_PRIVATE_KEY, l2Provider)

const messengerJSON = JSON.parse(fs.readFileSync('contracts/build/iOVM_BaseCrossDomainMessenger.json'))
const l2MessengerJSON = JSON.parse(fs.readFileSync('contracts/build/OVM_L2CrossDomainMessenger.json'))

let SimpleStorage
let L2Messenger
const deploySimpleStorage = async () => {
  const SimpleStorageJson = JSON.parse(fs.readFileSync('contracts/build/SimpleStorage.json'))
  const SimpleStorageFactory = new ContractFactory(SimpleStorageJson.abi, SimpleStorageJson.bytecode, l2Wallet)
  SimpleStorage = await SimpleStorageFactory.deploy()
  console.log('Deployed SimpleStorage to', SimpleStorage.address)
  await sleep(1000)
}

const deposit = async (amount) => {
  console.log(process.env.L1_MESSENGER_ADDRESS)
  console.log(process.env.L2_MESSENGER_ADDRESS)
  const L1Messenger = new Contract(process.env.L1_MESSENGER_ADDRESS, messengerJSON.abi, l1Wallet)
  L2Messenger = new Contract(process.env.L2_MESSENGER_ADDRESS, l2MessengerJSON.abi, l2Wallet)

  const calldata = SimpleStorage.interface.encodeFunctionData('setValue', [`0x${'42'.repeat(32)}`])
  const l1ToL2Tx = await L1Messenger.sendMessage(
    SimpleStorage.address,
    calldata,
    5000000,
    { gasLimit: 7000000 }
  )
  await l1Provider.waitForTransaction(l1ToL2Tx.hash)
  console.log('L1->L2 setValue tx complete: https://goerli.etherscan.io/tx/' + l1ToL2Tx.hash)
  const count = (await SimpleStorage.totalCount()).toString()
  while (count == (await SimpleStorage.totalCount()).toString()) {
    console.log('total count', (await SimpleStorage.totalCount()).toString())
    console.log('sleeping...')

    await l1Provider.send("evm_mine")
    await sleep(5000)
  }
  console.log('simple storage msg.sender', await SimpleStorage.msgSender())
  console.log('simple storage xDomainMessageSender', await SimpleStorage.l1ToL2Sender())
  console.log('simple storage value', await SimpleStorage.value())
  console.log('totalCount', (await SimpleStorage.totalCount()).toString())
}

describe('Transactions', async () => {
  let provider

  before(async () => {
    const web3 = new Web3Provider(
      ganache.provider({
        mnemonic: Config.Mnemonic(),
      })
    )
  })

  it('should deposit from L1->L2', async () => {
    try {
      await deploySimpleStorage()
      await deposit(1)
    } catch (err) {
      console.error('Error detected:', err)
    }
  })
})