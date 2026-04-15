import { useReadContract, useReadContracts, useWriteContract, useWaitForTransactionReceipt, useAccount } from 'wagmi'
import { parseEther, formatEther } from 'viem'
import { contracts, playerTokens, playerTokenABI } from '@/config/contracts'
import { toast } from 'sonner'
import { useQueryClient, useQuery } from '@tanstack/react-query'
import { supabase } from '@/utils/supabase/client'
import { wirefluid } from '@/config/wagmi'

// Write contract hooks
export function useBuyTokens(playerTokenAddr: string, amount: number) {
  const { address, chain } = useAccount()
  const queryClient = useQueryClient()
  
  const { writeContract, data: hash, isPending } = useWriteContract({
    mutation: {
      onSuccess: async (hash) => {
        // Save to Supabase
        if (address) {
          await supabase.from('transactions').insert({
            tx_hash: hash,
            action: 'buy',
            wallet: address,
            player_token: playerTokenAddr,
            amount,
            timestamp: new Date().toISOString()
          })
        }
        
        // Invalidate caches
        queryClient.invalidateQueries({ queryKey: ['holdings'] })
        queryClient.invalidateQueries({ queryKey: ['portfolio'] })
        
        // Show success toast
        toast.success('Purchase successful!', {
          description: `Bought ${amount} tokens`,
          action: {
            label: 'View on Explorer',
            onClick: () => window.open(`${process.env.NEXT_PUBLIC_EXPLORER_URL}/tx/${hash}`, '_blank')
          }
        })
      },
      onError: (error) => {
        toast.error('Purchase failed', {
          description: error.message
        })
      }
    }
  })

  const buy = async (value: bigint) => {
    // Check if on correct network
    if (chain?.id !== wirefluid.id) {
      toast.error('Wrong Network', {
        description: 'Please switch to WireFluid network in your wallet'
      })
      return
    }
    
    writeContract({
      chainId: wirefluid.id,
      ...contracts.marketContract,
      functionName: 'buyTokens',
      args: [playerTokenAddr as `0x${string}`, BigInt(amount)],
      value
    })
  }

  return { buy, isLoading: isPending, txHash: hash }
}

export function useSellTokens(playerTokenAddr: string, amount: number) {
  const { address, chain } = useAccount()
  const queryClient = useQueryClient()
  
  const { writeContract, data: hash, isPending } = useWriteContract({
    mutation: {
      onSuccess: async (hash) => {
        if (address) {
          await supabase.from('transactions').insert({
            tx_hash: hash,
            action: 'sell',
            wallet: address,
            player_token: playerTokenAddr,
            amount,
            timestamp: new Date().toISOString()
          })
        }
        
        queryClient.invalidateQueries({ queryKey: ['holdings'] })
        queryClient.invalidateQueries({ queryKey: ['portfolio'] })
        
        toast.success('Sale successful!', {
          description: `Sold ${amount} tokens`,
          action: {
            label: 'View on Explorer',
            onClick: () => window.open(`${process.env.NEXT_PUBLIC_EXPLORER_URL}/tx/${hash}`, '_blank')
          }
        })
      }
    }
  })

  const sell = () => {
    // Check if on correct network
    if (chain?.id !== wirefluid.id) {
      toast.error('Wrong Network', {
        description: 'Please switch to WireFluid network in your wallet'
      })
      return
    }
    
    writeContract({
      chainId: wirefluid.id,
      ...contracts.marketContract,
      functionName: 'sellTokens',
      args: [playerTokenAddr as `0x${string}`, BigInt(amount)]
    })
  }

  return { sell, isLoading: isPending, txHash: hash }
}

export function useStakeTokens(playerTokenAddr: string, playerId: number, matchId: number, amount: number) {
  const { address } = useAccount()
  const queryClient = useQueryClient()
  
  const { writeContract, data: hash, isPending } = useWriteContract({
    mutation: {
      onSuccess: async (hash) => {
        if (address) {
          await supabase.from('transactions').insert({
            tx_hash: hash,
            action: 'stake',
            wallet: address,
            player_id: playerId,
            match_id: matchId,
            amount,
            timestamp: new Date().toISOString()
          })
        }
        
        queryClient.invalidateQueries({ queryKey: ['stakes'] })
        
        toast.success('Staking successful!', {
          description: `Staked ${amount} tokens for match ${matchId}`,
          action: {
            label: 'View on Explorer',
            onClick: () => window.open(`${process.env.NEXT_PUBLIC_EXPLORER_URL}/tx/${hash}`, '_blank')
          }
        })
      }
    }
  })

  const stake = () => {
    writeContract({
      chainId: wirefluid.id,
      ...contracts.stakingContract,
      functionName: 'stakeForMatch',
      args: [playerTokenAddr as `0x${string}`, playerId, matchId, BigInt(amount)]
    })
  }

  return { stake, isLoading: isPending, txHash: hash }
}

export function useClaimAndUnstake(playerTokenAddr: string, playerId: number, matchId: number) {
  const { address } = useAccount()
  const queryClient = useQueryClient()
  
  const { writeContract, data: hash, isPending } = useWriteContract({
    mutation: {
      onSuccess: async (hash) => {
        if (address) {
          await supabase.from('transactions').insert({
            tx_hash: hash,
            action: 'unstake',
            wallet: address,
            player_id: playerId,
            match_id: matchId,
            timestamp: new Date().toISOString()
          })
        }
        
        queryClient.invalidateQueries({ queryKey: ['stakes'] })
        queryClient.invalidateQueries({ queryKey: ['holdings'] })
        
        toast.success('Unstaking successful!', {
          action: {
            label: 'View on Explorer',
            onClick: () => window.open(`${process.env.NEXT_PUBLIC_EXPLORER_URL}/tx/${hash}`, '_blank')
          }
        })
      }
    }
  })

  const claimAndUnstake = () => {
    writeContract({
      chainId: wirefluid.id,
      ...contracts.stakingContract,
      functionName: 'claimAndUnstake',
      args: [playerTokenAddr as `0x${string}`, playerId, matchId]
    })
  }

  return { claimAndUnstake, isLoading: isPending, txHash: hash }
}

