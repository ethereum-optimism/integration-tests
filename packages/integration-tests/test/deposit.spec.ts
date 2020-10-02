import './setup'
import { Config } from '../src/config'

import {
  Provider,
  Web3Provider,
  JsonRpcProvider,
} from '@ethersproject/providers'
import { Wallet } from '@ethersproject/wallet'
import { ganache } from '@eth-optimism/ovm-toolchain'
import { PostgresDB } from '@eth-optimism/core-db'
import { OptimismProvider, sighashEthSign } from '@eth-optimism/provider'
import { getContractFactory } from '@eth-optimism/rollup-contracts'
import { getContractAddress } from '@ethersproject/address'
import { Contract } from '@ethersproject/contracts'
import { computeAddress } from '@ethersproject/transactions'
import { QueueOrigin, BatchSubmissionStatus } from '@eth-optimism/rollup-core'
import { mainModule } from 'process'

// Commonly used test mnemonic
const mnemonic =
  'abandon abandon abandon abandon abandon abandon ' +
  'abandon abandon abandon abandon abandon about'

// Address derived at m/44'/60'/0'/0 of test mnemonic
const etherbase = '0x9858EfFD232B4033E47d90003D41EC34EcaEda94'

const sleep = (m) => new Promise((r) => setTimeout(r, m))

const poll = async (
  functionToCall: Function,
  timeout: number,
  successCondition: Function = (res: any[]) => res !== null && res.length !== 0,
  pollInterval: number = 100
) => {
  for (let i = 0; i < timeout; i += pollInterval) {
    const res = await functionToCall()
    if (successCondition(res)) {
      return res
    }
    await sleep(pollInterval)
  }
}

describe('Transactions', () => {
  let l1Provider: Provider
  let l1Signer: Wallet
  let l2Provider: Provider
  let addressResolver: Contract
  let postgres: PostgresDB

  before(async () => {
    postgres = new PostgresDB('postgres', 5432, 'test', 'test', 'rollup')
    l1Provider = new JsonRpcProvider(Config.L1NodeUrlWithPort())
    l1Signer = Wallet.fromMnemonic(mnemonic).connect(l1Provider)
    const web3 = new Web3Provider(
      ganache.provider({
        mnemonic,
      })
    )

    l2Provider = new OptimismProvider(Config.L2NodeUrlWithPort(), web3)

    // Set up address resolver which we can use to resolve any required contract addresses
    const deployerAddress = computeAddress(
      '0xdf8b81d840b9cafc8cd68cf94f093726b174b5f109eba11a3f2a559e5f9e8bce'
    )
    const addressResolverAddress = getContractAddress({
      from: deployerAddress,
      nonce: 0,
    })
    const AddressResolverFactory = getContractFactory('AddressResolver')
    addressResolver = AddressResolverFactory.connect(l1Signer).attach(
      addressResolverAddress
    )
  })

  it('should allow us to get the l1ToL2TxQueueAddress', async () => {
    // Set up L1ToL2TransactionQueue contract object
    const l1ToL2TransactionQueueAddress = await addressResolver.getAddress(
      'L1ToL2TransactionQueue'
    )
    const L1ToL2TransactionQueueFactory = getContractFactory(
      'L1ToL2TransactionQueue'
    )
    const l1ToL2TransactionQueue: Contract = L1ToL2TransactionQueueFactory.connect(
      l1Signer
    ).attach(l1ToL2TransactionQueueAddress)

    // Send an L1ToL2Transaction
    const input = ['0x' + '01'.repeat(20), 500_000, '0x' + '00']
    const calldata = await l1ToL2TransactionQueue.interface.encodeFunctionData(
      'enqueueL1ToL2Message',
      input
    )

    const txResponse = await l1Signer.sendTransaction({
      data: calldata,
      to: l1ToL2TransactionQueueAddress,
    })
    const txReceipt = await txResponse.wait()

    const getL1RollupTx = () =>
      postgres.select(
        `SELECT * FROM l1_rollup_tx WHERE l1_tx_hash = '${txResponse.hash}'`
      )
    const l1RollupTxs = await poll(getL1RollupTx, 10_000)
    const l1RollupTx = l1RollupTxs[0]

    const address = await l1Signer.getAddress()
    l1RollupTx.l1_message_sender.should.equal(address)
    l1RollupTx.queue_origin.should.equal(QueueOrigin.L1_TO_L2_QUEUE)

    const getQueueResult = () =>
      postgres.select(
        `SELECT * FROM geth_submission_queue WHERE l1_tx_hash = '${txResponse.hash}'`
      )
    const queueResults = await poll(getQueueResult, 10_000)
    const queueResult = queueResults[0]
    queueResult.l1_tx_hash.should.equal(txResponse.hash)
  })
})
