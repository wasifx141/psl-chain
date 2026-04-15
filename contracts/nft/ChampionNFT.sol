// SPDX-License-Identifier: MIT
pragma solidity ^0.8.20;

import "@openzeppelin/contracts/token/ERC721/ERC721.sol";
import "@openzeppelin/contracts/access/Ownable.sol";
import "@openzeppelin/contracts/utils/Base64.sol";
import "@openzeppelin/contracts/utils/Strings.sol";

contract ChampionNFT is ERC721, Ownable {
    using Strings for uint256;

    struct Achievement {
        string achievementType;
        uint8 season;
        uint256 timestamp;
        address wallet;
    }

    mapping(uint256 => Achievement) public achievements;
    mapping(address => mapping(string => bool)) public hasAchievement;
    uint256 public nextTokenId = 1;

    // Achievement types
    string constant SEASON_CHAMPION = "SEASON_CHAMPION";
    string constant TOP_SCOUT = "TOP_SCOUT";
    string constant DIAMOND_HANDS = "DIAMOND_HANDS";
    string constant EARLY_ADOPTER = "EARLY_ADOPTER";
    string constant COMEBACK_KING = "COMEBACK_KING";
    string constant SEVEN_DAY_STREAK = "SEVEN_DAY_STREAK";
    string constant POWER_SCOUT = "POWER_SCOUT";
    string constant MATCH_MASTER = "MATCH_MASTER";

    event AchievementMinted(address indexed to, string achievementType, uint8 season, uint256 tokenId);

    constructor(address initialOwner_) ERC721("PSL Champion NFT", "PSLNFT") Ownable(initialOwner_) {}

    function mintAchievement(address to, string memory achievementType, uint8 season) external onlyOwner {
        require(!hasAchievement[to][achievementType], "Already has this achievement");
        
        uint256 tokenId = nextTokenId++;
        achievements[tokenId] = Achievement(achievementType, season, block.timestamp, to);
        hasAchievement[to][achievementType] = true;

        _mint(to, tokenId);
        emit AchievementMinted(to, achievementType, season, tokenId);
    }

    // Override _update to make tokens soulbound (non-transferable)
    function _update(address to, uint256 tokenId, address auth) internal override returns (address) {
        address from = _ownerOf(tokenId);
        if (from != address(0) && to != address(0)) {
            revert("Soulbound: Transfer not allowed");
        }
        return super._update(to, tokenId, auth);
    }

    function tokenURI(uint256 tokenId) public view override returns (string memory) {
        require(_ownerOf(tokenId) != address(0), "Token does not exist");
        
        Achievement memory achievement = achievements[tokenId];
        
        string memory svg = generateSVG(achievement.achievementType);
        string memory json = Base64.encode(
            bytes(
                string(
                    abi.encodePacked(
                        '{"name": "PSL Champion - ',
                        achievement.achievementType,
                        '", "description": "Soulbound achievement NFT for PSL fantasy sports", "image": "data:image/svg+xml;base64,',
                        Base64.encode(bytes(svg)),
                        '", "attributes": [',
                        '{"trait_type": "Achievement", "value": "',
                        achievement.achievementType,
                        '"}, {"trait_type": "Season", "value": "',
                        uint256(achievement.season).toString(),
                        '"}, {"trait_type": "Timestamp", "value": "',
                        achievement.timestamp.toString(),
                        '"}]}'
                    )
                )
            )
        );

        return string(abi.encodePacked("data:application/json;base64,", json));
    }

    function generateSVG(string memory achievementType) internal pure returns (string memory) {
        string memory color = getAchievementColor(achievementType);
        string memory shape = getAchievementShape(achievementType);
        
        return string(
            abi.encodePacked(
                '<svg width="400" height="400" xmlns="http://www.w3.org/2000/svg">',
                '<defs>',
                '<linearGradient id="grad" x1="0%" y1="0%" x2="100%" y2="100%">',
                '<stop offset="0%" style="stop-color:',
                color,
                ';stop-opacity:1" />',
                '<stop offset="100%" style="stop-color:#000;stop-opacity:0.8" />',
                '</linearGradient>',
                '</defs>',
                '<rect width="400" height="400" fill="url(#grad)" />',
                '<g transform="translate(200,200)">',
                shape,
                '</g>',
                '<text x="200" y="350" text-anchor="middle" fill="white" font-family="Arial" font-size="16" font-weight="bold">',
                achievementType,
                '</text>',
                '</svg>'
            )
        );
    }

    function getAchievementColor(string memory achievementType) internal pure returns (string memory) {
        if (keccak256(bytes(achievementType)) == keccak256(bytes(SEASON_CHAMPION))) return "#FFD700";
        if (keccak256(bytes(achievementType)) == keccak256(bytes(TOP_SCOUT))) return "#C0C0C0";
        if (keccak256(bytes(achievementType)) == keccak256(bytes(DIAMOND_HANDS))) return "#40E0D0";
        if (keccak256(bytes(achievementType)) == keccak256(bytes(EARLY_ADOPTER))) return "#9370DB";
        if (keccak256(bytes(achievementType)) == keccak256(bytes(COMEBACK_KING))) return "#FF4500";
        if (keccak256(bytes(achievementType)) == keccak256(bytes(SEVEN_DAY_STREAK))) return "#32CD32";
        if (keccak256(bytes(achievementType)) == keccak256(bytes(POWER_SCOUT))) return "#FF1493";
        if (keccak256(bytes(achievementType)) == keccak256(bytes(MATCH_MASTER))) return "#8A2BE2";
        return "#808080";
    }

    function getAchievementShape(string memory achievementType) internal pure returns (string memory) {
        if (keccak256(bytes(achievementType)) == keccak256(bytes(SEASON_CHAMPION))) {
            // Crown shape
            return '<path d="M-60,-40 L-40,-60 L-20,-40 L0,-60 L20,-40 L40,-60 L60,-40 L60,40 L-60,40 Z" fill="currentColor" stroke="#FFD700" stroke-width="3"/>';
        }
        if (keccak256(bytes(achievementType)) == keccak256(bytes(TOP_SCOUT))) {
            // Eye shape
            return '<ellipse cx="0" cy="0" rx="50" ry="30" fill="currentColor" stroke="#C0C0C0" stroke-width="3"/><circle cx="0" cy="0" r="15" fill="#000"/>';
        }
        if (keccak256(bytes(achievementType)) == keccak256(bytes(DIAMOND_HANDS))) {
            // Diamond shape
            return '<path d="M0,-50 L35,-25 L35,25 L0,50 L-35,25 L-35,-25 Z" fill="currentColor" stroke="#40E0D0" stroke-width="3"/>';
        }
        if (keccak256(bytes(achievementType)) == keccak256(bytes(EARLY_ADOPTER))) {
            // Star shape
            return '<path d="M0,-50 L15,-15 L50,-15 L25,5 L35,40 L0,25 L-35,40 L-25,5 L-50,-15 L-15,-15 Z" fill="currentColor" stroke="#9370DB" stroke-width="3"/>';
        }
        if (keccak256(bytes(achievementType)) == keccak256(bytes(COMEBACK_KING))) {
            // Arrow up shape
            return '<path d="M0,-50 L30,-20 L15,-20 L15,40 L-15,40 L-15,-20 L-30,-20 Z" fill="currentColor" stroke="#FF4500" stroke-width="3"/>';
        }
        if (keccak256(bytes(achievementType)) == keccak256(bytes(SEVEN_DAY_STREAK))) {
            // Lightning bolt
            return '<path d="M-20,-50 L20,-10 L0,-10 L20,50 L-20,10 L0,10 Z" fill="currentColor" stroke="#32CD32" stroke-width="3"/>';
        }
        if (keccak256(bytes(achievementType)) == keccak256(bytes(POWER_SCOUT))) {
            // Magnifying glass
            return '<circle cx="-10" cy="-10" r="25" fill="none" stroke="currentColor" stroke-width="5"/><path d="M10,10 L35,35" stroke="currentColor" stroke-width="5" stroke-linecap="round"/>';
        }
        if (keccak256(bytes(achievementType)) == keccak256(bytes(MATCH_MASTER))) {
            // Trophy shape
            return '<path d="M-30,-40 L30,-40 L25,-20 L25,20 L15,30 L15,40 L-15,40 L-15,30 L-25,20 L-25,-20 Z" fill="currentColor" stroke="#8A2BE2" stroke-width="3"/><ellipse cx="0" cy="45" rx="20" ry="5" fill="currentColor"/>';
        }
        
        // Default shield shape
        return '<path d="M0,-50 L40,-30 L40,20 L0,50 L-40,20 L-40,-30 Z" fill="currentColor" stroke="#808080" stroke-width="3"/>';
    }

    function getAchievementsByWallet(address wallet) external view returns (string[] memory) {
        string[] memory allTypes = new string[](8);
        allTypes[0] = SEASON_CHAMPION;
        allTypes[1] = TOP_SCOUT;
        allTypes[2] = DIAMOND_HANDS;
        allTypes[3] = EARLY_ADOPTER;
        allTypes[4] = COMEBACK_KING;
        allTypes[5] = SEVEN_DAY_STREAK;
        allTypes[6] = POWER_SCOUT;
        allTypes[7] = MATCH_MASTER;

        uint256 count = 0;
        for (uint256 i = 0; i < allTypes.length; i++) {
            if (hasAchievement[wallet][allTypes[i]]) {
                count++;
            }
        }

        string[] memory userAchievements = new string[](count);
        uint256 index = 0;
        for (uint256 i = 0; i < allTypes.length; i++) {
            if (hasAchievement[wallet][allTypes[i]]) {
                userAchievements[index] = allTypes[i];
                index++;
            }
        }

        return userAchievements;
    }
}