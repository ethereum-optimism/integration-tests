import { JsonRpcProvider, Provider } from '@ethersproject/providers'
import { Config } from './config'

let l1Provider: Provider
export const getL1Provider = (): Provider => {
  if (!l1Provider) {
    l1Provider = new JsonRpcProvider(Config.L1NodeUrlWithPort())
  }
  return l1Provider
}

let l2Provider: Provider
export const getl2Provider = (): Provider => {
  if (!l2Provider) {
    l2Provider = new JsonRpcProvider(Config.L2NodeUrlWithPort())
  }
  return l2Provider
}
