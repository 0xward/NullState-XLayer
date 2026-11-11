// SPDX-License-Identifier: MIT
pragma solidity ^0.8.20;

/**
 * @title NullStateRewardV2
 * @notice Reward, burn, and leaderboard management for NullState game — v2
 * @dev Main contract for handling:
 * - Weekly burn reward pools (flexible size, flexible per-user cap) — free
 *   for everyone, NOT gated by pass ownership.
 * - Seasonal leaderboards and bonus rewards (top 3) — gated: claiming a
 *   rank bonus requires the user held an active Season Pass for that
 *   season (see claimSeasonBonus() below).
 * - Multi-token support (USDm, USDT, USDC, CELO)
 * - Integration with PassSBTv3 for pass verification
 * - Backend-driven leaderboard updates via cron jobs
 *
 * WHY V2 EXISTS (read this first):
 * The original NullStateReward.sol hardcoded USDC/USDT/CELO token
 * addresses that turned out to be WRONG (cross-checked against
 * docs.celo.org/tooling/contracts/token-contracts, the official Celo
 * docs site):
 *
 *   Token | was hardcoded (WRONG)                     | correct (docs.celo.org)
 *   USDC  | 0xeF63B1FdEfA2C442f41911160bCEFdaD5896e107 | 0xcebA9300f2b948710d2653dD7B07f33A8B32118C
 *   USDT  | 0x88eEc42eaf6E1b371f4a7e786fDDB2E782b72ccA | 0x48065fbBE25f71C9282ddf5e1cD6D6A887483D5e
 *   CELO  | 0x471ecE3750da237F93b8e339C536Cb1483c48E8f | 0x471EcE3750Da237f93B8E339c536989b8978a438
 *
 * (USDm was already correct: 0x765DE816845861e75A25fCA122bb6898B8B1282a).
 * Any recordBurn/depositWeeklyPool/depositSeasonBonus/claim call made
 * with the old USDC/USDT/CELO addresses would have interacted with the
 * wrong contract entirely (or, for CELO, an address that isn't actually
 * how native CELO is represented) — this is not upgradeable in place
 * (plain contract, no proxy), so v2 corrects the addresses at deploy
 * time instead of patching them post-hoc.
 *
 * WHAT ELSE CHANGED FROM V1:
 * - RANK1_REWARD / RANK2_REWARD / RANK3_REWARD are no longer `constant`.
 *   They're now `rank1Reward` / `rank2Reward` / `rank3Reward`, regular
 *   state variables (still defaulting to 20 / 5 / 3 USDm) with an
 *   owner-only setter (`setRankRewards`), so reward amounts can change
 *   for future seasons without a redeploy.
 * - Token addresses (usdmToken/usdtToken/usdcToken/celoToken) are now
 *   owner-settable via setUsdmToken/setUsdtToken/setUsdcToken/setCeloToken,
 *   in addition to being corrected at deploy time — so a future address
 *   mistake (or a token migration, as already happened once with
 *   cUSD -> USDm) doesn't require another full redeploy.
 * - claimSeasonBonus() now requires the caller held an active Season
 *   Pass (PassSBTv3.hasPassForSeason) for the SPECIFIC season being
 *   claimed — not just "any pass ever" and not "a pass for whatever
 *   season happens to be active right now" (which would incorrectly
 *   exclude claims made after the season has ended). The `passSBT`
 *   variable existed in v1 too (constructor + setPassSBT()) but was
 *   never actually read anywhere — this was dead code until now.
 * - Weekly burn rewards (claimWeeklyRewards) remain completely
 *   UNGATED — every player can claim these regardless of pass
 *   ownership, matching the product decision that only the seasonal
 *   leaderboard bonus is a pass perk, not the weekly burn reward.
 */

import "@openzeppelin/contracts/access/Ownable.sol";

