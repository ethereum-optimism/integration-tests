import { expect } from 'chai'
import assert = require('assert')
import { AlchemyProvider, JsonRpcProvider, TransactionReceipt, TransactionResponse } from '@ethersproject/providers'

import { Config } from '../../../common'
import { Watcher } from '@eth-optimism/watcher'
import { getContractInterface, getContractFactory } from '@eth-optimism/contracts'

import { BigNumber, ethers, Transaction } from 'ethers'
import erc20Json = require('../../../contracts/build-ovm/ERC20.json')

// const l1GatewayInterface = require('../temp/L1_ERC20Gateway.json').abi // getContractInterface('L1_ERC20Gateway') TODO: use this once the new npm contracts publish gives us access

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

const L1_ERC20Factory = new ContractFactory(
  erc20Json.abi, erc20Json.bytecode, l1Wallet
)



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

describe.skip('Basic ERC20 Integration Tests', async () => {
  let L1_ERC20: Contract
  let L1_ERC20Gateway: Contract 
  let L2_DEPOSITED_ERC20: Contract

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
      // get L1 ERC20 Balances
      const l1UserBalance = await L1_ERC20.balanceOf(l1Wallet.address)
      const l1BobBalance = await L1_ERC20.balanceOf(l1Bob.address)
      const l1AliceBalance = await L1_ERC20.balanceOf(l1Alice.address)
      const l1GatewayBalance = await L1_ERC20.balanceOf(L1_ERC20Gateway.address)

      // get L2 ERC20 Balances
      const l2UserBalance = await L2_DEPOSITED_ERC20.balanceOf(l2Wallet.address)
      const l2BobBalance = await L2_DEPOSITED_ERC20.balanceOf(l2Bob.address)
      const sequencerBalance = await L2_DEPOSITED_ERC20.balanceOf(PROXY_SEQUENCER_ENTRYPOINT_ADDRESS)
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
    
    L1_ERC20 = await L1_ERC20Factory.deploy(10_000, 'TestToken', 18, 'tst')

    // deploy on l2 
    L2_DEPOSITED_ERC20 = await (
      await getContractFactory('OVM_L2DepositedERC20', l2Wallet, true)
    ).deploy(
      l2MessengerAddress,
      18,
      'TestToken',
      'tst'
    )

    L1_ERC20Gateway = await (
      await getContractFactory('OVM_L1ERC20Gateway', l1Wallet, false)
    ).deploy(
      L1_ERC20.address,
      L2_DEPOSITED_ERC20.address,
      await AddressManager.getAddress('OVM_L1CrossDomainMessenger')
    )

    await L2_DEPOSITED_ERC20.init(L1_ERC20Gateway.address)
  })

  it('deposit', async () => {
    const preBalances = await getBalances()
    
    const depositAmount = 10
    console.log(1);
  
    await L1_ERC20.approve(L1_ERC20Gateway.address, depositAmount)
    console.log(2);
    
    console.log(await L1_ERC20.allowance(l1Wallet.address, L1_ERC20Gateway.address));
    console.log(3);
    
    console.log(L1_ERC20Gateway);
    
    const depositReceipts = await waitForDepositTypeTransaction(
      L1_ERC20Gateway.deposit(
        depositAmount,
        {
          gasLimit: '0x100000',
          gasPrice: 0
        }
      )
    )
    console.log(4);
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
      L1_ERC20Gateway.depositTo(
        l2Bob.address,
        depositAmount,
        {
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
      L2_DEPOSITED_ERC20.withdraw(withdrawAmount)
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
      L2_DEPOSITED_ERC20.withdrawTo(
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
      L1_ERC20Gateway.deposit({
        value: roundTripAmount,
        gasLimit: '0x100000',
        gasPrice: 0
      })
    )

    await L2_DEPOSITED_ERC20.transfer(l2Bob.address, roundTripAmount)

    const withdrawalReceipts = await waitForWithdrawalTypeTransaction(
      await L2_DEPOSITED_ERC20
        .connect(l2Bob)
        .withdraw(
          roundTripAmount
        )
    )

    const postBalances = await getBalances()

    expect(postBalances.l1BobBalance).to.deep.eq(preBalances.l1BobBalance.add(roundTripAmount))
  })

  it('Round trip test: depositTo, withdrawTo', async () => {
    const roundTripAmount = 7

    const preBalances = await getBalances()
    const depositReceipts = await waitForDepositTypeTransaction(
      await L1_ERC20Gateway.depositTo(
        l2Bob.address,
        {
        value: roundTripAmount,
        gasLimit: '0x100000',
        gasPrice: 0
      })
    )
  
    // this transfer doesn't seem to be working... 
    const withdrawalReceipts = await waitForWithdrawalTypeTransaction(
      await L2_DEPOSITED_ERC20
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
