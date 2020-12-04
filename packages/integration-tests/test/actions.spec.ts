import { Config } from '../../../common'
import { Web3Provider } from '@ethersproject/providers'
import { ganache } from '@eth-optimism/ovm-toolchain'
import assert = require('assert')

const {
  Contract,
  ContractFactory,
  providers: { JsonRpcProvider },
  Wallet,
} = require('ethers');
const fs = require('fs')

const sleep = ms => new Promise(resolve => setTimeout(resolve, ms))

let SimpleStorage
let L2Messenger
const L1_USER_PRIVATE_KEY = process.env.L1_USER_PRIVATE_KEY
const L2_USER_PRIVATE_KEY = process.env.L2_USER_PRIVATE_KEY
const goerliURL = process.env.L1_URL
const optimismURL = process.env.L2_URL
const l1Provider = new JsonRpcProvider(goerliURL)
const l2Provider = new JsonRpcProvider(optimismURL)
const l1Wallet = new Wallet(L1_USER_PRIVATE_KEY, l1Provider)
const l2Wallet = new Wallet(L2_USER_PRIVATE_KEY, l2Provider)
const messengerJSON = JSON.parse(fs.readFileSync('contracts/build/iOVM_BaseCrossDomainMessenger.json'))
const l2MessengerJSON = JSON.parse(fs.readFileSync('contracts/build/OVM_L2CrossDomainMessenger.json'))

const deploySimpleStorage = async () => {
  const SimpleStorageJson = JSON.parse(fs.readFileSync('contracts/build/SimpleStorage.json'))
  const SimpleStorageFactory = new ContractFactory(SimpleStorageJson.abi, SimpleStorageJson.bytecode, l2Wallet)
  SimpleStorage = await SimpleStorageFactory.deploy()
  console.log('Deployed SimpleStorage to', SimpleStorage.address)
}

const deposit = async (amount) => {
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
    console.log('sleeping...')
    await sleep(5000)
  }
}

describe('Messages', async () => {
  let provider

  before(async () => {
    const web3 = new Web3Provider(
      ganache.provider({
        mnemonic: Config.Mnemonic(),
      })
    )
  })

  it('should deploy the simple storage contract', async () => {
    await deploySimpleStorage()
  })

  it('should deposit from L1->L2', async () => {
    await deposit(1)
    const msgSender = await SimpleStorage.msgSender()
    const l1ToL2Sender = await SimpleStorage.l1ToL2Sender()
    const storageVal = await SimpleStorage.value()
    const count = await SimpleStorage.totalCount()

    msgSender.should.be.eq('0x4200000000000000000000000000000000000007')
    l1ToL2Sender.should.be.eq('0x023fFdC1530468eb8c8EEbC3e38380b5bc19Cc5d')
    storageVal.should.be.eq('0x4242424242424242424242424242424242424242424242424242424242424242')
    count.toNumber().should.be.eq(1)
  })
})