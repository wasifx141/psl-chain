import { createConfig, http } from 'wagmi'
import { defineChain } from 'viem'
import { injected } from 'wagmi/connectors'

export const wirefluid = defineChain({
  id: Number(process.env.NEXT_PUBLIC_WIREFLUID_CHAIN_ID),
  name: 'WireFluid',
  nativeCurrency: { name: 'WireCoin', symbol: 'WC', decimals: 18 },
  rpcUrls: { 
    default: { http: [process.env.NEXT_PUBLIC_WIREFLUID_RPC_URL!] } 
  },
  blockExplorers: { 
    default: { name: 'WireFluid Explorer', url: process.env.NEXT_PUBLIC_EXPLORER_URL! } 
  }
})

export const wagmiConfig = createConfig({
  chains: [wirefluid],
  connectors: [injected()],
  transports: { 
    [wirefluid.id]: http() 
  }
})