export function useClaimRewards() {
  const { address } = useAccount()
  const queryClient = useQueryClient()
  
  const { writeContract, data: hash, isPending } = useWriteContract({
    mutation: {
      onSuccess: async (hash) => {
        if (address) {
          await supabase.from('transactions').insert({
            tx_hash: hash,
            action: 'claim_rewards',
            wallet: address,
            timestamp: new Date().toISOString()
          })
        }
        
        queryClient.invalidateQueries({ queryKey: ['pendingRewards'] })
        
        toast.success('Rewards claimed!', {
          action: {
            label: 'View on Explorer',
            onClick: () => window.open(`${process.env.NEXT_PUBLIC_EXPLORER_URL}/tx/${hash}`, '_blank')
          }
        })
      }
    }
  })

  const claimRewards = () => {
    writeContract({
      chainId: wirefluid.id,
      ...contracts.prizePool,
      functionName: 'claimRewards'
    })
  }

  return { claimRewards, isLoading: isPending, txHash: hash }
}

// Read contract hooks
export function useGetBuyPrice(playerTokenAddr: string, amount: number) {
  return useReadContract({
    ...contracts.marketContract,
    functionName: 'getBuyPrice',
    args: [playerTokenAddr as `0x${string}`, BigInt(amount)],
    query: {
      enabled: !!playerTokenAddr && amount > 0,
      select: (data: bigint) => data ? formatEther(data) : '0'
    }
  })
}

export function useGetSellPrice(playerTokenAddr: string, amount: number) {
  return useReadContract({
    ...contracts.marketContract,
    functionName: 'getSellPrice',
    args: [playerTokenAddr as `0x${string}`, BigInt(amount)],
    query: {
      enabled: !!playerTokenAddr && amount > 0,
      select: (data: bigint) => data ? formatEther(data) : '0'
    }
  })
}

export function useGetHoldings(wallet: string, playerTokenAddr: string) {
  return useReadContract({
    ...contracts.marketContract,
    functionName: 'getHoldings',
    args: [wallet as `0x${string}`, playerTokenAddr as `0x${string}`],
    query: {
      enabled: !!wallet && !!playerTokenAddr,
      select: (data) => data ? Number(data) : 0
    }
  })
}

export function useGetTokensRemaining(playerTokenAddr: string) {
  return useReadContract({
    ...contracts.marketContract,
    functionName: 'getTokensRemaining',
    args: [playerTokenAddr as `0x${string}`],
    query: {
      enabled: !!playerTokenAddr,
      select: (data) => data ? Number(data) : 0
    }
  })
}

export function useGetStreak(wallet: string, playerTokenAddr: string) {
  return useReadContract({
    address: playerTokenAddr as `0x${string}`,
    abi: playerTokenABI,
    functionName: 'holdStreak',
    args: [wallet as `0x${string}`],
    query: {
      enabled: !!wallet && !!playerTokenAddr,
      select: (data: bigint) => data ? Number(data) : 0
    }
  })
}

export function useGetPendingRewards(wallet: string) {
  return useReadContract({
    ...contracts.prizePool,
    functionName: 'pendingRewards',
    args: [wallet as `0x${string}`],
    query: {
      enabled: !!wallet,
      select: (data: bigint) => data ? formatEther(data) : '0'
    }
  })
}

export function useGetPortfolio(wallet: string) {
  const { data: tokenAddresses } = useReadContract({
    ...contracts.marketContract,
    functionName: 'getAllPlayerTokens',
  })

  const tokenList = (tokenAddresses as readonly `0x${string}`[] | undefined) ?? []

  const { data: portfolio, ...rest } = useReadContracts({
    contracts: tokenList.map((tokenAddr) => ({
      ...contracts.marketContract,
      functionName: 'getHoldings' as const,
      args: [wallet as `0x${string}`, tokenAddr] as const,
    })),
    query: {
      enabled: !!wallet && tokenList.length > 0,
      select: (data: { result?: unknown }[]) => {
        return tokenList.map((tokenAddr, i) => ({
          tokenAddr,
          holdings: data[i]?.result ? Number(data[i].result as bigint) : 0
        }))
      }
    }
  })

  return { data: portfolio, ...rest }
}

export async function fetchLeaderboard() {
  // Reads leaderboard from Supabase (not a wagmi hook — call inside useEffect or react-query)
  const { data } = await supabase
    .from('leaderboard_cache')
    .select('*')
    .order('portfolio_value', { ascending: false })
    .limit(100)
  return data || []
}

export function useGetPlayerFPS(matchId: number, playerId: number) {
  return useReadContract({
    ...contracts.oracle,
    functionName: 'playerMatchFps',
    args: [BigInt(matchId), BigInt(playerId)],
    query: {
      enabled: matchId > 0 && playerId > 0,
      select: (data: bigint) => data ? Number(data) : 0
    }
  })
}

export function useIsAdmin(wallet: string) {
  const adminWallet = process.env.NEXT_PUBLIC_ADMIN_WALLET
  return {
    data: wallet?.toLowerCase() === adminWallet?.toLowerCase(),
    isLoading: false
  }
}