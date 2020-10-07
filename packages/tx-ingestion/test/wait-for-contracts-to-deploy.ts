import { getL1Provider } from '../src/factories'

export const sleep = (ms: number): Promise<void> => {
  return new Promise((resolve) => {
    setTimeout(resolve, ms)
  })
}

describe('Wait for contracts to deploy', () => {
  it('waits for contracts to deploy', async () => {
    while (true) {
      // TODO: Replace this with a less garbage solution when we inevitably pull the contract ABIs into this repo.
      // TODO: I'm thinking specifically checking the address or invoking a getter on all dependency contracts would be best.
      const blockNumber = await getL1Provider().getBlockNumber()
      if (blockNumber < 10) {
        console.log('Contracts not deployed yet... sleeping')
        await sleep(1000)
        continue
      }

      console.log(`Contracts have been deployed`)
      await sleep(5000)
      return
    }
  }).timeout(1000000)
})
