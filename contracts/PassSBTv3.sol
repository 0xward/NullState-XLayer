// SPDX-License-Identifier: MIT
pragma solidity ^0.8.20;

/**
 * @title PassSBTv3
 * @notice Soulbound Token (SBT) for NullState Season Passes — v3
 * @dev Non-transferable ERC721 tokens representing seasonal pass access.
 *
 * WHY V3 EXISTS (read this first):
 * PassSBTv2.sol (live but never usable — see below) has a fatal bug in its
 * `_update()` override, the internal hook OpenZeppelin's ERC721 calls on
 * EVERY mint, burn, and transfer:
 *
 *     function _update(address to, uint256 tokenId, address auth) internal override returns (address) {
 *         address from = ownerOf(tokenId);   // BUG
 *         require(from == address(0) || to == address(0), "SBT: Non-transferable");
 *         return super._update(to, tokenId, auth);
 *     }
 *
 * `ownerOf(tokenId)` is the PUBLIC OpenZeppelin v5 function, which
 * internally calls `_requireOwned()` and DELIBERATELY REVERTS with
 * `ERC721NonexistentToken(uint256)` if the token has no owner yet. But
 * `_update()` is called FIRST during minting, at the exact moment the
 * token does not have an owner yet — so this line reverts on literally
 * every mint attempt, both `mintFreePass()` and `backendMintPass()`. This
 * was confirmed by decoding the revert selector `0x7e273289` from a live
 * failed mint tx, which matches `ERC721NonexistentToken(uint256)` exactly.
 *
 * The fix is to use `_ownerOf(tokenId)` — the INTERNAL OZ v5 helper, which
 * returns `address(0)` instead of reverting when the token has no owner
 * yet. This is the exact pattern OpenZeppelin's own ERC721 uses internally
 * for the same non-transferable-token check. See `_update()` below.
 *
 * The same bug exists in `contracts/PassSBT.sol` (v1, live on Celo
 * Mainnet, not upgradeable, not touched by this fix) — meaning v1 most
 * likely never successfully minted a single pass either. Neither v1 nor
 * v2 use a proxy/upgradeable pattern, so this cannot be patched in place;
 * a new contract is the only fix, hence v3.
 *
 * WHAT ELSE CHANGED FROM V2 (v3 is a superset of v2's functionality,
 * nothing removed):
 * - `_update()` fixed as described above — this is the only behavioral
 *   bugfix in this contract.
 * - `PASS_PRICE_USD_CENTS` is no longer a `constant`. It's now
 *   `passPriceUsdCents`, a regular state variable with an owner-only
 *   setter (`setPassPriceUsdCents`), so the pass price can be changed for
 *   future seasons without a redeploy. This value is informational
 *   on-chain (this contract never pulls tokens itself — see
 *   `backendMintPass` below) but is now the single source of truth: the
 *   backend (`app/api/passsbt/mint/route.ts`) reads it via
 *   `getPassPriceUsdCents()` instead of using its own hardcoded constant,
 *   so there's no longer a risk of two different price numbers living in
 *   two different places (frontend vs contract) going out of sync.
 * - Everything else — per-season mint tracking, `hasPass()` /
 *   `hasPassForSeason()` semantics, whitelist/FCFS mechanics, the
 *   off-chain-payment-then-`backendMintPass()` flow, Soulbound
 *   (non-transferable) behavior, `TOTAL_SEASONS` (6), `BASE_URI` — is
 *   unchanged from v2. See PassSBTv2.sol's own header comment for the
 *   full history of why v2 existed in the first place (v1's lifetime
 *   mint-lock bug).
 *
 * WHAT DID NOT CHANGE:
 * - v1 and v2 passes already minted (if any — see v1 note above, it's
 *   suspected v1 never successfully minted anything) are NOT migrated
 *   automatically. Per docs/pass-system.md, old-season passes are meant
 *   to stay in the holder's wallet as a collectible even after the
 *   season ends; this was already the intended design.
 */