interface IERC20 {
    function transfer(address to, uint256 amount) external returns (bool);
    function transferFrom(address from, address to, uint256 amount) external returns (bool);
    function balanceOf(address account) external view returns (uint256);
    function approve(address spender, uint256 amount) external returns (bool);
}

interface IPassSBT {
    function hasPass(address user) external view returns (bool);
    function getUserPassSeason(address user) external view returns (uint256);
    function hasPassForSeason(address user, uint256 seasonId) external view returns (bool);
}

contract NullStateRewardV2 is Ownable {
    // ============ Constants ============
    uint256 public constant TOTAL_SEASONS = 6;

    // ============ Supported Tokens ============
    // Corrected addresses (cross-checked against docs.celo.org/tooling/
    // contracts/token-contracts) — see "WHY V2 EXISTS" above for the
    // wrong values these replace. No longer hardcoded-only: each has an
    // owner-only setter below in case of a future migration/correction.
    IERC20 public usdmToken = IERC20(0x765DE816845861e75A25fCA122bb6898B8B1282a);
    IERC20 public usdtToken = IERC20(0x48065fbBE25f71C9282ddf5e1cD6D6A887483D5e);
    IERC20 public usdcToken = IERC20(0xcebA9300f2b948710d2653dD7B07f33A8B32118C);
    address public celoToken = 0x471EcE3750Da237f93B8E339c536989b8978a438; // Native CELO

    IPassSBT public passSBT;

    // ============ Configurable Parameters ============
    uint256 public weeklyPoolSize = 2e18; // 2 USDm (flexible)
    uint256 public maxPerUserPerWeek = 5e17; // 0.5 USDm (flexible)
    uint256 public rank1Reward = 20e18; // 20 USDm (flexible)
    uint256 public rank2Reward = 5e18; // 5 USDm (flexible)
    uint256 public rank3Reward = 3e18; // 3 USDm (flexible)

    // ============ Data Structures ============
    struct WeeklyPool {
        uint256 week; // YYYYWW format
        address rewardToken;
        uint256 depositedAmount;
        uint256 claimedAmount;
        uint256 createdAt;
    }

    struct BurnRecord {
        address user;
        uint256 itemCount;
        uint256 burnValue; // in wei of reward token
        address rewardToken;
        uint256 timestamp;
        bool claimed;
    }

    struct SeasonLeaderboard {
        uint256 seasonId;
        address[3] topPlayers; // rank 1, 2, 3
        uint256[3] topScores; // item counts
        address rewardToken;
        uint256 totalDeposited;
        bool deposited;
        bool finalized;
        uint256 updatedAt;
    }

    // ============ State Variables ============
    mapping(uint256 => WeeklyPool) public weeklyPools; // week => pool
    mapping(address => BurnRecord[]) public userBurnRecords;
    mapping(uint256 => SeasonLeaderboard) public seasonLeaderboards; // seasonId => leaderboard
    mapping(address => mapping(uint256 => uint256)) public userWeeklyBurnAmount; // user => week => amount burned
    mapping(address => mapping(uint256 => uint256)) public userWeeklyClaimed; // user => week => amount claimed
    mapping(address => mapping(uint256 => bool)) public userSeasonClaimed; // user => seasonId => has claimed bonus

    mapping(address => bool) public backendAddresses; // Authorized backend addresses for updates

    // ============ Events ============
    event BurnRecorded(
        address indexed user,
        uint256 itemCount,
        uint256 burnValue,
        address rewardToken,
        uint256 timestamp
    );
    event BurnClaimed(
        address indexed user,
        uint256 week,
        uint256 amount,
        address rewardToken
    );
    event WeeklyPoolCreated(
        uint256 week,
        address rewardToken,
        uint256 depositedAmount
    );
    event WeeklyPoolDeposit(
        uint256 week,
        address rewardToken,
        uint256 additionalAmount
    );
    event LeaderboardUpdated(
        uint256 indexed seasonId,
        address[3] topPlayers,
        uint256[3] topScores
    );
    event SeasonBonusDeposited(
        uint256 indexed seasonId,
        address rewardToken,
        uint256 totalAmount
    );
    event SeasonBonusClaimed(
        address indexed user,
        uint256 seasonId,
        uint256 rank,
        uint256 amount
    );
    event PoolSizeUpdated(uint256 newSize);
    event MaxPerUserUpdated(uint256 newMax);
    event RankRewardsUpdated(uint256 rank1, uint256 rank2, uint256 rank3);
    event BackendAddressUpdated(address indexed backend, bool added);
    event TokenAddressUpdated(string tokenSymbol, address newAddress);

    // ============ Modifiers ============
    modifier onlyBackend() {
        require(backendAddresses[msg.sender] || msg.sender == owner(), "Not authorized");
        _;
    }

    // ============ Constructor ============
    constructor(address _passSBT) Ownable(msg.sender) {
        passSBT = IPassSBT(_passSBT);
    }

    // ============ Configuration (Owner Only) ============

    /**
     * @notice Set Pass SBT contract address
     */
    function setPassSBT(address _passSBT) external onlyOwner {
        require(_passSBT != address(0), "Invalid address");
        passSBT = IPassSBT(_passSBT);
    }

    /**
     * @notice Update weekly pool size
     */
    function setWeeklyPoolSize(uint256 _newSize) external onlyOwner {
        require(_newSize > 0, "Size must be > 0");
        weeklyPoolSize = _newSize;
        emit PoolSizeUpdated(_newSize);
    }

    /**
     * @notice Update max per user per week
     */
    function setMaxPerUserPerWeek(uint256 _newMax) external onlyOwner {
        require(_newMax > 0, "Max must be > 0");
        maxPerUserPerWeek = _newMax;
        emit MaxPerUserUpdated(_newMax);
    }

    /**
     * @notice Update the top-3 leaderboard bonus reward amounts
     * @dev Replaces v1's RANK1_REWARD/RANK2_REWARD/RANK3_REWARD constants.
     * Amounts are in wei of whichever token is deposited for that season
     * via depositSeasonBonus() — same units as before (e.g. 20e18 = 20
     * tokens for an 18-decimal token like USDm).
     */
    function setRankRewards(
        uint256 _rank1Reward,
        uint256 _rank2Reward,
        uint256 _rank3Reward
    ) external onlyOwner {
        require(_rank1Reward > 0 && _rank2Reward > 0 && _rank3Reward > 0, "Rewards must be > 0");
        rank1Reward = _rank1Reward;
        rank2Reward = _rank2Reward;
        rank3Reward = _rank3Reward;
        emit RankRewardsUpdated(_rank1Reward, _rank2Reward, _rank3Reward);
    }

    /**
     * @notice Add/remove backend address for leaderboard updates
     */
    function setBackendAddress(address _backend, bool _isBackend) external onlyOwner {
        require(_backend != address(0), "Invalid address");
        backendAddresses[_backend] = _isBackend;
        emit BackendAddressUpdated(_backend, _isBackend);
    }

    /**
     * @notice Update the USDm token address (owner-only migration/fix path)
     */
    function setUsdmToken(address _token) external onlyOwner {
        require(_token != address(0), "Invalid address");
        usdmToken = IERC20(_token);
        emit TokenAddressUpdated("USDm", _token);
    }

    /**
     * @notice Update the USDT token address (owner-only migration/fix path)
     */
    function setUsdtToken(address _token) external onlyOwner {
        require(_token != address(0), "Invalid address");
        usdtToken = IERC20(_token);
        emit TokenAddressUpdated("USDT", _token);
    }

    /**
     * @notice Update the USDC token address (owner-only migration/fix path)
     */
    function setUsdcToken(address _token) external onlyOwner {
        require(_token != address(0), "Invalid address");
        usdcToken = IERC20(_token);
        emit TokenAddressUpdated("USDC", _token);
    }

    /**
     * @notice Update the native-CELO marker address (owner-only fix path)
     */
    function setCeloToken(address _token) external onlyOwner {
        require(_token != address(0), "Invalid address");
        celoToken = _token;
        emit TokenAddressUpdated("CELO", _token);
    }

    // ============ Burn Tracking (Backend) ============

    /**
     * @notice Record burn event from backend
     * @param _user User burning items
     * @param _itemCount Number of items burned
     * @param _burnValue Total value in wei of reward token
     * @param _rewardToken Token used for reward (USDm, USDT, USDC, CELO)
     */
    function recordBurn(
        address _user,
        uint256 _itemCount,
        uint256 _burnValue,
        address _rewardToken
    ) external onlyBackend {
        require(_user != address(0), "Invalid user");
        require(_itemCount > 0, "Invalid item count");
        require(_burnValue > 0, "Invalid burn value");
        require(
            _rewardToken == address(usdmToken) ||
            _rewardToken == address(usdtToken) ||
            _rewardToken == address(usdcToken) ||
            _rewardToken == celoToken,
            "Unsupported token"
        );

        // Create burn record
        BurnRecord memory record = BurnRecord({
            user: _user,
            itemCount: _itemCount,
            burnValue: _burnValue,
            rewardToken: _rewardToken,
            timestamp: block.timestamp,
            claimed: false
        });

        userBurnRecords[_user].push(record);

        // Track weekly burn
        uint256 currentWeek = _getCurrentWeek();
        userWeeklyBurnAmount[_user][currentWeek] = userWeeklyBurnAmount[_user][currentWeek] + (
            _burnValue
        );

        emit BurnRecorded(_user, _itemCount, _burnValue, _rewardToken, block.timestamp);
    }

    // ============ Weekly Burn Rewards (UNGATED — no pass required) ============

    /**
     * @notice Owner deposits weekly pool
     */
    function depositWeeklyPool(
        uint256 _week,
        address _rewardToken,
        uint256 _amount
    ) external onlyOwner {
        require(
            _rewardToken == address(usdmToken) ||
            _rewardToken == address(usdtToken) ||
            _rewardToken == address(usdcToken) ||
            _rewardToken == celoToken,
            "Unsupported token"
        );
        require(_amount > 0, "Amount must be > 0");

        // Transfer tokens
        if (_rewardToken != celoToken) {
            require(
                IERC20(_rewardToken).transferFrom(msg.sender, address(this), _amount),
                "Transfer failed"
            );
        }

        if (weeklyPools[_week].createdAt == 0) {
            weeklyPools[_week] = WeeklyPool({
                week: _week,
                rewardToken: _rewardToken,
                depositedAmount: _amount,
                claimedAmount: 0,
                createdAt: block.timestamp
            });
            emit WeeklyPoolCreated(_week, _rewardToken, _amount);
        } else {
            weeklyPools[_week].depositedAmount = weeklyPools[_week].depositedAmount + (_amount);
            emit WeeklyPoolDeposit(_week, _rewardToken, _amount);
        }
    }

    /**
     * @notice User claims weekly burn rewards
     * @dev Deliberately NOT pass-gated — every player can claim regardless
     * of Season Pass ownership. Only the seasonal leaderboard bonus below
     * (claimSeasonBonus) is a pass perk.
     */
    function claimWeeklyRewards(uint256 _week) external {
        require(weeklyPools[_week].createdAt != 0, "Week not initialized");

        uint256 userBurned = userWeeklyBurnAmount[msg.sender][_week];
        uint256 userClaimed = userWeeklyClaimed[msg.sender][_week];
        uint256 claimable = userBurned - (userClaimed);

        require(claimable > 0, "No rewards to claim");

        // Check weekly cap
        uint256 maxUserClaim = maxPerUserPerWeek;
        uint256 toClaim = claimable > maxUserClaim ? maxUserClaim : claimable;

        // Check pool availability (pro-rata if depleted)
        WeeklyPool storage pool = weeklyPools[_week];
        uint256 poolAvailable = pool.depositedAmount - (pool.claimedAmount);
        require(poolAvailable >= toClaim, "Insufficient pool");

        // Update claims
        userWeeklyClaimed[msg.sender][_week] = userClaimed + (toClaim);
        pool.claimedAmount = pool.claimedAmount + (toClaim);

        // Transfer reward token
        if (pool.rewardToken == celoToken) {
            (bool success, ) = msg.sender.call{value: toClaim}("");
            require(success, "Transfer failed");
        } else {
            require(IERC20(pool.rewardToken).transfer(msg.sender, toClaim), "Transfer failed");
        }

        emit BurnClaimed(msg.sender, _week, toClaim, pool.rewardToken);
    }

    // ============ Leaderboard Management ============

    /**
     * @notice Backend updates seasonal leaderboard (via 24h cron)
     */
    function updateLeaderboard(
        uint256 _seasonId,
        address[3] calldata _topPlayers,
        uint256[3] calldata _topScores
    ) external onlyBackend {
        require(_seasonId > 0 && _seasonId <= TOTAL_SEASONS, "Invalid season");
        require(
            _topPlayers[0] != address(0) && _topPlayers[1] != address(0) && _topPlayers[2] != address(0),
            "Invalid addresses"
        );
        require(
            _topScores[0] >= _topScores[1] && _topScores[1] >= _topScores[2],
            "Scores not ordered"
        );

        SeasonLeaderboard storage lb = seasonLeaderboards[_seasonId];
        lb.seasonId = _seasonId;
        lb.topPlayers = _topPlayers;
        lb.topScores = _topScores;
        lb.updatedAt = block.timestamp;

        emit LeaderboardUpdated(_seasonId, _topPlayers, _topScores);
    }

    /**
     * @notice Owner deposits season bonus reward pool
     */
    function depositSeasonBonus(
        uint256 _seasonId,
        address _rewardToken,
        uint256 _amount
    ) external onlyOwner {
        require(_seasonId > 0 && _seasonId <= TOTAL_SEASONS, "Invalid season");
        require(
            _rewardToken == address(usdmToken) ||
            _rewardToken == address(usdtToken) ||
            _rewardToken == address(usdcToken) ||
            _rewardToken == celoToken,
            "Unsupported token"
        );
        require(_amount >= rank1Reward + rank2Reward + rank3Reward, "Insufficient amount");

        // Transfer tokens
        if (_rewardToken != celoToken) {
            require(
                IERC20(_rewardToken).transferFrom(msg.sender, address(this), _amount),
                "Transfer failed"
            );
        }

        SeasonLeaderboard storage lb = seasonLeaderboards[_seasonId];
        lb.rewardToken = _rewardToken;
        lb.totalDeposited = _amount;
        lb.deposited = true;

        emit SeasonBonusDeposited(_seasonId, _rewardToken, _amount);
    }

    /**
     * @notice Player claims season bonus (if ranked top 3)
     * @dev v2 GATING: requires the caller held a Season Pass for THIS
     * SPECIFIC _seasonId (via PassSBTv3.hasPassForSeason), not just "any
     * pass" and not "a pass for whatever season is active right now" —
     * the latter would wrongly block a legitimate claim made after the
     * season has already ended. If passSBT is unset (address(0)), this
     * reverts rather than silently allowing an ungated claim.
     */
    function claimSeasonBonus(uint256 _seasonId) external {
        require(_seasonId > 0 && _seasonId <= TOTAL_SEASONS, "Invalid season");
        require(!userSeasonClaimed[msg.sender][_seasonId], "Already claimed");
        require(address(passSBT) != address(0), "PassSBT not configured");
        require(passSBT.hasPassForSeason(msg.sender, _seasonId), "Season Pass required for this season");

        SeasonLeaderboard storage lb = seasonLeaderboards[_seasonId];
        require(lb.deposited, "Bonuses not deposited");

        uint256 rank = 0;
        uint256 rewardAmount = 0;

        if (msg.sender == lb.topPlayers[0]) {
            rank = 1;
            rewardAmount = rank1Reward;
        } else if (msg.sender == lb.topPlayers[1]) {
            rank = 2;
            rewardAmount = rank2Reward;
        } else if (msg.sender == lb.topPlayers[2]) {
            rank = 3;
            rewardAmount = rank3Reward;
        } else {
            revert("Not ranked");
        }

        userSeasonClaimed[msg.sender][_seasonId] = true;

        // Transfer reward
        if (lb.rewardToken == celoToken) {
            (bool success, ) = msg.sender.call{value: rewardAmount}("");
            require(success, "Transfer failed");
        } else {
            require(IERC20(lb.rewardToken).transfer(msg.sender, rewardAmount), "Transfer failed");
        }

        emit SeasonBonusClaimed(msg.sender, _seasonId, rank, rewardAmount);
    }

    // ============ Query Functions ============

    /**
     * @notice Get current ISO week (YYYYWW format)
     */
    function _getCurrentWeek() internal view returns (uint256) {
        uint256 timestamp = block.timestamp;
        uint256 dayCount = timestamp / 86400;
        uint256 dayOfWeek = (dayCount + 4) % 7; // Thursday is day 4 for ISO week
        uint256 weekStart = dayCount - dayOfWeek;
        uint256 year = 1970;
        uint256 daysRemaining = weekStart;

        while (daysRemaining >= 365) {
            uint256 daysInYear = (year % 4 == 0 && (year % 100 != 0 || year % 400 == 0)) ? 366 : 365;
            if (daysRemaining >= daysInYear) {
                daysRemaining -= daysInYear;
                year++;
            } else {
                break;
            }
        }

        uint256 week = (daysRemaining / 7) + 1;
        return year * 100 + week;
    }

    /**
     * @notice Get user's burn records count
     */
    function getUserBurnRecordsCount(address _user) external view returns (uint256) {
        return userBurnRecords[_user].length;
    }

    /**
     * @notice Get user's burn record
     */
    function getUserBurnRecord(address _user, uint256 _index)
        external
        view
        returns (BurnRecord memory)
    {
        require(_index < userBurnRecords[_user].length, "Invalid index");
        return userBurnRecords[_user][_index];
    }

    /**
     * @notice Get season leaderboard
     */
    function getSeasonLeaderboard(uint256 _seasonId)
        external
        view
        returns (SeasonLeaderboard memory)
    {
        return seasonLeaderboards[_seasonId];
    }

    /**
     * @notice Check if user has claimed season bonus
     */
    function hasClaimedSeasonBonus(address _user, uint256 _seasonId)
        external
        view
        returns (bool)
    {
        return userSeasonClaimed[_user][_seasonId];
    }

    /**
     * @notice Get user's weekly burn amount
     */
    function getUserWeeklyBurn(address _user, uint256 _week)
        external
        view
        returns (uint256)
    {
        return userWeeklyBurnAmount[_user][_week];
    }

    /**
     * @notice Get user's weekly claimed amount
     */
    function getUserWeeklyClaimed(address _user, uint256 _week)
        external
        view
        returns (uint256)
    {
        return userWeeklyClaimed[_user][_week];
    }

    // ============ Emergency Functions ============

    /**
     * @notice Emergency withdraw tokens (owner only)
     */
    function emergencyWithdraw(address _token, uint256 _amount) external onlyOwner {
        if (_token == celoToken) {
            (bool success, ) = msg.sender.call{value: _amount}("");
            require(success, "Withdraw failed");
        } else {
            require(IERC20(_token).transfer(msg.sender, _amount), "Transfer failed");
        }
    }

    // ============ Receive CELO ============
    receive() external payable {}
}
