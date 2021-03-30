import { expect } from './setup'

/* Imports: External */
import { ethers, l2ethers } from 'hardhat'
import { Contract, ContractFactory, Wallet } from 'ethers'

import { sleep } from '../../../common'

// Adapted from:
// https://github.com/OpenZeppelin/openzeppelin-contracts/blob/master/test/token/ERC20/ERC20.test.js
describe('ERC20', async () => {
  const initialSupply = 1000
  const tokenName = 'OVM Test'
  const tokenSymbol = 'OVM'

  let initialHolder: Wallet
  let recipient: Wallet
  before(() => {
    initialHolder = ethers.Wallet.createRandom().connect(ethers.provider)
    recipient = ethers.Wallet.createRandom().connect(ethers.provider)
  })

  let Factory__TestERC20: ContractFactory
  before(async () => {
    Factory__TestERC20 = await l2ethers.getContractFactory('TestERC20')
  })

  let TestERC20: Contract
  beforeEach(async () => {
    TestERC20 = await Factory__TestERC20.connect(initialHolder).deploy(
      initialSupply,
      tokenName,
      tokenSymbol
    )
    await sleep(100)
    await TestERC20.deployTransaction.wait()
  })

  it('should have the right initial supply', async () => {
    const totalSupply = await TestERC20.totalSupply()
    expect(totalSupply.toNumber()).to.equal(initialSupply)
  })

  it('should have the right token name', async () => {
    const name = await TestERC20.name()
    expect(name).to.equal(tokenName)
  })

  it('should have the right token symbol', async () => {
    const symbol = await TestERC20.symbol()
    expect(symbol).to.equal(tokenSymbol)
  })

  it('should have the default 18 decimal places', async () => {
    const decimals = await TestERC20.decimals()
    expect(decimals).to.equal(18)
  })

  it('should assign initial balance', async () => {
    const balance = await TestERC20.balanceOf(initialHolder.address)
    expect(balance.toNumber()).to.equal(initialSupply)
  })

  describe('decrease allowance', () => {
    describe('when the spender is not the zero address', () => {
      let spender: string
      beforeEach(async () => {
        spender = recipient.address
      })

      const shouldDecreaseApproval = (amount: number) => {
        describe('when there was no approved amount before', () => {
          it.skip('reverts', async () => {
            await expect(
              TestERC20.decreaseAllowance(spender, amount)
            ).to.be.revertedWith('ERC20: decreased allowance below zero')
          })
        })

        describe('when the spender had an approved amount', () => {
          const approvedAmount = amount

          beforeEach(async () => {
            const tx = await TestERC20.approve(spender, approvedAmount)
            await sleep(100)
            await tx.wait()
          })

          it('emits an approval event', async () => {
            await expect(TestERC20.decreaseAllowance(spender, approvedAmount))
              .to.emit(TestERC20, 'Approval')
              .withArgs(initialHolder.address, spender, 0)
          })

          it('decreases the spender allowance subtracting the requested amount', async () => {
            await TestERC20.decreaseAllowance(spender, approvedAmount - 1)

            expect(
              (
                await TestERC20.allowance(initialHolder.address, spender)
              ).toNumber()
            ).to.equal(1)
          })

          it('sets the allowance to zero when all allowance is removed', async () => {
            await TestERC20.decreaseAllowance(spender, approvedAmount)

            expect(
              (
                await TestERC20.allowance(initialHolder.address, spender)
              ).toNumber()
            ).to.equal(0)
          })

          it.skip('reverts when more than the full allowance is removed', async () => {
            await expect(
              TestERC20.decreaseAllowance(spender, approvedAmount + 1)
            ).to.be.revertedWith('ERC20: decreased allowance below zero')
          })
        })
      }

      describe('when the sender has enough balance', () => {
        const amount = initialSupply

        shouldDecreaseApproval(amount)
      })

      describe('when the sender does not have enough balance', () => {
        const amount = initialSupply + 1

        shouldDecreaseApproval(amount)
      })
    })

    describe('when the spender is the zero address', () => {
      const amount = initialSupply
      const spender = ethers.constants.AddressZero

      it.skip('reverts', async () => {
        await expect(
          TestERC20.decreaseAllowance(spender, amount)
        ).to.be.revertedWith('ERC20: decreased allowance below zero')
      })
    })
  })

  describe('increase allowance', () => {
    const amount = initialSupply

    describe('when the spender is not the zero address', () => {
      let spender: string
      beforeEach(() => {
        spender = recipient.address
      })

      describe('when the sender has enough balance', () => {
        it('emits an approval event', async () => {
          await expect(TestERC20.increaseAllowance(spender, amount))
            .to.emit(TestERC20, 'Approval')
            .withArgs(initialHolder.address, spender, amount)
        })

        describe('when there was no approved amount before', () => {
          it('approves the requested amount', async () => {
            await TestERC20.increaseAllowance(spender, amount)

            expect(
              (
                await TestERC20.allowance(initialHolder.address, spender)
              ).toNumber()
            ).to.equal(amount)
          })
        })

        describe('when the spender had an approved amount', () => {
          beforeEach(async () => {
            await TestERC20.approve(spender, 1)
          })

          it('increases the spender allowance adding the requested amount', async () => {
            await TestERC20.increaseAllowance(spender, amount)

            expect(
              (
                await TestERC20.allowance(initialHolder.address, spender)
              ).toNumber()
            ).to.equal(amount + 1)
          })
        })
      })

      describe('when the sender does not have enough balance', () => {
        const amount2 = initialSupply + 1

        it('emits an approval event', async () => {
          await expect(TestERC20.increaseAllowance(spender, amount2))
            .to.emit(TestERC20, 'Approval')
            .withArgs(initialHolder.address, spender, amount2)
        })

        describe('when there was no approved amount before', () => {
          it('approves the requested amount', async () => {
            await TestERC20.increaseAllowance(spender, amount2)

            expect(
              (
                await TestERC20.allowance(initialHolder.address, spender)
              ).toNumber()
            ).to.equal(amount2)
          })
        })

        describe('when the spender had an approved amount', () => {
          beforeEach(async () => {
            await TestERC20.approve(spender, 1)
          })

          it('increases the spender allowance adding the requested amount', async () => {
            await TestERC20.increaseAllowance(spender, amount2)

            expect(
              (
                await TestERC20.allowance(initialHolder.address, spender)
              ).toNumber()
            ).to.equal(amount + 1)
          })
        })
      })
    })

    describe('when the spender is the zero address', () => {
      const spender = ethers.constants.AddressZero

      it.skip('reverts', async () => {
        await expect(
          TestERC20.increaseAllowance(spender, amount)
        ).to.be.revertedWith('ERC20: approve to the zero address')
      })
    })
  })

  describe('transfer', () => {
    describe('when the recipient is not the zero address', () => {
      describe('when the sender does not have enough balance', () => {
        const amount = initialSupply + 1

        it.skip('reverts', async () => {
          await expect(
            TestERC20.transfer(recipient.address, amount)
          ).to.be.revertedWith('ERC20: transfer amount exceeds balance')
        })
      })

      describe('when the sender transfers all balance', () => {
        const amount = initialSupply

        it('transfers the requested amount', async () => {
          await TestERC20.transfer(recipient.address, amount)

          expect(
            (await TestERC20.balanceOf(initialHolder.address)).toNumber()
          ).to.equal(0)
          expect(
            (await TestERC20.balanceOf(recipient.address)).toNumber()
          ).to.equal(amount)
        })

        it('emits a transfer event', async () => {
          await expect(TestERC20.transfer(recipient.address, amount))
            .to.emit(TestERC20, 'Transfer')
            .withArgs(initialHolder.address, recipient.address, amount)
        })
      })

      describe('when the sender transfers zero tokens', () => {
        const amount = 0

        it('transfers the requested amount', async () => {
          await TestERC20.transfer(recipient.address, amount)

          expect(
            (await TestERC20.balanceOf(initialHolder.address)).toNumber()
          ).to.equal(initialSupply)
          expect(
            (await TestERC20.balanceOf(recipient.address)).toNumber()
          ).to.equal(0)
        })

        it('emits a transfer event', async () => {
          await expect(TestERC20.transfer(recipient.address, amount))
            .to.emit(TestERC20, 'Transfer')
            .withArgs(initialHolder.address, recipient.address, amount)
        })
      })
    })

    describe('when the recipient is the zero address', () => {
      it.skip('reverts', async () => {
        await expect(
          TestERC20.transfer(ethers.constants.AddressZero, initialSupply)
        ).to.be.revertedWith('ERC20: transfer to the zero address')
      })
    })
  })

  describe('approve', () => {
    describe('when the spender is not the zero address', () => {
      describe('when the sender has enough balance', () => {
        const amount = initialSupply

        it('emits an approval event', async () => {
          await expect(TestERC20.approve(recipient.address, amount))
            .to.emit(TestERC20, 'Approval')
            .withArgs(initialHolder.address, recipient.address, amount)
        })

        describe('when there was no approved amount before', () => {
          it('approves the requested amount', async () => {
            await TestERC20.approve(recipient.address, amount)

            expect(
              (
                await TestERC20.allowance(
                  initialHolder.address,
                  recipient.address
                )
              ).toNumber()
            ).to.equal(amount)
          })
        })

        describe('when the spender had an approved amount', () => {
          beforeEach(async () => {
            await TestERC20.connect(initialHolder).approve(recipient.address, 1)
          })

          it('approves the requested amount and replaces the previous one', async () => {
            await TestERC20.connect(initialHolder).approve(
              recipient.address,
              amount
            )

            expect(
              (
                await TestERC20.allowance(
                  initialHolder.address,
                  recipient.address
                )
              ).toNumber()
            ).to.equal(amount)
          })
        })
      })

      describe('when the sender does not have enough balance', () => {
        const amount = initialSupply + 1

        it('emits an approval event', async () => {
          await expect(
            TestERC20.connect(initialHolder).approve(recipient.address, amount)
          )
            .to.emit(TestERC20, 'Approval')
            .withArgs(initialHolder.address, recipient.address, amount)
        })

        describe('when there was no approved amount before', () => {
          it('approves the requested amount', async () => {
            await TestERC20.connect(initialHolder).approve(
              recipient.address,
              amount
            )
            expect(
              (
                await TestERC20.allowance(
                  initialHolder.address,
                  recipient.address
                )
              ).toNumber()
            ).to.equal(amount)
          })
        })

        describe('when the spender had an approved amount', () => {
          beforeEach(async () => {
            await TestERC20.connect(initialHolder).approve(recipient.address, 1)
          })

          it('approves the requested amount and replaces the previous one', async () => {
            await TestERC20.connect(initialHolder).approve(
              recipient.address,
              amount
            )
            expect(
              (
                await TestERC20.allowance(
                  initialHolder.address,
                  recipient.address
                )
              ).toNumber()
            ).to.equal(amount)
          })
        })
      })
    })

    describe('when the spender is the zero address', () => {
      it.skip('reverts', async () => {
        await expect(
          TestERC20.connect(initialHolder).approve(
            ethers.constants.AddressZero,
            initialSupply
          )
        ).to.be.revertedWith('ERC20: approve to the zero address')
      })
    })
  })

  describe('_mint', () => {
    const amount = 50
    it.skip('rejects a null account', async () => {
      await expect(
        TestERC20.mint(ethers.constants.AddressZero, amount)
      ).to.be.revertedWith('ERC20: mint to the zero address')
    })

    describe('for a non zero account', () => {
      beforeEach('minting', async () => {
        await TestERC20.mint(recipient.address, amount)
      })

      it('increments totalSupply', async () => {
        const expectedSupply = initialSupply + amount
        expect((await TestERC20.totalSupply()).toNumber()).to.equal(
          expectedSupply
        )
      })

      it('increments recipient balance', async () => {
        expect(
          (await TestERC20.balanceOf(recipient.address)).toNumber()
        ).to.equal(amount)
      })

      it('emits Transfer event', async () => {
        await expect(TestERC20.mint(recipient.address, amount))
          .to.emit(TestERC20, 'Transfer')
          .withArgs(ethers.constants.AddressZero, recipient.address, amount)
      })
    })
  })

  describe('_burn', () => {
    it.skip('rejects a null account', async () => {
      await expect(
        TestERC20.burn(ethers.constants.AddressZero, 1)
      ).to.be.revertedWith('ERC20: burn from the zero address')
    })

    describe('for a non zero account', () => {
      it.skip('rejects burning more than balance', async () => {
        await expect(
          TestERC20.burn(ethers.constants.AddressZero, initialSupply + 1)
        ).to.be.revertedWith('ERC20: burn amount exceeds balance')
      })

      const describeBurn = (description: string, amount: number) => {
        describe(description, () => {
          beforeEach('burning', async () => {
            const tx = await TestERC20.burn(initialHolder.address, amount)
            await sleep(100)
            await tx.wait()
          })

          it('decrements totalSupply', async () => {
            const expectedSupply = initialSupply - amount
            expect((await TestERC20.totalSupply()).toNumber()).to.equal(
              expectedSupply
            )
          })

          it('decrements initialHolder balance', async () => {
            const expectedBalance = initialSupply - amount
            expect(
              (await TestERC20.balanceOf(initialHolder.address)).toNumber()
            ).to.equal(expectedBalance)
          })
        })

        describe(description, () => {
          it('emits Transfer event', async () => {
            await expect(TestERC20.burn(initialHolder.address, amount))
              .to.emit(TestERC20, 'Transfer')
              .withArgs(
                initialHolder.address,
                ethers.constants.AddressZero,
                amount
              )
          })
        })
      }

      describeBurn('for entire balance', initialSupply)
      describeBurn('for less amount than balance', initialSupply - 1)
    })
  })
})
