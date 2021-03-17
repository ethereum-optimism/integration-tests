export * from './setup'

export const makeRandomHexString = (len: number): string => {
  return (
    '0x' +
    [...Array(len * 2)]
      .map(() => {
        return Math.floor(Math.random() * 16).toString(16)
      })
      .join('')
  )
}
