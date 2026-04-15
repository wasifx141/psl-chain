import { createConfig, http } from 'wagmi'
import { defineChain } from 'viem'

/** WireFluid custom chain definition */
export const wirefluid = defineChain({
  id: Number(process.env.NEXT_PUBLIC_WIREFLUID_CHAIN_ID || 1337),
  name: 'WireFluid',
  nativeCurrency: {
    name: 'WireFluid',
    symbol: 'WFL',
    decimals: 18,
  },
  rpcUrls: {
    default: {
      http: [process.env.NEXT_PUBLIC_WIREFLUID_RPC_URL || 'http://localhost:8545'],
    },
  },
  blockExplorers: {
    default: {
      name: 'WireFluid Explorer',
      url: process.env.NEXT_PUBLIC_EXPLORER_URL || 'http://localhost:4000',
    },
  },
})

export const wagmiConfig = createConfig({
  chains: [wirefluid],
  transports: {
    [wirefluid.id]: http(process.env.NEXT_PUBLIC_WIREFLUID_RPC_URL || 'http://localhost:8545'),
  },
  ssr: true,
})
