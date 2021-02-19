import { expect } from 'chai'
import assert = require('assert')
import { JsonRpcProvider, TransactionReceipt, TransactionResponse } from '@ethersproject/providers'

import { Config } from '../../../common'
import { Watcher } from '@eth-optimism/watcher'
import { getContractInterface, getContractFactory } from '@eth-optimism/contracts'
import l1SimnpleStorageJson = require('../../../contracts/build/SimpleStorage.json')
import l2SimpleStorageJson = require('../../../contracts/build-ovm/SimpleStorage.json')
import erc20Json = require('../../../contracts/build-ovm/ERC20.json')

import { utils, BigNumber, Transaction } from 'ethers'

const l1GatewayInterface = require('../temp/OVM_L1ETHGateway.json').abi // getContractInterface('OVM_L1ETHGateway') TODO: use this once the new npm contracts publish gives us access

import {
  Contract, ContractFactory, Wallet,
} from 'ethers'

let erc20
let l1SimpleStorage
let l2SimpleStorage
let l1MessengerAddress
let l2MessengerAddress
const L1_USER_PRIVATE_KEY = Config.DeployerPrivateKey()
const L2_USER_PRIVATE_KEY = Config.DeployerPrivateKey()
const SEQUENCER_PRIVATE_KEY = Config.SequencerPrivateKey()
const goerliURL = Config.L1NodeUrlWithPort()
const optimismURL = Config.L2NodeUrlWithPort()
const l1Provider = new JsonRpcProvider(goerliURL)
const l2Provider = new JsonRpcProvider(optimismURL)
const l1Wallet = new Wallet(L1_USER_PRIVATE_KEY, l1Provider)
const l2Wallet = new Wallet(L2_USER_PRIVATE_KEY, l2Provider)

const addressManagerAddress = Config.AddressResolverAddress()
const addressManagerInterface = getContractInterface('Lib_AddressManager')
const AddressManager = new Contract(addressManagerAddress, addressManagerInterface, l1Provider)

const OVM_ETH_ADDRESS = '0x4200000000000000000000000000000000000006'

let watcher
const initWatcher = async () => {
  l1MessengerAddress = await AddressManager.getAddress('Proxy__OVM_L1CrossDomainMessenger')
  l2MessengerAddress = await AddressManager.getAddress('OVM_L2CrossDomainMessenger')
  return new Watcher({
    l1: {
      provider: l1Provider,
      messengerAddress: l1MessengerAddress
    },
    l2: {
      provider: l2Provider,
      messengerAddress: l2MessengerAddress
    }
  })
}

type CrossDomainMessagePair = {
  l1tx: Transaction,
  l1receipt: TransactionReceipt,
  l2tx: Transaction, 
  l2receipt: TransactionReceipt}

const waitForDepositTypeTransaction = async (l1OriginatingTx: Promise<TransactionResponse>):Promise<CrossDomainMessagePair> => {
  console.log('await ing tx')
  const res = await l1OriginatingTx
  await res.wait()

  const l1tx = await l1Provider.getTransaction(res.hash)
  const l1receipt = await l1Provider.getTransactionReceipt(res.hash)
  console.log('await watcher.getMessageHashesFromL1Tx')
  const [l1ToL2XDomainMsgHash] = await watcher.getMessageHashesFromL1Tx(res.hash)
  console.log('await getL2TransactionReceipt')
  const l2receipt = await watcher.getL2TransactionReceipt(l1ToL2XDomainMsgHash) as TransactionReceipt
  const l2tx = await l2Provider.getTransaction(l2receipt.transactionHash)
  return {
    l1tx,
    l1receipt,
    l2tx,
    l2receipt
  }
}

// TODO: combine thes elegantly? v^v^v

