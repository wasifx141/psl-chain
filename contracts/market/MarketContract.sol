// SPDX-License-Identifier: MIT
pragma solidity ^0.8.20;

import "@openzeppelin/contracts/access/Ownable.sol";
import "@openzeppelin/contracts/utils/ReentrancyGuard.sol";
import "../curve/BondingCurve.sol";
import "../pool/PrizePool.sol";
import "../tokens/PSLPlayerToken.sol";

/**
 * @title MarketContract
 * @notice The primary trading hub for PSL player tokens.
 *         Implements a bonding curve AMM with 2% fee going to PrizePool.
 *         Wallet cap: max 10 tokens per player per wallet.
 *         Sell flow: checks-effects-interactions — transferFrom BEFORE state update BEFORE external call.
 */
contract MarketContract is Ownable, ReentrancyGuard {
    PrizePool public prizePool;
    address public factory;

    uint256 constant MAX_TOKENS_PER_WALLET = 10; // 10 whole tokens
    uint256 constant FEE_PERCENT = 2;

    // Track tokens sold per player token contract (in whole units, not wei)
    mapping(address => uint256) public tokensSold;
    // Holdings per wallet per player token (in wei, i.e. amount * 1e18)
    mapping(address => mapping(address => uint256)) public holdings;
    // All registered player token contracts
    address[] public allPlayerTokens;
    mapping(address => bool) public isRegisteredToken;
    mapping(address => uint8) public tokenTier;
    mapping(address => uint8) public tokenPlayerId;

    event TokenBought(address indexed buyer, address indexed playerToken, uint256 amount, uint256 cost, uint256 newSupply);
    event TokenSold(address indexed seller, address indexed playerToken, uint256 amount, uint256 refund, uint256 newSupply);
    event PlayerRegistered(address indexed playerToken, uint8 playerId, uint8 tier);

    constructor(address prizePool_, address initialOwner_) Ownable(initialOwner_) {
        require(prizePool_ != address(0), "Zero prizePool");
        prizePool = PrizePool(payable(prizePool_));
    }

    function setFactory(address factory_) external onlyOwner {
        factory = factory_;
    }

    /// @notice Register a player token — called by factory after deployment
    function registerPlayerToken(address tokenAddr, uint8 playerId_, uint8 tier_) external {
        require(msg.sender == owner() || msg.sender == factory, "Not authorized");
        require(tokenAddr != address(0), "Zero address");
        require(!isRegisteredToken[tokenAddr], "Already registered");
        isRegisteredToken[tokenAddr] = true;
        allPlayerTokens.push(tokenAddr);
        tokenTier[tokenAddr] = tier_;
        tokenPlayerId[tokenAddr] = playerId_;
        emit PlayerRegistered(tokenAddr, playerId_, tier_);
    }

    /**
     * @notice Buy `amount` whole tokens (1 unit = 1e18 internally).
     *         CEI pattern: checks → effects (state) → interactions (transfer + refund).
     *         Any excess msg.value is refunded after state is settled.
     */
    function buyTokens(address playerToken, uint256 amount) external payable nonReentrant {
        require(isRegisteredToken[playerToken], "Unknown token");
        require(amount >= 1 && amount <= 100, "Invalid amount");
        require(tokensSold[playerToken] + amount <= 100, "Exceeds supply");
        require(msg.value > 0, "Must send WC");

        // Wallet cap in whole tokens
        uint256 walletHolding = holdings[msg.sender][playerToken] / 1e18;
        require(walletHolding + amount <= MAX_TOKENS_PER_WALLET, "Exceeds 10 token wallet cap");

        uint8 tier_ = tokenTier[playerToken];
        uint256 cost = BondingCurve.getBuyPrice(tier_, tokensSold[playerToken], amount);
        require(msg.value >= cost, "Insufficient WC sent");

        // === EFFECTS (state changes first) ===
        tokensSold[playerToken] += amount;
        holdings[msg.sender][playerToken] += amount * 1e18;

        // === INTERACTIONS ===
        // 1. Deduct 2% fee → PrizePool
        uint256 fee = (cost * FEE_PERCENT) / 100;
        prizePool.receiveFee{value: fee}(prizePool.currentSeason());

        // 2. Transfer tokens to buyer
        PSLPlayerToken token = PSLPlayerToken(playerToken);
        token.transfer(msg.sender, amount * 1e18);

        // 3. Update hold streak
        token.updateStreak(msg.sender);

        // 4. Refund excess
        if (msg.value > cost) {
            (bool ok, ) = msg.sender.call{value: msg.value - cost}("");
            require(ok, "Refund failed");
        }

        emit TokenBought(msg.sender, playerToken, amount, cost, tokensSold[playerToken]);
    }

    /**
     * @notice Sell `amount` whole tokens back to the market.
     *         CEI pattern: transferFrom BEFORE updating state BEFORE sending refund.
     *         Seller must have approved this contract to spend their tokens.
     */
    function sellTokens(address playerToken, uint256 amount) external nonReentrant {
        require(isRegisteredToken[playerToken], "Unknown token");
        require(amount >= 1, "Invalid amount");

        uint256 holding = holdings[msg.sender][playerToken] / 1e18;
        require(holding >= amount, "Insufficient holdings");
        require(tokensSold[playerToken] >= amount, "Underflow protection");

        uint8 tier_ = tokenTier[playerToken];
        // Sell from top of curve (LIFO)
        uint256 sellRevenue = BondingCurve.getSellPrice(tier_, tokensSold[playerToken] - amount, amount);
        uint256 fee = (sellRevenue * FEE_PERCENT) / 100;
        uint256 refund = sellRevenue - fee;

        // === INTERACTION: take tokens first (CEI) ===
        PSLPlayerToken(playerToken).transferFrom(msg.sender, address(this), amount * 1e18);

        // === EFFECTS: update state ===
        tokensSold[playerToken] -= amount;
        holdings[msg.sender][playerToken] -= amount * 1e18;

        // === INTERACTIONS: send fee and refund ===
        prizePool.receiveFee{value: fee}(prizePool.currentSeason());

        (bool ok, ) = msg.sender.call{value: refund}("");
        require(ok, "Refund failed");

        emit TokenSold(msg.sender, playerToken, amount, refund, tokensSold[playerToken]);
    }

    // ─── View functions for UI ───────────────────────────────────────────────

    function getBuyPrice(address playerToken, uint256 amount) external view returns (uint256) {
        return BondingCurve.getBuyPrice(tokenTier[playerToken], tokensSold[playerToken], amount);
    }

    function getSellPrice(address playerToken, uint256 amount) external view returns (uint256) {
        uint256 sold = tokensSold[playerToken];
        if (sold < amount) return 0;
        return BondingCurve.getSellPrice(tokenTier[playerToken], sold - amount, amount);
    }

    function getHoldings(address wallet, address playerToken) external view returns (uint256) {
        return holdings[wallet][playerToken] / 1e18;
    }

    function getAllPlayerTokens() external view returns (address[] memory) {
        return allPlayerTokens;
    }

    function getTokensRemaining(address playerToken) external view returns (uint256) {
        return 100 - tokensSold[playerToken];
    }

    function setMarket(address newPrizePool) external onlyOwner {
        require(newPrizePool != address(0), "Zero address");
        prizePool = PrizePool(payable(newPrizePool));
    }

    receive() external payable {}
}