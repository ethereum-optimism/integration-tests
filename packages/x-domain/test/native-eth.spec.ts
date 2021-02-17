import { expect } from 'chai'
import assert = require('assert')
import { JsonRpcProvider, TransactionResponse } from '@ethersproject/providers'

import { Config } from '../../../common'
import { Watcher } from '@eth-optimism/watcher'
import { getContractInterface, getContractFactory } from '@eth-optimism/contracts'
import l1SimnpleStorageJson = require('../../../contracts/build/SimpleStorage.json')
import l2SimpleStorageJson = require('../../../contracts/build-ovm/SimpleStorage.json')
import erc20Json = require('../../../contracts/build-ovm/ERC20.json')

import { utils, BigNumber } from 'ethers'

import { hexStrToNumber } from '@eth-optimism/core-utils'


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

const waitForCrossChainTransactions = async (tx: Promise<TransactionResponse>) => {
  const res = await tx
  const [msgHash] = await watcher.getMessageHashesFromL1Tx(res.hash)
  await watcher.getL2TransactionReceipt(msgHash)
}


    // const deposit = async (OVM_L1ETHGateway: Contract, value) => {
    //   const depositTx = 
    //   await depositTx.wait()

    //   const [msgHash] = await watcher.getMessageHashesFromL1Tx(depositTx.hash)
    //   const receipt = await watcher.getL2TransactionReceipt(msgHash)
    // }

    // const withdraw = async (value) => {
      
    // }

describe.only('Native ETH', async () => {
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
      getContractInterface('OVM_L1ETHGateway'),
      l1Wallet
    )

    OVM_ETH = new Contract(
      OVM_ETH_ADDRESS,
      getContractInterface('OVM_ETH'),
      l2Wallet
    )
  })

  it('deposit', async () => {
    const depositAmount = 1
    await logBalances('pre deposit')
    const preBalances = await getBalances()

    await waitForCrossChainTransactions(
      OVM_L1ETHGateway.deposit({
        value: depositAmount,
        gasLimit: '0x100000'
      })
    )
    
    const postBalances = await getBalances()
    await logBalances('post deposit')

    expect(postBalances.l1GatewayBalance).to.deep.eq(preBalances.l1GatewayBalance.add(depositAmount))
    expect(postBalances.l1UserBalance).to.deep.eq(preBalances.l1UserBalance.sub(depositAmount))
    expect(postBalances.l2UserBalance).to.deep.eq(preBalances.l2UserBalance.add(depositAmount))

  })
})
