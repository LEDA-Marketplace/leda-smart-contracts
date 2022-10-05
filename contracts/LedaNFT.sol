// SPDX-License-Identifier: MIT
pragma solidity ^0.8.16;

import "@openzeppelin/contracts/token/ERC721/ERC721.sol";
import "@openzeppelin/contracts/token/ERC721/extensions/ERC721Enumerable.sol";
import "@openzeppelin/contracts/token/ERC721/extensions/ERC721URIStorage.sol";
import "@openzeppelin/contracts/security/Pausable.sol";
import "@openzeppelin/contracts/access/Ownable.sol";
import "@openzeppelin/contracts/utils/Counters.sol";

contract LedaNFT is ERC721, ERC721Enumerable, ERC721URIStorage, Pausable, Ownable {
    using Counters for Counters.Counter;
    Counters.Counter private tokenCount;

    uint public maxCreatorRoyalties;

    struct CreatorInfo {
        address creator;
        uint royalties;
    }
    
    mapping(uint => CreatorInfo) public creatorInfo;

    event LogNFTMinted(
        uint _nftId,
        address _owner,
        string _nftURI,
        uint _royalties
    );

    constructor(string memory _name, string memory _symbol) ERC721(_name, _symbol)
    {
        maxCreatorRoyalties = 10;
    }

    function setMaxCreatorRoyalties(uint _maxCreatorRoyalties)
        onlyOwner
        external 
    {
        maxCreatorRoyalties = _maxCreatorRoyalties;
    }

    function pause() public onlyOwner {
        _pause();
    }

    function unpause() public onlyOwner {
        _unpause();
    }

    function mint(string memory _tokenURI, uint _royaltiesPercentage) 
        external 
        returns(uint) 
    {
        require(_royaltiesPercentage <= maxCreatorRoyalties, 
                "Royalties percentage exceeds the maximum value!"
                );

        tokenCount.increment();
        uint itemId = tokenCount.current();
        _safeMint(msg.sender, itemId);
        _setTokenURI(itemId, _tokenURI);

        creatorInfo[itemId] = CreatorInfo(msg.sender, _royaltiesPercentage);

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
}