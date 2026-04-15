import deployments from '../../deployments.json'

// Import ABIs from Hardhat artifacts
import PrizePoolABI from '../../artifacts/contracts/pool/PrizePool.sol/PrizePool.json'
import MarketContractABI from '../../artifacts/contracts/market/MarketContract.sol/MarketContract.json'
import PSLOracleABI from '../../artifacts/contracts/oracle/PSLOracle.sol/PSLOracle.json'
import StakingContractABI from '../../artifacts/contracts/staking/StakingContract.sol/StakingContract.json'
import ChampionNFTABI from '../../artifacts/contracts/nft/ChampionNFT.sol/ChampionNFT.json'
import PSLPlayerTokenABI from '../../artifacts/contracts/tokens/PSLPlayerToken.sol/PSLPlayerToken.json'
import PlayerTokenFactoryABI from '../../artifacts/contracts/factory/PlayerTokenFactory.sol/PlayerTokenFactory.json'

export const contracts = {
  prizePool: {
    address: deployments.prizePool as `0x${string}`,
    abi: PrizePoolABI.abi,
  },
  marketContract: {
    address: deployments.marketContract as `0x${string}`,
    abi: MarketContractABI.abi,
  },
  oracle: {
    address: deployments.oracle as `0x${string}`,
    abi: PSLOracleABI.abi,
  },
  stakingContract: {
    address: deployments.stakingContract as `0x${string}`,
    abi: StakingContractABI.abi,
  },
  championNFT: {
    address: deployments.championNFT as `0x${string}`,
    abi: ChampionNFTABI.abi,
  },
  playerTokenFactory: {
    address: deployments.playerTokenFactory as `0x${string}`,
    abi: PlayerTokenFactoryABI.abi,
  }
} as const

// Player token addresses
export const playerTokens = deployments.playerTokens as Record<string, `0x${string}`>

// PSLPlayerToken ABI for individual player tokens
export const playerTokenABI = PSLPlayerTokenABI.abi

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