// SPDX-License-Identifier: MIT
pragma solidity ^0.8.20;

import "@openzeppelin/contracts/access/Ownable.sol";
import "../tokens/PSLPlayerToken.sol";
import "../market/MarketContract.sol";

/**
 * @title PlayerTokenFactory
 * @notice Deploys PSLPlayerToken contracts for each PSL player.
 *         deployAllPlayers() for initial 40-player setup.
 *         addPlayer() for adding single players post-launch.
 *         deployBatch(start, end) for gas-safe batched deployment.
 *
 * Each deployment:
 *   1. Deploys PSLPlayerToken (mints 100 tokens to market)
 *   2. Registers with MarketContract via registerPlayerToken
 *   3. Adds to allPlayerIds array
 *   4. Emits PlayerDeployed event
 */
contract PlayerTokenFactory is Ownable {
    struct PlayerData {
        uint8  id;
        string name;
        string symbol;
        uint8  tier;
    }

    mapping(uint8 => address) public playerTokens;  // playerId => tokenAddr
    uint8[] public allPlayerIds;

    address public oracleAddress;
    address public marketAddress;

    event PlayerDeployed(uint8 indexed playerId, address indexed tokenAddress, string name, string symbol, uint8 tier);

    constructor(address oracle_, address market_, address initialOwner_) Ownable(initialOwner_) {
        require(oracle_  != address(0), "Zero oracle");
        require(market_  != address(0), "Zero market");
        oracleAddress = oracle_;
        marketAddress = market_;
    }

    /// @notice Deploy all players in one transaction (40 = safe for reasonable gas limits)
    function deployAllPlayers(PlayerData[] calldata players) external onlyOwner {
        for (uint256 i = 0; i < players.length; i++) {
            _deployPlayer(players[i]);
        }
    }

    /**
     * @notice Deploy a batch of players by index range (inclusive).
     *         Use this if you need to split a large deployment across transactions
     *         to stay within block gas limits.
     */
    function deployBatch(PlayerData[] calldata players, uint256 start, uint256 end) external onlyOwner {
        require(end < players.length, "end out of bounds");
        require(start <= end, "start > end");
        for (uint256 i = start; i <= end; i++) {
            _deployPlayer(players[i]);
        }
    }

    /// @notice Deploy a single new player (for expansion post-launch)
    function addPlayer(PlayerData calldata player) external onlyOwner {
        _deployPlayer(player);
    }

    function _deployPlayer(PlayerData calldata player) internal {
        require(playerTokens[player.id] == address(0), "Player already deployed");
        require(bytes(player.name).length > 0,    "Empty name");
        require(bytes(player.symbol).length == 4,  "Symbol must be 4 chars");
        require(player.tier <= 2,                  "Invalid tier");

        PSLPlayerToken token = new PSLPlayerToken(
            player.name,
            player.symbol,
            player.tier,
            player.id,
            oracleAddress,
            marketAddress,
            owner()
        );

        address tokenAddr = address(token);
        playerTokens[player.id] = tokenAddr;
        allPlayerIds.push(player.id);

        // Register with MarketContract so it can be traded immediately
        MarketContract(payable(marketAddress)).registerPlayerToken(tokenAddr, player.id, player.tier);

        emit PlayerDeployed(player.id, tokenAddr, player.name, player.symbol, player.tier);
    }

    function getPlayerToken(uint8 playerId_) external view returns (address) {
        return playerTokens[playerId_];
    }

    function getAllTokenAddresses() external view returns (address[] memory) {
        address[] memory tokens = new address[](allPlayerIds.length);
        for (uint256 i = 0; i < allPlayerIds.length; i++) {
            tokens[i] = playerTokens[allPlayerIds[i]];
        }
        return tokens;
    }

    function getAllPlayerIds() external view returns (uint8[] memory) {
        return allPlayerIds;
    }

    function totalDeployed() external view returns (uint256) {
        return allPlayerIds.length;
    }

    function setOracle(address oracle_) external onlyOwner {
        require(oracle_ != address(0), "Zero address");
        oracleAddress = oracle_;
    }

    function setMarket(address market_) external onlyOwner {
        require(market_ != address(0), "Zero address");
        marketAddress = market_;
    }
}