// SPDX-License-Identifier: MIT
pragma solidity ^0.8.20;

import "@openzeppelin/contracts/access/Ownable.sol";
import "../pool/PrizePool.sol";
import "../tokens/PSLPlayerToken.sol";
import "../staking/StakingContract.sol";
import "../nft/ChampionNFT.sol";

/**
 * @title PSLOracle
 * @notice Receives real-world PSL match data and computes Fantasy Player Scores (FPS).
 *
 * FPS Formula (scaled by 100 for integer math, final = rawScore / 100):
 *   BPI  = runs×100 + SR bonus + milestone bonus + notOut bonus + matchWon+topScorer bonus
 *   BWPI = wickets×3000 + ER bonus + dot bonus + death over bonus + wicket milestone bonus
 *   FI   = catches×1200 + stumpings×1800 + runOuts×1500 - droppedCatches×2000
 *   AR   = 15% of (BPI + BWPI) if both >= 4000
 *   fps  = (BPI + BWPI + FI + AR) / 100
 *
 * Strike Rate (SR) encoding: sr = runs * 10000 / balls
 *   SR 200 → sr value = 20000
 *   SR 175 → sr value = 17500
 *
 * Economy Rate (ER) encoding: er = runsConc * 1000 / oversBowled (oversBowled*10 = actual*10)
 *   ER 6.0 → er value = 600
 *
 * All intermediate int256 values are clamped to 0 before casting to uint256.
 */
