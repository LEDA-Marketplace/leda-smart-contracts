// SPDX-License-Identifier: MIT
pragma solidity 0.8.16;

import "@openzeppelin/contracts/token/ERC721/ERC721.sol";
import "@openzeppelin/contracts/token/ERC721/extensions/ERC721Enumerable.sol";
import "@openzeppelin/contracts/token/ERC721/extensions/ERC721URIStorage.sol";
import "@openzeppelin/contracts/security/Pausable.sol";
import "@openzeppelin/contracts/security/ReentrancyGuard.sol";
import "@openzeppelin/contracts/access/Ownable.sol";
import "@openzeppelin/contracts/utils/Counters.sol";

contract LedaNFT is 
        ERC721, 
        ReentrancyGuard, 
        ERC721Enumerable, 
        ERC721URIStorage, 
        Pausable, 
        Ownable 
    {
    using Counters for Counters.Counter;
    Counters.Counter public tokenCount;

    uint public maxCreatorRoyalties;

    struct CreatorInfo {
        address creator;
        uint royalties;
    }
    
    mapping(uint => CreatorInfo) public creatorInfo;

    event LogNFTMinted( uint _nftId, address _owner, string _nftURI, uint _royalties);
    event LogGetCreator(uint _idNFT, address _owner, uint royalties);

    constructor(string memory name, string memory symbol) ERC721(name, symbol)
    {
        // This means that the maximun amount is 10%
        maxCreatorRoyalties = 100;
    }

    function setMaxCreatorRoyalties(uint _maxCreatorRoyalties)
        onlyOwner
        external 
    {
        maxCreatorRoyalties = _maxCreatorRoyalties;
    }

    function pause() external onlyOwner {
        _pause();
    }

    function unpause() external onlyOwner {
        _unpause();
    }

    // Royalties should be received as an integer number
    // i.e., if royalties are 2.5% this contract should receive 25
    function mint(string memory _tokenURI, uint _royaltiesPercentage)
        whenNotPaused
        nonReentrant
        external 
        returns(uint) 
    {
        require(_royaltiesPercentage <= maxCreatorRoyalties, 
                "Royalties percentage exceeds the maximum value!"
                );

        tokenCount.increment();
        uint itemId = tokenCount.current();

        creatorInfo[itemId] = CreatorInfo(msg.sender, _royaltiesPercentage);
        
        _safeMint(msg.sender, itemId);
        _setTokenURI(itemId, _tokenURI);
        
        emit LogNFTMinted(itemId, msg.sender, _tokenURI, _royaltiesPercentage);

        return(itemId);
    }

    function _beforeTokenTransfer(address from, address to, uint256 tokenId)
        internal
        whenNotPaused
        override(ERC721, ERC721Enumerable)
    {
        super._beforeTokenTransfer(from, to, tokenId);

    }

    // The following functions are overrides required by Solidity.

    function _burn(uint256 tokenId) internal override(ERC721, ERC721URIStorage) 
    {
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

    function getCreatorAndRoyalties(uint idNFT) external returns (address, uint) {

        emit LogGetCreator(idNFT, creatorInfo[idNFT].creator, creatorInfo[idNFT].royalties);

        return (creatorInfo[idNFT].creator, creatorInfo[idNFT].royalties);
    }
}