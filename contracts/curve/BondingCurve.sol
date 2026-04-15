// SPDX-License-Identifier: MIT
pragma solidity ^0.8.20;

/**
 * @title BondingCurve
 * @notice Pure library for bonding curve price calculations.
 *         Sigmoid-style: price_i = base + (base * i * i) / 2000
 *         This creates genuine scarcity — each token costs more as supply depletes.
 *
 * Tier pricing:
 *   Legend  (0): 0.30 WC base
 *   Star    (1): 0.10 WC base
 *   Regular (2): 0.05 WC base
 */
library BondingCurve {
    // Tier base prices in wei (18 decimals)
    uint256 constant LEGEND_BASE  = 300_000_000_000_000_000;  // 0.30 WC
    uint256 constant STAR_BASE    = 100_000_000_000_000_000;  // 0.10 WC
    uint256 constant REGULAR_BASE =  50_000_000_000_000_000;  // 0.05 WC

    function getBasePrice(uint8 tier) internal pure returns (uint256) {
        if (tier == 0) return LEGEND_BASE;
        if (tier == 1) return STAR_BASE;
        return REGULAR_BASE;
    }

    /// @notice Price of the token at position `tokenIndex` on the curve
    function getPriceAtToken(uint8 tier, uint256 tokenIndex) internal pure returns (uint256) {
        uint256 base = getBasePrice(tier);
        return base + (base * tokenIndex * tokenIndex) / 2000;
    }

    /**
     * @notice Total cost to buy `amount` tokens starting from `sold` position.
     *         Loop: i = 0 .. amount-1 → token indices = sold, sold+1, ..., sold+amount-1
     */
    function getBuyPrice(uint8 tier, uint256 sold, uint256 amount) internal pure returns (uint256 totalCost) {
        for (uint256 i = 0; i < amount; i++) {
            totalCost += getPriceAtToken(tier, sold + i);
        }
    }

    /**
     * @notice Refund value for selling `amount` tokens.
     *         Sells from top of curve (LIFO). Returns 0 if tokensSold < amount.
     *         95% of buy price is returned (5% spread is the AMM fee).
     * @param remaining The new `sold` value after selling (i.e. sold - amount)
     */
    function getSellPrice(uint8 tier, uint256 remaining, uint256 amount) internal pure returns (uint256) {
        uint256 totalBuyValue = getBuyPrice(tier, remaining, amount);
        return (totalBuyValue * 95) / 100;
    }

    /// @notice Maximum tokens purchasable with `balance` wei from position `sold`
    function getMaxBuyable(uint256 balance, uint8 tier, uint256 sold) internal pure returns (uint256 count) {
        uint256 spent = 0;
        while (sold + count < 100 && spent + getPriceAtToken(tier, sold + count) <= balance) {
            spent += getPriceAtToken(tier, sold + count);
            count++;
        }
    }
}