import { expect } from './setup'

/* Imports: External */
import { JsonRpcProvider } from '@ethersproject/providers'
import { Contract, ContractFactory, Wallet } from 'ethers'

/* Imports: Internal */
import { Config } from '../../../common'
import erc20Json = require('../../../contracts/build-ovm/ERC20.json')

describe('Basic ERC20 interactions', async () => {
  const initialAmount = 1000
  const tokenName = 'OVM Test'
  const tokenDecimals = 8
  const TokenSymbol = 'OVM'

  const l1Provider = new JsonRpcProvider(Config.L1NodeUrlWithPort())
  const l2Provider = new JsonRpcProvider(Config.L2NodeUrlWithPort())

  let l1Wallet: Wallet
  let l2Wallet: Wallet
  let sequencer: Wallet
  before(() => {
    l1Wallet = new Wallet(Config.DeployerPrivateKey(), l1Provider)
    l2Wallet = new Wallet(Config.DeployerPrivateKey(), l2Provider)
    sequencer = new Wallet(Config.SequencerPrivateKey(), l2Provider)
  })

  let Factory__ERC20: ContractFactory
  before(async () => {
    Factory__ERC20 = new ContractFactory(
      erc20Json.abi,
      erc20Json.bytecode,
      l2Wallet
    )
  })

  let ERC20: Contract
  beforeEach(async () => {
    ERC20 = await Factory__ERC20.deploy(
      initialAmount,
      tokenName,
      tokenDecimals,
      TokenSymbol
    )
  })

  it('should set the total supply', async () => {
    const totalSupply = await ERC20.totalSupply()
    expect(totalSupply.toNumber()).to.equal(initialAmount)
  })

  it('should get the token name', async () => {
    const name = await ERC20.name()
    expect(name).to.equal(tokenName)
  })

  it('should get the token decimals', async () => {
    const decimals = await ERC20.decimals()
    expect(decimals).to.equal(tokenDecimals)
  })

  it('should get the token symbol', async () => {
    const symbol = await ERC20.symbol()
    expect(symbol).to.equal(TokenSymbol)
  })

  it('should assign initial balance', async () => {
    const balance = await ERC20.balanceOf(l2Wallet.address)
    expect(balance.toNumber()).to.equal(initialAmount)
  })

  it('should transfer amount to destination account', async () => {
    const transfer = await ERC20.transfer(sequencer.address, 100)
    const receipt = await transfer.wait()

    // There are two events from the transfer with the first being
    // the fee of value 0 and the second of the value transfered (100)
    expect(receipt.events.length).to.equal(2)
    expect(receipt.events[0].args._value.toNumber()).to.equal(0)
    expect(receipt.events[1].args._from).to.equal(l1Wallet.address)
    expect(receipt.events[1].args._value.toNumber()).to.equal(100)

    const receiverBalance = await ERC20.balanceOf(sequencer.address)
    const senderBalance = await ERC20.balanceOf(l2Wallet.address)

    expect(receiverBalance.toNumber()).to.equal(100)
    expect(senderBalance.toNumber()).to.equal(900)
  })
})
