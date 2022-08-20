import { ChainId } from '@pancakeswap-libs/sdk'
import MULTICALL_ABI from './abi.json'

const MULTICALL_NETWORKS: { [chainId in ChainId]: string } = {
  [ChainId.MAINNET]: '0xBe6f02b3962Bc54d7Ca1511e9bf92fdF3073C0Aa', // TODO
  [ChainId.TESTNET]: '0xBe6f02b3962Bc54d7Ca1511e9bf92fdF3073C0Aa'
}

export { MULTICALL_ABI, MULTICALL_NETWORKS }