contract PSLOracle is Ownable {
    PrizePool       public prizePool;
    StakingContract public stakingContract;
    ChampionNFT     public championNFT;

    mapping(uint8 => mapping(uint8 => uint256)) public playerMatchFps;         // matchId => playerId => fps
    mapping(uint8 => mapping(uint8 => uint256)) public playerMultiplier;       // matchId => playerId => mult*100
    uint8 public currentMatch = 0;

    struct MatchResult {
        uint8  matchId;
        uint8  playerId;
        address playerTokenAddr;
        uint32 runs;
        uint32 balls;
        uint32 wickets;
        uint32 dotsBowled;
        uint32 runsConc;
        uint32 oversBowled;       // actual overs * 10 (e.g. 4.0 overs = 40)
        uint32 catches;
        uint32 stumpings;
        uint32 runOuts;
        uint32 droppedCatches;
        bool   notOut;
        bool   matchWon;
        bool   topScorer;
        bool   deathOver;         // bowled death overs (17-20) with ER < 8
    }

    event MatchProcessed(uint8 indexed matchId, uint8 indexed playerId, uint256 fps, uint256 multiplier);
    event BatchMatchProcessed(uint8 indexed matchId, uint256 playersProcessed);

    constructor(address prizePool_, address initialOwner_) Ownable(initialOwner_) {
        require(prizePool_ != address(0), "Zero prizePool");
        prizePool = PrizePool(payable(prizePool_));
    }

    function setStaking(address s) external onlyOwner { require(s != address(0), "Zero"); stakingContract = StakingContract(s); }
    function setNFT(address n)    external onlyOwner { require(n != address(0), "Zero"); championNFT = ChampionNFT(n); }

    // ─── FPS Calculation ─────────────────────────────────────────────────────

    /**
     * @notice Calculate FPS and multiplier for a single player.
     *         Pure function — safe to call as preview from UI before pushing.
     *         All intermediate values checked >= 0 before uint256 cast.
     */
    function calculateFPS(MatchResult calldata r) public pure returns (uint256 fps, uint256 multiplier) {
        // ── BATTING PERFORMANCE INDEX (BPI) ──────────────────────────────
        int256 bpi = int256(uint256(r.runs) * 100);

        // Strike rate: sr = runs * 10000 / balls (avoids decimals)
        // SR 200% → sr = 20000 | SR 100% → sr = 10000
        if (r.balls > 0) {
            uint256 sr = uint256(r.runs) * 10000 / uint256(r.balls);
            if      (sr >= 20000) bpi += 6000;  // SR >= 200%
            else if (sr >= 17500) bpi += 4000;  // SR >= 175%
            else if (sr >= 15000) bpi += 2000;  // SR >= 150%
            else if (sr >= 12000) bpi += 0;     // SR >= 120%: neutral
            else if (sr < 10000 && r.runs > 0) bpi -= 1500; // SR < 100%: penalty
        }

        // Milestone bonuses
        if      (r.runs >= 100) bpi += 6000;
        else if (r.runs >= 75)  bpi += 4000;
        else if (r.runs >= 50)  bpi += 2500;
        else if (r.runs >= 25)  bpi += 1000;

        // Not-out bonus (only meaningful at 20+ runs)
        if (r.notOut && r.runs >= 20) bpi += 1000;

        // Match winner + top scorer bonus
        if (r.matchWon && r.topScorer) bpi += 1500;

        if (bpi < 0) bpi = 0;

        // ── BOWLING PERFORMANCE INDEX (BWPI) ─────────────────────────────
        int256 bwpi = int256(uint256(r.wickets) * 3000);

        // Economy rate: er = runsConc * 1000 / oversBowled (oversBowled already *10)
        // ER 6.0 → er = 600 | ER 10.0 → er = 1000
        if (r.oversBowled > 0) {
            uint256 er = uint256(r.runsConc) * 1000 / uint256(r.oversBowled);
            if      (er < 600)  bwpi += 3000;  // ER < 6.0
            else if (er < 700)  bwpi += 2000;  // ER < 7.0
            else if (er < 800)  bwpi += 1000;  // ER < 8.0
            else if (er < 900)  bwpi += 0;     // ER < 9.0: neutral
            else if (er < 1000) bwpi -= 1000;  // ER < 10.0
            else                bwpi -= 2000;  // ER >= 10.0
        }

        bwpi += int256(uint256(r.dotsBowled) * 150);
        if (r.deathOver) bwpi += 2000;

        // Wicket milestone bonuses
        if      (r.wickets >= 5) bwpi += 6000;
        else if (r.wickets >= 4) bwpi += 4000;
        else if (r.wickets >= 3) bwpi += 2000;

        // Penalty for misfields (dropped catches hurt bowler stats too)
        bwpi -= int256(uint256(r.droppedCatches) * 300);
        if (bwpi < 0) bwpi = 0;

        // ── FIELDING INDEX (FI) ──────────────────────────────────────────
        int256 fi = int256(
            uint256(r.catches)   * 1200 +
            uint256(r.stumpings) * 1800 +
            uint256(r.runOuts)   * 1500
        );
        fi -= int256(uint256(r.droppedCatches) * 2000);
        if (fi < 0) fi = 0;

        // ── ALL-ROUNDER BONUS ────────────────────────────────────────────
        int256 allrounder = 0;
        if (bpi >= 4000 && bwpi >= 4000) {
            allrounder = (bpi + bwpi) * 15 / 100;
        }

        // ── FINAL SCORE ──────────────────────────────────────────────────
        // All components have been clamped to >= 0, safe to cast
        uint256 rawScore = uint256(bpi) + uint256(bwpi) + uint256(fi) + uint256(allrounder);
        fps = rawScore / 100;

        // ── MULTIPLIER TIERS ─────────────────────────────────────────────
        if      (fps >= 150) multiplier = 300; // 3.0x — exceptional
        else if (fps >= 100) multiplier = 250; // 2.5x — excellent
        else if (fps >=  70) multiplier = 200; // 2.0x — very good
        else if (fps >=  40) multiplier = 150; // 1.5x — good
        else if (fps >=  20) multiplier = 100; // 1.0x — decent
        else if (fps >    0) multiplier =  75; // 0.75x — poor
        else                 multiplier =  50; // 0.5x — did not contribute
    }

    // ─── Batch Match Processing ───────────────────────────────────────────────

    /**
     * @notice Push full match results for all players in one transaction.
     *         Calculates FPS, updates player token multipliers, then triggers
     *         StakingContract.processMatchRewards for proportional distribution.
     */
    function pushMatchResults(MatchResult[] calldata results) external onlyOwner {
        require(results.length > 0, "No results");
        uint8 matchId = results[0].matchId;

        uint8[]   memory uniquePlayerIds = new uint8[](results.length);
        uint256[] memory fpScores        = new uint256[](results.length);

        for (uint256 i = 0; i < results.length; i++) {
            MatchResult calldata r = results[i];
            require(r.matchId == matchId, "All results must be same matchId");

            (uint256 fps, uint256 mult) = calculateFPS(r);

            playerMatchFps[matchId][r.playerId]    = fps;
            playerMultiplier[matchId][r.playerId]  = mult;

            uniquePlayerIds[i] = r.playerId;
            fpScores[i]        = fps;

            // Update player token performance multiplier
            if (r.playerTokenAddr != address(0)) {
                PSLPlayerToken(r.playerTokenAddr).updateMultiplier(mult, fps);
            }

            emit MatchProcessed(matchId, r.playerId, fps, mult);
        }

        // Trigger prize distribution via StakingContract → PrizePool
        stakingContract.processMatchRewards(
            matchId,
            uniquePlayerIds,
            fpScores,
            prizePool.currentSeason()
        );

        currentMatch = matchId;
        emit BatchMatchProcessed(matchId, results.length);
    }

    // ─── Preview ─────────────────────────────────────────────────────────────

    /**
     * @notice Preview FPS for a single result without writing to chain.
     *         Used by admin panel's "Preview FPS" button before pushing.
     */
    function previewFPS(MatchResult calldata r)
        external
        pure
        returns (uint256 fps, uint256 multiplier, string memory tier)
    {
        (fps, multiplier) = calculateFPS(r);
        if      (fps >= 150) tier = "EXCEPTIONAL";
        else if (fps >= 100) tier = "EXCELLENT";
        else if (fps >=  70) tier = "GOOD";
        else if (fps >=  40) tier = "DECENT";
        else                 tier = "POOR";
    }
}