import deployments from '../../deployments.json'

// Import checked-in ABI JSONs for build-safe server/client usage
import PrizePoolABI from './abis/PrizePool.json'
import MarketContractABI from './abis/MarketContract.json'
import PSLOracleABI from './abis/PSLOracle.json'
import StakingContractABI from './abis/StakingContract.json'
import ChampionNFTABI from './abis/ChampionNFT.json'
import PSLPlayerTokenABI from './abis/PSLPlayerToken.json'
import PlayerTokenFactoryABI from './abis/PlayerTokenFactory.json'

export const contracts = {
  prizePool: {
    address: deployments.prizePool as `0x${string}`,
    abi: PrizePoolABI,
  },
  marketContract: {
    address: deployments.marketContract as `0x${string}`,
    abi: MarketContractABI,
  },
  oracle: {
    address: deployments.oracle as `0x${string}`,
    abi: PSLOracleABI,
  },
  stakingContract: {
    address: deployments.stakingContract as `0x${string}`,
    abi: StakingContractABI,
  },
  championNFT: {
    address: deployments.championNFT as `0x${string}`,
    abi: ChampionNFTABI,
  },
  playerTokenFactory: {
    address: deployments.playerTokenFactory as `0x${string}`,
    abi: PlayerTokenFactoryABI,
  }
} as const

// Player token addresses
export const playerTokens = deployments.playerTokens as Record<string, `0x${string}`>

// PSLPlayerToken ABI for individual player tokens
export const playerTokenABI = PSLPlayerTokenABI

// Contract addresses for easy access
export const contractAddresses = {
  prizePool: deployments.prizePool,
  marketContract: deployments.marketContract,
  oracle: deployments.oracle,
  stakingContract: deployments.stakingContract,
  championNFT: deployments.championNFT,
  playerTokenFactory: deployments.playerTokenFactory,
  playerTokens: deployments.playerTokens
} as const

export type ContractAddresses = typeof contractAddresses
