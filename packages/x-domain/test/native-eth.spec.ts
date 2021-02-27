import { expect } from 'chai'
import assert = require('assert')
import { JsonRpcProvider } from '@ethersproject/providers'
import { BigNumber, Contract, Wallet } from 'ethers'
import { getContractInterface } from '@eth-optimism/contracts'
import { Watcher } from '@eth-optimism/watcher'

import { getEnvironment, waitForDepositTypeTransaction, waitForWithdrawalTypeTransaction } from '../helpers'

const l1GatewayInterface = getContractInterface('OVM_L1ETHGateway')

const OVM_ETH_ADDRESS = '0x4200000000000000000000000000000000000006'
const PROXY_SEQUENCER_ENTRYPOINT_ADDRESS = '0x4200000000000000000000000000000000000004'

let l1Provider: JsonRpcProvider
let l2Provider: JsonRpcProvider
let l1Wallet: Wallet
let l2Wallet: Wallet
let AddressManager: Contract
let watcher: Watcher

describe('Native ETH Integration Tests', async () => {
  let OVM_L1ETHGateway: Contract
  let OVM_ETH: Contract

  let l1bob: Wallet
  let l2bob: Wallet

  const getBalances = async ():
    Promise<{
      l1UserBalance: BigNumber,
      l2UserBalance: BigNumber,
      l1GatewayBalance: BigNumber,
      sequencerBalance: BigNumber,
      l1BobBalance: BigNumber,
      l2BobBalance: BigNumber
    }> => {
      const l1UserBalance = BigNumber.from(
        await l1Provider.send('eth_getBalance', [l1Wallet.address])
      )
      const l1BobBalance = BigNumber.from(
        await l1Provider.send('eth_getBalance', [l1bob.address])
      )
      const l2UserBalance = await OVM_ETH.balanceOf(l2Wallet.address)
      const l2BobBalance = await OVM_ETH.balanceOf(l2bob.address)
      const sequencerBalance = await OVM_ETH.balanceOf(PROXY_SEQUENCER_ENTRYPOINT_ADDRESS)
      const l1GatewayBalance = BigNumber.from(
        await l1Provider.send('eth_getBalance', [OVM_L1ETHGateway.address])
      )
      return {
        l1UserBalance,
        l2UserBalance,
        l1BobBalance,
        l2BobBalance,
        l1GatewayBalance,
        sequencerBalance
      }
    }

  before(async () => {
    const system = await getEnvironment()
    l1Provider = system.l1Provider
    l2Provider = system.l2Provider
    l1Wallet = system.l1Wallet
    l2Wallet = system.l2Wallet
    AddressManager = system.AddressManager
    watcher = system.watcher

    const BOB_PRIV_KEY = '0x1234123412341234123412341234123412341234123412341234123412341234'
    l1bob = new Wallet(BOB_PRIV_KEY, l1Provider)
    l2bob = new Wallet(BOB_PRIV_KEY, l2Provider)

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

    const gasPrice = 1
    const gasLimit = '0x100000'
    const depositReceipts = await waitForDepositTypeTransaction(
      OVM_L1ETHGateway.deposit({
        value: depositAmount,
        gasLimit,
        gasPrice
      }),
      watcher, l1Provider, l2Provider
    )

    const l1FeePaid = depositReceipts.l1receipt.gasUsed.mul(gasPrice)

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

    const gasPrice = 1
    const gasLimit = '0x100000'
    const depositReceipts = await waitForDepositTypeTransaction(
      OVM_L1ETHGateway.depositTo(
        l2bob.address,
        {
          value: depositAmount,
          gasLimit,
          gasPrice
        }
      ),
      watcher, l1Provider, l2Provider
    )

    const l1FeePaid = depositReceipts.l1receipt.gasUsed.mul(depositReceipts.l1tx.gasPrice)

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
      OVM_ETH.withdraw(withdrawAmount, { gasPrice: 0 }),
      watcher, l1Provider, l2Provider
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
        l1bob.address,
        withdrawAmount,
        { gasPrice: 0 }
      ),
      watcher, l1Provider, l2Provider
    )

    const postBalances = await getBalances()

    expect(postBalances.l1GatewayBalance).to.deep.eq(preBalances.l1GatewayBalance.sub(withdrawAmount))
    expect(postBalances.l2UserBalance).to.deep.eq(preBalances.l2UserBalance.sub(withdrawAmount))
    expect(postBalances.l1BobBalance).to.deep.eq(preBalances.l1BobBalance.add(withdrawAmount))
  })

  it('deposit, transfer, withdraw', async () => {
    const roundTripAmount = 3

    const preBalances = await getBalances()

    const depositReceipts = await waitForDepositTypeTransaction(
      OVM_L1ETHGateway.deposit({
        value: roundTripAmount,
        gasLimit: '0x100000',
        gasPrice: 0
      }),
      watcher, l1Provider, l2Provider
    )

    await OVM_ETH.transfer(l2bob.address, roundTripAmount)

    const withdrawalReceipts = await waitForWithdrawalTypeTransaction(
      await OVM_ETH
        .connect(l2bob)
        .withdraw(
          roundTripAmount,
          { gasPrice: 0 }
        ),
        watcher, l1Provider, l2Provider
    )

    const postBalances = await getBalances()

    expect(postBalances.l1BobBalance).to.deep.eq(preBalances.l1BobBalance.add(roundTripAmount))
  })
})
