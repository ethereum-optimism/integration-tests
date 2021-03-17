import { expect } from 'chai'
import assert = require('assert')
import { JsonRpcProvider, TransactionResponse } from '@ethersproject/providers'
import { BigNumber, Contract, Wallet, utils } from 'ethers'
import { getContractInterface } from '@eth-optimism/contracts'
import { Watcher } from '@eth-optimism/watcher'

import {
  getEnvironment,
  waitForDepositTypeTransaction,
  waitForWithdrawalTypeTransaction,
} from '../helpers'

const l1GatewayInterface = getContractInterface('OVM_L1ETHGateway')

const OVM_ETH_ADDRESS = '0x4200000000000000000000000000000000000006'
const PROXY_SEQUENCER_ENTRYPOINT_ADDRESS =
  '0x4200000000000000000000000000000000000004'

let l1Provider: JsonRpcProvider
let l2Provider: JsonRpcProvider
let l1Wallet: Wallet
let l2Wallet: Wallet
let AddressManager: Contract
let watcher: Watcher

describe('Fee Payment Integration Tests', async () => {
  let OVM_L1ETHGateway: Contract
  let OVM_ETH: Contract

  const getBalances = async (): Promise<{
    l1UserBalance: BigNumber
    l2UserBalance: BigNumber
    l1GatewayBalance: BigNumber
    sequencerBalance: BigNumber
  }> => {
    const l1UserBalance = BigNumber.from(
      await l1Provider.send('eth_getBalance', [l1Wallet.address])
    )
    const l2UserBalance = await OVM_ETH.balanceOf(l2Wallet.address)
    const sequencerBalance = await OVM_ETH.balanceOf(
      PROXY_SEQUENCER_ENTRYPOINT_ADDRESS
    )
    const l1GatewayBalance = BigNumber.from(
      await l1Provider.send('eth_getBalance', [OVM_L1ETHGateway.address])
    )
    return {
      l1UserBalance,
      l2UserBalance,
      l1GatewayBalance,
      sequencerBalance,
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

  beforeEach(async () => {
    const depositAmount = utils.parseEther('1')
    await waitForDepositTypeTransaction(
      OVM_L1ETHGateway.deposit({
        value: depositAmount,
        gasLimit: '0x100000',
        gasPrice: 0,
      }),
      watcher,
      l1Provider,
      l2Provider
    )
  })

  it('Paying a nonzero but acceptable gasPrice fee', async () => {
    const preBalances = await getBalances()

    const gasPrice = BigNumber.from(1_000_000)
    const gasLimit = BigNumber.from(5_000_000)

    // transfer with 0 value to easily pay a gas fee
    const res: TransactionResponse = await OVM_ETH.transfer(
      '0x1234123412341234123412341234123412341234',
      0,
      {
        gasPrice,
        gasLimit,
      }
    )
    await res.wait()

    // make sure stored and served correctly by geth
    expect(res.gasPrice.eq(gasPrice)).to.be.true
    expect(res.gasLimit.eq(gasLimit)).to.be.true

    const postBalances = await getBalances()
    const feePaid = preBalances.l2UserBalance.sub(postBalances.l2UserBalance)

    expect(feePaid.eq(gasLimit.mul(gasPrice))).to.be.true
  })

  it('sequencer rejects transaction with a non-multiple-of-1M gasPrice', async () => {
    const gasPrice = BigNumber.from(1_000_000 - 1)
    const gasLimit = BigNumber.from('0x100000')

    let err: string
    try {
      const res = await OVM_ETH.transfer(
        '0x1234123412341234123412341234123412341234',
        0,
        {
          gasPrice,
          gasLimit,
        }
      )
      await res.wait()
    } catch (e) {
      err = e.body
    }

    if (err === undefined) {
      throw new Error('Transaction did not throw as expected')
    }

    expect(err.includes('Gas price must be a multiple of 1,000,000 wei')).to.be
      .true
  })
})