const waitForWithdrawalTypeTransaction = async (l2OriginatingTx: Promise<TransactionResponse>):Promise<CrossDomainMessagePair> => {
  console.log('await ing l2 tx')
  const res = await l2OriginatingTx
  await res.wait()

  const l2tx = await l2Provider.getTransaction(res.hash)
  const l2receipt = await l2Provider.getTransactionReceipt(res.hash)
  console.log(`l2 receipt is: ${JSON.stringify(l2receipt)}`)
  console.log('await watcher.getMessageHashesFromL2Tx')
  const [l2ToL1XDomainMsgHash] = await watcher.getMessageHashesFromL2Tx(res.hash)
  console.log('await getL1TransactionReceipt')
  const l1receipt = await watcher.getL1TransactionReceipt(l2ToL1XDomainMsgHash) as TransactionReceipt
  const l1tx = await l1Provider.getTransaction(l1receipt.transactionHash)
  return {
    l2tx,
    l2receipt,
    l1tx,
    l1receipt
  }
}

describe.only('Native ETH Integration Tests', async () => {
  let OVM_L1ETHGateway: Contract 
  let OVM_ETH: Contract

  const logBalances = async (description: string = '') => {
    console.log('\n~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~ ' + description + ' ~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~')
      // const l1UserBalance = await l1Provider.send('eth_getBalance', [l1Wallet.address])
      // console.log('L1 balance of l1 wallet ', l1Wallet.address, 'is', l1UserBalance.toString(10))
      // const l1GatewayBalance = await l1Provider.send('eth_getBalance', [OVM_L1ETHGateway.address])
      // console.log('L1 balance of l1 gateway ', OVM_L1ETHGateway.address, 'is', l1GatewayBalance.toString())
      // const l2Balance = await OVM_ETH.balanceOf(l2Wallet.address)
      // console.log('L2 balance of l2 wallet ', l2Wallet.address, 'is', l2Balance.toString())\
    console.log(await getBalances())
    console.log('~'.repeat(description.length) + '~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~\n')
  }

  const getBalances = async ():
    Promise<{
      l1UserBalance: BigNumber,
      l2UserBalance: BigNumber,
      l1GatewayBalance: BigNumber
    }> => {
      const l1UserBalance = BigNumber.from(
        await l1Provider.send('eth_getBalance', [l1Wallet.address])
      )
      const l2UserBalance = await OVM_ETH.balanceOf(l2Wallet.address)
      const l1GatewayBalance = BigNumber.from(
        await l1Provider.send('eth_getBalance', [OVM_L1ETHGateway.address])
      )
      return {
        l1UserBalance,
        l2UserBalance,
        l1GatewayBalance
      }
    }
  
  before(async () => {
    watcher = await initWatcher()
    
    OVM_L1ETHGateway = new Contract(
      await AddressManager.getAddress('OVM_L1ETHGateway'),
      l1GatewayInterface,
      l1Wallet
    )

    OVM_ETH = new Contract(
      OVM_ETH_ADDRESS,
      getContractInterface('OVM_ETH'),
      l2Wallet
    )
  })

  it('deposit', async () => {
    const depositAmount = 10

    console.log('getting preBalances...')
    const preBalances = await getBalances()
    console.log(`got prebalances, they are: ${JSON.stringify(preBalances)}`)

    console.log('sending deposit TX...')
    const depositReceipts = await waitForDepositTypeTransaction(
      OVM_L1ETHGateway.deposit({
        value: depositAmount,
        gasLimit: '0x100000',
        gasPrice: 0
      })
    )
    const l1FeePaid = depositReceipts.l1receipt.gasUsed.mul(depositReceipts.l1tx.gasPrice) // TODO: this is broken for nonzero l1 gas price... what part of the calc is off?

    console.log('now getting postBalances')
    const postBalances = await getBalances()
    console.log(`got post-balances, they are: ${JSON.stringify(postBalances)}`)

    expect(postBalances.l1GatewayBalance).to.deep.eq(preBalances.l1GatewayBalance.add(depositAmount))
    expect(postBalances.l2UserBalance).to.deep.eq(preBalances.l2UserBalance.add(depositAmount))

    expect(postBalances.l1UserBalance).to.deep.eq(
      preBalances.l1UserBalance.sub(
        l1FeePaid.add(depositAmount)
      )
    )
  })

  it.only('withdraw', async () => {
    const withdrawAmount = 3

    const preBalances = await getBalances()
    console.log('got prebalances')
    expect(preBalances.l2UserBalance.gt(0), 'it-scoped test cannot be run without a preceeding deposit')

    await waitForWithdrawalTypeTransaction(
      OVM_ETH.withdraw(withdrawAmount)
    )

  })
})
