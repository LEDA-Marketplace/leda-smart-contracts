// SPDX-License-Identifier: MIT
pragma solidity 0.8.16;

import "@openzeppelin/contracts/token/ERC721/ERC721.sol";
import "@openzeppelin/contracts/token/ERC721/extensions/ERC721Enumerable.sol";
import "@openzeppelin/contracts/token/ERC721/extensions/ERC721URIStorage.sol";
import "@openzeppelin/contracts/security/Pausable.sol";
import "@openzeppelin/contracts/access/Ownable.sol";
import "@openzeppelin/contracts/utils/Counters.sol";

contract JupApesNFT is ERC721, 
        ERC721Enumerable, 
        ERC721URIStorage, 
        Pausable, 
        Ownable
{
    using Counters for Counters.Counter;
    Counters.Counter private tokenCount;
    // This means that the maximun amount is 10%
    uint public constant MAX_ROYALTIES_PERCENTAGE = 100;
    uint public constant CAP_VALUE = 10000;

    uint public royaltyPercentage;

    event LogNFTMinted(
        uint _nftId,
        address _owner,
        string _nftURI
    );

    struct CreatorInfo {
        address creator;
        uint royalties;
    }
    
    mapping(uint => CreatorInfo) public creatorInfo;

    modifier onlyValidRoyalty(uint _royaltyPercentage) {
        require(_royaltyPercentage <= MAX_ROYALTIES_PERCENTAGE, "Royalties percentage should be equal or lesss than 10%");
        _;
    }

    constructor(
        string memory name, 
        string memory symbol, 
        uint _royaltyPercentage) 
        ERC721(name, symbol)
        onlyValidRoyalty(_royaltyPercentage)
    {
        royaltyPercentage = _royaltyPercentage;
    }

    function setRoyaltyPercentage(uint _royaltyPercentage)
        external 
        onlyOwner
        onlyValidRoyalty(_royaltyPercentage)
    {
        royaltyPercentage = _royaltyPercentage;
    }

    function pause() public onlyOwner {
        _pause();
    }

    function unpause() public onlyOwner {
        _unpause();
    }

    mapping(uint => uint) public nftRewards;

    function mint(
            address _to,
            string memory _tokenURI,
            uint percentageRewards
        )
        external
        whenNotPaused
        onlyOwner
        returns(uint) 
    {
        require(tokenCount.current() < CAP_VALUE, "NFTs are capped to 10,000!");
        require(_to != address(0), "Receiver can't be the zero address");
        
        tokenCount.increment();
        uint tokenId = tokenCount.current();
        nftRewards[tokenId] = percentageRewards;

        emit LogNFTMinted(tokenId, msg.sender, _tokenURI);

        _safeMint(_to, tokenId);
        _setTokenURI(tokenId, _tokenURI);
               
        return(tokenId);
    }

    function getCurrentTokenId() view external returns (uint) {
        return tokenCount.current();
    }

    function _beforeTokenTransfer(address from, address to, uint256 tokenId)
        internal
        whenNotPaused
        override(ERC721, ERC721Enumerable)
    {
        super._beforeTokenTransfer(from, to, tokenId);
    }

    // The following functions are overrides required by Solidity.
    function _burn(uint256 tokenId) internal override(ERC721, ERC721URIStorage) {
        super._burn(tokenId);
    }

    function tokenURI(uint256 tokenId)
        public
        view
        override(ERC721, ERC721URIStorage)
        returns (string memory)
    {
        return super.tokenURI(tokenId);
    }

    function supportsInterface(bytes4 interfaceId)
        public
        view
        override(ERC721, ERC721Enumerable)
        returns (bool)
    {
        return super.supportsInterface(interfaceId);
    }
    
}