import "@openzeppelin/contracts/token/ERC721/ERC721.sol";
import "@openzeppelin/contracts/access/Ownable.sol";
import "@openzeppelin/contracts/utils/Strings.sol";

contract PassSBTv3 is ERC721, Ownable {
    using Strings for uint256;

    // ============ Constants ============
    uint256 public constant TOTAL_SEASONS = 6;
    // DEPLOYED AND IMMUTABLE — do not "fix" this string. The app moved to
    // https://playnullstate.xyz in July 2026, but this constant is compiled
    // into the live contract with no setter, so tokenURI() will name the
    // original host for as long as the contract exists. It still resolves
    // because that host 307s to the current domain, where
    // app/assets/sbt-pass/metadata/[file]/route.ts answers.
    //
    // Consequence: the Vercel subdomain can never be deleted. Removing it
    // breaks the metadata of every pass already minted, permanently. See
    // docs/custom-domain.md. If this contract is ever redeployed, make
    // BASE_URI owner-settable rather than constant.
    string public constant BASE_URI = "https://nullstate-ten.vercel.app/assets/sbt-pass/metadata/";

    // ============ Configurable Parameters ============
    // v3: was `PASS_PRICE_USD_CENTS` (constant) in v2. Informational only
    // (0.30 USD by default) — actual payment is one of USDm/USDC/USDT,
    // sent off-chain to TREASURY_WALLET and verified by the backend
    // before backendMintPass() is called (this contract never pulls any
    // token itself). Now owner-adjustable via setPassPriceUsdCents() so
    // the price can change for future seasons without a redeploy, and is
    // the single source of truth the backend reads from instead of
    // hardcoding its own copy.
    uint256 public passPriceUsdCents = 30;

    // ============ State Variables ============
    uint256 private _tokenIdCounter = 0;

    // Season configuration
    mapping(uint256 => uint256) public seasonSupply; // seasonId => max supply
    mapping(uint256 => uint256) public seasonMinted; // seasonId => minted count
    mapping(uint256 => uint256) public seasonStartDate; // seasonId => start timestamp
    mapping(uint256 => uint256) public seasonEndDate; // seasonId => end timestamp

    // Ordered list of every seasonId ever initialized, so getCurrentSeasonId()
    // can loop over a bounded, known set instead of guessing season IDs.
    // TOTAL_SEASONS = 6 keeps this loop cheap regardless of caller.
    uint256[] public initializedSeasonIds;

    // Token mapping
    mapping(uint256 => uint256) public tokenSeasonId; // tokenId => seasonId

    // Per-season mint tracking (v2 fix, carried over unchanged): replaces
    // v1's single `mapping(address => uint256) userPassSeason` lifetime flag.
    mapping(address => mapping(uint256 => bool)) public userMintedSeason; // user => seasonId => minted?

    // Informational only — most recently minted season for a user. Kept so
    // `getUserPassSeason()` below still returns a single uint256 and stays
    // ABI-compatible with NullStateRewardV2.sol's IPassSBT interface, which
    // expects that exact signature.
    mapping(address => uint256) public lastPassSeason;

    // Whitelist management
    mapping(uint256 => mapping(address => bool)) public whitelisted; // seasonId => user => is whitelisted
    mapping(uint256 => mapping(address => bool)) public whitelistClaimed; // seasonId => user => has claimed free pass
    mapping(uint256 => uint256) public whitelistCount; // seasonId => number of whitelisted addresses

    // Authorized backend signer(s), separate from the owner cold wallet,
    // allowed to call backendMintPass() after independently verifying an
    // off-chain stablecoin payment. Same onlyBackend / backendAddresses
    // pattern used by TreasureVaultV2.sol and NullStateRewardV2.sol.
    mapping(address => bool) public backendAddresses;

    // ============ Events ============
    event PassMinted(address indexed user, uint256 seasonId, bool isFree);
    event WhitelistAdded(address indexed user, uint256 seasonId);
    event WhitelistRemoved(address indexed user, uint256 seasonId);
    event SeasonCreated(uint256 seasonId, uint256 startDate, uint256 endDate);
    event BackendAddressUpdated(address indexed backend, bool isAuthorized);
    event PassPriceUpdated(uint256 newPriceUsdCents);

    // ============ Modifiers ============
    /// @dev Only authorized backend addresses or owner can call
    modifier onlyBackend() {
        require(backendAddresses[msg.sender] || msg.sender == owner(), "Not authorized backend");
        _;
    }

    // ============ Constructor ============
    constructor() ERC721("NullState Season Pass", "NULPASS") Ownable(msg.sender) {}

    // ============ Backend Authorization Management ============

    /**
     * @notice Add or remove backend authorization
     * @dev Only owner can manage backend addresses
     * @param _backend Backend address to authorize/revoke
     * @param _isBackend True to authorize, false to revoke
     */
    function setBackendAddress(address _backend, bool _isBackend) external onlyOwner {
        require(_backend != address(0), "Invalid backend address");
        backendAddresses[_backend] = _isBackend;
        emit BackendAddressUpdated(_backend, _isBackend);
    }

    // ============ Pricing (Owner Only) ============

    /**
     * @notice Update the informational pass price (USD cents). Does not
     * move any funds itself — payment is verified off-chain by the
     * backend before backendMintPass() is called. This is the single
     * on-chain source of truth the backend reads before accepting a
     * payment, so frontend/backend/contract never disagree on price.
     * @param _newPriceUsdCents New price in USD cents (e.g. 30 = $0.30)
     */
    function setPassPriceUsdCents(uint256 _newPriceUsdCents) external onlyOwner {
        require(_newPriceUsdCents > 0, "Price must be > 0");
        passPriceUsdCents = _newPriceUsdCents;
        emit PassPriceUpdated(_newPriceUsdCents);
    }

    /**
     * @notice Convenience view so off-chain callers have an explicit
     * getter name to call instead of relying on the public state
     * variable's auto-generated getter (both work identically).
     */
    function getPassPriceUsdCents() external view returns (uint256) {
        return passPriceUsdCents;
    }

    // ============ Season Management (Owner Only) ============

    /**
     * @notice Initialize a new season
     * @param _seasonId Season identifier (e.g., 202607 for July 2026)
     * @param _startDate Season start timestamp (UTC)
     * @param _endDate Season end timestamp (UTC)
     * @param _maxSupply Maximum passes available for this season
     */
    function initializeSeason(
        uint256 _seasonId,
        uint256 _startDate,
        uint256 _endDate,
        uint256 _maxSupply
    ) external onlyOwner {
        require(seasonStartDate[_seasonId] == 0, "Season already exists");
        require(_startDate < _endDate, "Invalid dates");
        require(_maxSupply > 0, "Supply must be > 0");

        seasonSupply[_seasonId] = _maxSupply;
        seasonStartDate[_seasonId] = _startDate;
        seasonEndDate[_seasonId] = _endDate;
        initializedSeasonIds.push(_seasonId);

        emit SeasonCreated(_seasonId, _startDate, _endDate);
    }

    // ============ Whitelist Management ============

    /**
     * @notice Add single address to whitelist for free pass
     */
    function addToWhitelist(address _user, uint256 _seasonId) external onlyOwner {
        require(seasonStartDate[_seasonId] != 0, "Season not initialized");
        require(!whitelisted[_seasonId][_user], "Already whitelisted");

        whitelisted[_seasonId][_user] = true;
        whitelistCount[_seasonId]++;

        emit WhitelistAdded(_user, _seasonId);
    }

    /**
     * @notice Remove address from whitelist
     */
    function removeFromWhitelist(address _user, uint256 _seasonId) external onlyOwner {
        require(whitelisted[_seasonId][_user], "Not whitelisted");

        whitelisted[_seasonId][_user] = false;
        whitelistCount[_seasonId]--;

        emit WhitelistRemoved(_user, _seasonId);
    }

    /**
     * @notice Batch add addresses to whitelist
     */
    function addBatchWhitelist(address[] calldata _users, uint256 _seasonId) external onlyOwner {
        require(seasonStartDate[_seasonId] != 0, "Season not initialized");

        for (uint256 i = 0; i < _users.length; i++) {
            if (!whitelisted[_seasonId][_users[i]]) {
                whitelisted[_seasonId][_users[i]] = true;
                whitelistCount[_seasonId]++;
                emit WhitelistAdded(_users[i], _seasonId);
            }
        }
    }

    /**
     * @notice Batch remove addresses from whitelist
     */
    function removeBatchWhitelist(address[] calldata _users, uint256 _seasonId) external onlyOwner {
        for (uint256 i = 0; i < _users.length; i++) {
            if (whitelisted[_seasonId][_users[i]]) {
                whitelisted[_seasonId][_users[i]] = false;
                whitelistCount[_seasonId]--;
                emit WhitelistRemoved(_users[i], _seasonId);
            }
        }
    }

    // ============ Pass Minting ============

    /**
     * @notice Mint free pass for whitelisted users (FCFS)
     * @dev Gate is per-season (`userMintedSeason`), carried over unchanged
     * from v2. Free passes never involve a token payment, so there's
     * nothing to verify off-chain here.
     */
    function mintFreePass(uint256 _seasonId) external {
        require(seasonStartDate[_seasonId] != 0, "Season not initialized");
        require(whitelisted[_seasonId][msg.sender], "Not whitelisted");
        require(!whitelistClaimed[_seasonId][msg.sender], "Free pass already claimed");
        require(seasonMinted[_seasonId] < seasonSupply[_seasonId], "Season sold out");
        require(!userMintedSeason[msg.sender][_seasonId], "Already have a pass for this season");

        whitelistClaimed[_seasonId][msg.sender] = true;
        _mintPass(msg.sender, _seasonId, true);
    }

    /**
     * @notice Mint a paid pass after off-chain stablecoin payment has
     * already been verified by the backend.
     * @dev Unchanged from v2: payment (in USDm/USDC/USDT, whichever the
     * user holds most of, priced via passPriceUsdCents above) is sent as
     * a plain ERC20 transfer() to TREASURY_WALLET by the frontend,
     * verified on-chain by app/api/passsbt/mint/route.ts, and ONLY THEN
     * does the backend call this function. This function moves no tokens
     * itself — it trusts the backend signer, which is why it's
     * onlyBackend instead of public. Still enforces the same on-chain
     * invariants v1/v2 always did: season must exist, not be sold out,
     * and the user must not already hold a pass for this season.
     */
    function backendMintPass(address _user, uint256 _seasonId) external onlyBackend {
        require(seasonStartDate[_seasonId] != 0, "Season not initialized");
        require(seasonMinted[_seasonId] < seasonSupply[_seasonId], "Season sold out");
        require(!userMintedSeason[_user][_seasonId], "Already have a pass for this season");

        _mintPass(_user, _seasonId, false);
    }

    /**
     * @notice Internal minting logic
     */
    function _mintPass(address _user, uint256 _seasonId, bool _isFree) internal {
        uint256 tokenId = ++_tokenIdCounter;
        tokenSeasonId[tokenId] = _seasonId;
        userMintedSeason[_user][_seasonId] = true;
        lastPassSeason[_user] = _seasonId;
        seasonMinted[_seasonId]++;

        _safeMint(_user, tokenId);
        emit PassMinted(_user, _seasonId, _isFree);
    }

    // ============ SBT Logic (Non-Transferable) ============

    /**
     * @notice Override transfer to prevent token transfers (Soulbound)
     * @dev v3 FIX: uses `_ownerOf(tokenId)` (internal, returns
     * address(0) for a not-yet-minted token) instead of v2's
     * `ownerOf(tokenId)` (public, REVERTS for a not-yet-minted token).
     * `_update()` runs on every mint, and at mint time the token has no
     * owner yet by definition — v2's use of the reverting public
     * `ownerOf()` here meant EVERY mint call reverted with
     * `ERC721NonexistentToken`. `_ownerOf()` is the exact pattern
     * OpenZeppelin's own ERC721Pausable/ERC721Consecutive extensions use
     * for the same "is this a mint/burn/transfer" check.
     */
    function _update(
        address to,
        uint256 tokenId,
        address auth
    ) internal override returns (address) {
        address from = _ownerOf(tokenId);

        // Allow minting and burning, prevent transfers
        require(from == address(0) || to == address(0), "SBT: Non-transferable");

        return super._update(to, tokenId, auth);
    }

    /**
     * @notice Prevent approval for transfers
     */
    function approve(address, uint256) public override {
        revert("SBT: Approve not allowed");
    }

    /**
     * @notice Prevent approval for all transfers
     */
    function setApprovalForAll(address, bool) public override {
        revert("SBT: Approve not allowed");
    }

    // ============ Metadata ============

    /**
     * @notice Return metadata URI for token
     */
    function tokenURI(uint256 _tokenId) public view override returns (string memory) {
        require(_ownerOf(_tokenId) != address(0), "Token does not exist");
        uint256 seasonId = tokenSeasonId[_tokenId];
        return string(abi.encodePacked(BASE_URI, seasonId.toString(), ".json"));
    }

    // ============ Query Functions ============

    /**
     * @notice Determine which initialized season is active right now,
     * based on block.timestamp falling within that season's
     * [startDate, endDate] window. Returns 0 if no season is currently
     * active (e.g. between seasons, or before the first season starts).
     * @dev Loops over `initializedSeasonIds`, bounded by TOTAL_SEASONS
     * (6), so this stays cheap no matter how many seasons exist.
     */
    function getCurrentSeasonId() public view returns (uint256) {
        uint256 len = initializedSeasonIds.length;
        for (uint256 i = 0; i < len; i++) {
            uint256 id = initializedSeasonIds[i];
            if (block.timestamp >= seasonStartDate[id] && block.timestamp <= seasonEndDate[id]) {
                return id;
            }
        }
        return 0;
    }

    /**
     * @notice Check if user has a pass for the CURRENTLY ACTIVE season.
     * @dev Answers "does this user get pass perks right now", matching
     * docs/pass-system.md's per-season design.
     */
    function hasPass(address _user) external view returns (bool) {
        uint256 current = getCurrentSeasonId();
        if (current == 0) return false;
        return userMintedSeason[_user][current];
    }

    /**
     * @notice Check if a user holds a pass for a SPECIFIC season,
     * regardless of whether that season is currently active. Used by
     * NullStateRewardV2.claimSeasonBonus() to gate leaderboard bonus
     * claims on "did this user hold a pass for the season being
     * claimed" — which stays correct even after that season has ended
     * and is no longer the "current" season.
     */
    function hasPassForSeason(address _user, uint256 _seasonId) external view returns (bool) {
        return userMintedSeason[_user][_seasonId];
    }

    /**
     * @notice Get the most recently minted season for a user.
     * @dev Informational only — kept for ABI compatibility with
     * NullStateRewardV2.sol's IPassSBT interface (same function name and
     * signature as v1/v2). Does NOT mean "has an active pass right now";
     * use hasPass() or hasPassForSeason() for that.
     */
    function getUserPassSeason(address _user) external view returns (uint256) {
        return lastPassSeason[_user];
    }

    /**
     * @notice Check if user is whitelisted for season
     */
    function isWhitelisted(address _user, uint256 _seasonId) external view returns (bool) {
        return whitelisted[_seasonId][_user];
    }

    /**
     * @notice Get season details
     */
    function getSeasonInfo(uint256 _seasonId)
        external
        view
        returns (
            uint256 supply,
            uint256 minted,
            uint256 startDate,
            uint256 endDate
        )
    {
        return (
            seasonSupply[_seasonId],
            seasonMinted[_seasonId],
            seasonStartDate[_seasonId],
            seasonEndDate[_seasonId]
        );
    }
}
