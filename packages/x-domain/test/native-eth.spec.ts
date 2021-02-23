import { expect } from 'chai'
import assert = require('assert')
import { AlchemyProvider, JsonRpcProvider, TransactionReceipt, TransactionResponse } from '@ethersproject/providers'

import { Config } from '../../../common'
import { Watcher } from '@eth-optimism/watcher'
import { getContractInterface, getContractFactory } from '@eth-optimism/contracts'

import { BigNumber, ethers, Transaction } from 'ethers'

const l1GatewayInterface = require('../temp/OVM_L1ETHGateway.json').abi // getContractInterface('OVM_L1ETHGateway') TODO: use this once the new npm contracts publish gives us access

import {
  Contract, ContractFactory, Wallet,
} from 'ethers'
import { Signer } from 'crypto'

let l1MessengerAddress
let l2MessengerAddress
const L1_USER_PRIVATE_KEY = Config.DeployerPrivateKey()
const L2_USER_PRIVATE_KEY = Config.DeployerPrivateKey()

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
const PROXY_SEQUENCER_ENTRYPOINT_ADDRESS = '0x4200000000000000000000000000000000000004'

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
  l2receipt: TransactionReceipt
}

const waitForDepositTypeTransaction = async (l1OriginatingTx: Promise<TransactionResponse>):Promise<CrossDomainMessagePair> => {
  const res = await l1OriginatingTx
  await res.wait()

  const l1tx = await l1Provider.getTransaction(res.hash)
  const l1receipt = await l1Provider.getTransactionReceipt(res.hash)
  const [l1ToL2XDomainMsgHash] = await watcher.getMessageHashesFromL1Tx(res.hash)
  const l2receipt = await watcher.getL2TransactionReceipt(l1ToL2XDomainMsgHash) as TransactionReceipt
  const l2tx = await l2Provider.getTransaction(l2receipt.transactionHash)

  return {
    l1tx,
    l1receipt,
    l2tx,
    l2receipt
  }
}

