// SPDX-License-Identifier: CC0-1.0
pragma solidity ^0.8.24;

/// @title OTTERSigil — Soulbound Initiate Badge
/// @notice One free soulbound ERC-721 per address. Non-transferable. On-chain SVG.
/// @dev    No owner, no admin, fully immutable after deploy.
contract OTTERSigil {

    // ─── ERC-721 storage ──────────────────────────────────────────────────────
    string  public  name     = "OTTER Initiate Sigil";
    string  public  symbol   = "SIGIL";
    uint256 public  totalSupply;

    mapping(uint256 => address) private _owner;
    mapping(address => uint256) private _balance;
    mapping(address => uint256) private _holderToken; // address → tokenId (1-indexed)
    mapping(uint256 => uint256) private _mintDate;    // tokenId → timestamp

    // ─── Events ───────────────────────────────────────────────────────────────
    event Transfer(address indexed from, address indexed to, uint256 indexed tokenId);
    event SigilClaimed(address indexed initiate, uint256 indexed tokenId);

    // ─── Errors ───────────────────────────────────────────────────────────────
    error AlreadyInitiated();
    error SigilIsSoulbound();
    error NotTokenOwner();
    error TokenDoesNotExist();

    // ─── ERC-165 ──────────────────────────────────────────────────────────────
    function supportsInterface(bytes4 id) external pure returns (bool) {
        return id == 0x01ffc9a7 // ERC-165
            || id == 0x80ac58cd // ERC-721
            || id == 0x5b5e139f // ERC-721Metadata
            || id == 0x780e9d63; // ERC-721Enumerable (partial)
    }

    // ─── ERC-721 view ─────────────────────────────────────────────────────────
    function ownerOf(uint256 tokenId) public view returns (address) {
        address o = _owner[tokenId];
        if (o == address(0)) revert TokenDoesNotExist();
        return o;
    }

    function balanceOf(address addr) public view returns (uint256) {
        return _balance[addr];
    }

    function tokenOfOwnerByIndex(address addr, uint256 /* index */) external view returns (uint256) {
        uint256 t = _holderToken[addr];
        if (t == 0) revert TokenDoesNotExist();
        return t - 1; // stored 1-indexed, return 0-indexed tokenId
    }

    // ─── Mint ─────────────────────────────────────────────────────────────────
    function mintSigil() external {
        if (_balance[msg.sender] > 0) revert AlreadyInitiated();
        uint256 tokenId = totalSupply;
        totalSupply++;
        _owner[tokenId]        = msg.sender;
        _balance[msg.sender]   = 1;
        _holderToken[msg.sender] = tokenId + 1; // 1-indexed so 0 = "none"
        _mintDate[tokenId]     = block.timestamp;
        emit Transfer(address(0), msg.sender, tokenId);
        emit SigilClaimed(msg.sender, tokenId);
    }

    // ─── Burn (holder only) ───────────────────────────────────────────────────
    function burn(uint256 tokenId) external {
        if (_owner[tokenId] != msg.sender) revert NotTokenOwner();
        _owner[tokenId]       = address(0);
        _balance[msg.sender]  = 0;
        _holderToken[msg.sender] = 0;
        totalSupply--;
        emit Transfer(msg.sender, address(0), tokenId);
    }

    // ─── Transfers — BLOCKED (soulbound) ─────────────────────────────────────
    function transferFrom(address, address, uint256) external pure { revert SigilIsSoulbound(); }
    function safeTransferFrom(address, address, uint256) external pure { revert SigilIsSoulbound(); }
    function safeTransferFrom(address, address, uint256, bytes calldata) external pure { revert SigilIsSoulbound(); }
    function approve(address, uint256) external pure { revert SigilIsSoulbound(); }
    function setApprovalForAll(address, bool) external pure { revert SigilIsSoulbound(); }
    function getApproved(uint256) external pure returns (address) { revert SigilIsSoulbound(); }
    function isApprovedForAll(address, address) external pure returns (bool) { return false; }

    // ─── On-chain metadata ────────────────────────────────────────────────────
    function tokenURI(uint256 tokenId) external view returns (string memory) {
        if (_owner[tokenId] == address(0) && tokenId >= totalSupply) revert TokenDoesNotExist();
        string memory num   = _padded(tokenId, 5);
        string memory date  = _dateStr(_mintDate[tokenId]);
        string memory svg   = _buildSVG(num, date);
        string memory json  = string(abi.encodePacked(
            '{"name":"OTTER Initiate Sigil #', num,
            '","description":"Soulbound initiation badge. Non-transferable. Minted free on Sepolia.","attributes":[{"trait_type":"Sigil","value":"#', num,
            '"},{"trait_type":"Mint Date","value":"', date,
            '"}],"image":"data:image/svg+xml;base64,', _b64(bytes(svg)), '"}'
        ));
        return string(abi.encodePacked("data:application/json;base64,", _b64(bytes(json))));
    }

    function _buildSVG(string memory num, string memory date) internal pure returns (string memory) {
        return string(abi.encodePacked(
            '<svg viewBox="0 0 200 200" xmlns="http://www.w3.org/2000/svg">',
            '<rect width="200" height="200" fill="#000" rx="8"/>',
            '<rect x="1" y="1" width="198" height="198" fill="none" stroke="#C9A84C" stroke-width="1.5" rx="7"/>',
            '<rect x="6" y="6" width="188" height="188" fill="none" stroke="rgba(201,168,76,0.2)" stroke-width="0.5" rx="5"/>',
            unicode'<text x="100" y="95" text-anchor="middle" fill="#C9A84C" font-size="42" font-family="Georgia,serif">◈</text>',
            '<text x="100" y="130" text-anchor="middle" fill="#E8DFC8" font-size="13" font-family="Georgia,serif" letter-spacing="5">INITIATE</text>',
            '<text x="100" y="152" text-anchor="middle" fill="#5C4A2A" font-size="9" font-family="monospace" letter-spacing="2">SIGIL #', num, '</text>',
            '<text x="100" y="170" text-anchor="middle" fill="#2A2010" font-size="8" font-family="monospace">', date, '</text>',
            '</svg>'
        ));
    }

    // ─── Helpers ──────────────────────────────────────────────────────────────
    function _padded(uint256 n, uint8 digits) internal pure returns (string memory) {
        bytes memory b = bytes(_uint2str(n));
        bytes memory out = new bytes(digits);
        uint256 pad = digits > b.length ? digits - b.length : 0;
        for (uint256 i = 0; i < pad; i++) out[i] = "0";
        for (uint256 i = 0; i < b.length && i + pad < digits; i++) out[i + pad] = b[i];
        return string(out);
    }

    function _uint2str(uint256 n) internal pure returns (string memory) {
        if (n == 0) return "0";
        uint256 tmp = n; uint256 len;
        while (tmp != 0) { len++; tmp /= 10; }
        bytes memory b = new bytes(len);
        while (n != 0) { b[--len] = bytes1(uint8(48 + n % 10)); n /= 10; }
        return string(b);
    }

    function _dateStr(uint256 ts) internal pure returns (string memory) {
        if (ts == 0) return "UNKNOWN";
        // Rough YYYY-MM-DD from unix timestamp (no leap-second precision needed)
        uint256 d = ts / 86400;
        uint256 y = 1970; uint256 m; uint256 day;
        while (true) {
            uint256 dy = (_isLeap(y) ? 366 : 365);
            if (d < dy) break;
            d -= dy; y++;
        }
        uint8[12] memory mdays = [31,28,31,30,31,30,31,31,30,31,30,31];
        if (_isLeap(y)) mdays[1] = 29;
        for (m = 0; m < 12; m++) {
            if (d < mdays[m]) break;
            d -= mdays[m];
        }
        day = d + 1; m = m + 1;
        return string(abi.encodePacked(
            _padded(y, 4), "-", _padded(m, 2), "-", _padded(day, 2)
        ));
    }

    function _isLeap(uint256 y) internal pure returns (bool) {
        return (y % 4 == 0 && y % 100 != 0) || y % 400 == 0;
    }

    bytes internal constant _B64 = "ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz0123456789+/";

    function _b64(bytes memory data) internal pure returns (string memory) {
        uint256 len = data.length;
        if (len == 0) return "";
        uint256 outLen = 4 * ((len + 2) / 3);
        bytes memory out = new bytes(outLen);
        uint256 j;
        for (uint256 i = 0; i < len; ) {
            uint256 a = uint8(data[i]);
            uint256 b = i + 1 < len ? uint8(data[i+1]) : 0;
            uint256 c = i + 2 < len ? uint8(data[i+2]) : 0;
            uint256 triple = (a << 16) | (b << 8) | c;
            out[j]   = _B64[(triple >> 18) & 63];
            out[j+1] = _B64[(triple >> 12) & 63];
            out[j+2] = i + 1 < len ? _B64[(triple >> 6) & 63] : bytes1("=");
            out[j+3] = i + 2 < len ? _B64[triple & 63]        : bytes1("=");
            i += 3; j += 4;
        }
        return string(out);
    }
}