// TODO: combine these elegantly? v^v^v
const waitForWithdrawalTypeTransaction = async (l2OriginatingTx: Promise<TransactionResponse>):Promise<CrossDomainMessagePair> => {
  const res = await l2OriginatingTx
  await res.wait()

  const l2tx = await l2Provider.getTransaction(res.hash)
  const l2receipt = await l2Provider.getTransactionReceipt(res.hash)
  const [l2ToL1XDomainMsgHash] = await watcher.getMessageHashesFromL2Tx(res.hash)
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

  let l1Bob: Wallet
  let l2Bob: Wallet
  let l1Alice: Wallet

  const getBalances = async ():
    Promise<{
      l1UserBalance: BigNumber,
      l2UserBalance: BigNumber,
      l1GatewayBalance: BigNumber,
      sequencerBalance: BigNumber,
      l1BobBalance: BigNumber,
      l2BobBalance: BigNumber,
      l1AliceBalance: BigNumber
    }> => {
      const l1UserBalance = BigNumber.from(
        await l1Provider.send('eth_getBalance', [l1Wallet.address])
      )
      const l1BobBalance = BigNumber.from(
        await l1Provider.send('eth_getBalance', [l1Bob.address])
      )
      const l1AliceBalance = BigNumber.from(
        await l1Provider.send('eth_getBalance', [l1Bob.address])
      )
      const l2UserBalance = await OVM_ETH.balanceOf(l2Wallet.address)
      const l2BobBalance = await OVM_ETH.balanceOf(l2Bob.address)
      const sequencerBalance = await OVM_ETH.balanceOf(PROXY_SEQUENCER_ENTRYPOINT_ADDRESS)
      const l1GatewayBalance = BigNumber.from(
        await l1Provider.send('eth_getBalance', [OVM_L1ETHGateway.address])
      )
      return {
        l1UserBalance,
        l2UserBalance,
        l1BobBalance,
        l2BobBalance,
        l1AliceBalance,
        l1GatewayBalance,
        sequencerBalance
      }
    }
  

  before(async () => {
    const BOB_PRIV_KEY = '0x1234123412341234123412341234123412341234123412341234123412341234'
    l1Bob = new Wallet(BOB_PRIV_KEY, l1Provider)
    l2Bob = new Wallet(BOB_PRIV_KEY, l2Provider)
    
    const ALICE_PRIV_KEY = '0x4321432143214321432143214321432143214321432143214321432143214321'
    l1Alice = new Wallet(ALICE_PRIV_KEY, l1Provider)
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

    const preBalances = await getBalances()

    const depositReceipts = await waitForDepositTypeTransaction(
      OVM_L1ETHGateway.deposit({
        value: depositAmount,
        gasLimit: '0x100000',
        gasPrice: 0
      })
    )
    const l1FeePaid = depositReceipts.l1receipt.gasUsed.mul(depositReceipts.l1tx.gasPrice) // TODO: this is broken for nonzero l1 gas price... what part of the calc is off?

    const postBalances = await getBalances()

    expect(postBalances.l1GatewayBalance).to.deep.eq(preBalances.l1GatewayBalance.add(depositAmount))
    expect(postBalances.l2UserBalance).to.deep.eq(preBalances.l2UserBalance.add(depositAmount))
    expect(postBalances.l1UserBalance).to.deep.eq(
      preBalances.l1UserBalance.sub(
        l1FeePaid.add(depositAmount)
      )
    )
  })

  it('depositTo', async () => {
    const depositAmount = 10
    const preBalances = await getBalances()
    await l1Provider.send('eth_getBalance', [l1Wallet.address])

    const depositReceipts = await waitForDepositTypeTransaction(
      OVM_L1ETHGateway.depositTo(
        l2Bob.address,
        {
          value: depositAmount,
          gasLimit: '0x100000',
          gasPrice: 0
        }
      )
    )
    const l1FeePaid = depositReceipts.l1receipt.gasUsed.mul(depositReceipts.l1tx.gasPrice) // TODO: this is broken for nonzero l1 gas price... what part of the calc is off?

    const postBalances = await getBalances()

    expect(postBalances.l1GatewayBalance).to.deep.eq(preBalances.l1GatewayBalance.add(depositAmount))
    expect(postBalances.l2BobBalance).to.deep.eq(preBalances.l2BobBalance.add(depositAmount))
    expect(postBalances.l1UserBalance).to.deep.eq(
      preBalances.l1UserBalance.sub(
        l1FeePaid.add(depositAmount)
      )
    )
  })

  it('withdraw', async () => {
    const withdrawAmount = 3

    const preBalances = await getBalances()

    expect(preBalances.l2UserBalance.gt(0), 'Cannot run withdrawal test before any deposits...')

    const withdrawalReceipts = await waitForWithdrawalTypeTransaction(
      OVM_ETH.withdraw(withdrawAmount)
    )

    const postBalances = await getBalances()

    expect(postBalances.l1GatewayBalance).to.deep.eq(preBalances.l1GatewayBalance.sub(withdrawAmount))
    expect(postBalances.l2UserBalance).to.deep.eq(preBalances.l2UserBalance.sub(withdrawAmount))
    expect(postBalances.l1UserBalance).to.deep.eq(preBalances.l1UserBalance.add(withdrawAmount))

  })

  it('withdrawTo', async () => {
    const withdrawAmount = 3

    const preBalances = await getBalances()

    expect(preBalances.l2UserBalance.gt(0), 'Cannot run withdrawal test before any deposits...')

    const withdrawalReceipts = await waitForWithdrawalTypeTransaction(
      OVM_ETH.withdrawTo(
        l1Bob.address,
        withdrawAmount
      )
    )

    const postBalances = await getBalances()

    expect(postBalances.l1GatewayBalance).to.deep.eq(preBalances.l1GatewayBalance.sub(withdrawAmount))
    expect(postBalances.l2UserBalance).to.deep.eq(preBalances.l2UserBalance.sub(withdrawAmount))
    expect(postBalances.l1BobBalance).to.deep.eq(preBalances.l1BobBalance.add(withdrawAmount))
  })

  it('Round trip test: deposit, transfer, withdraw', async () => {
    const roundTripAmount = 3

    const preBalances = await getBalances()

    const depositReceipts = await waitForDepositTypeTransaction(
      OVM_L1ETHGateway.deposit({
        value: roundTripAmount,
        gasLimit: '0x100000',
        gasPrice: 0
      })
    )

    await OVM_ETH.transfer(l2Bob.address, roundTripAmount)

    const withdrawalReceipts = await waitForWithdrawalTypeTransaction(
      await OVM_ETH
        .connect(l2Bob)
        .withdraw(
          roundTripAmount
        )
    )

    const postBalances = await getBalances()

    expect(postBalances.l1BobBalance).to.deep.eq(preBalances.l1BobBalance.add(roundTripAmount))
  })

  it.only('Round trip test: depositTo, withdrawTo', async () => {
    const roundTripAmount = 7

    const preBalances = await getBalances()
    const depositReceipts = await waitForDepositTypeTransaction(
      await OVM_L1ETHGateway.depositTo(
        l2Bob.address,
        {
        value: roundTripAmount,
        gasLimit: '0x100000',
        gasPrice: 0
      })
    )
  
    // this transfer doesn't seem to be working... 
    const withdrawalReceipts = await waitForWithdrawalTypeTransaction(
      await OVM_ETH
        .connect(l2Bob)
        .withdrawTo(
          l1Alice.address,
          roundTripAmount
        )
    )

    const postBalances = await getBalances()
    
    expect(postBalances.l1AliceBalance).to.deep.eq(preBalances.l1AliceBalance.add(roundTripAmount))
  })


})
