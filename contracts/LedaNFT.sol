// SPDX-License-Identifier: MIT
pragma solidity 0.8.16;

import "@openzeppelin/contracts/token/ERC721/ERC721.sol";
import "@openzeppelin/contracts/token/ERC721/extensions/ERC721Enumerable.sol";
import "@openzeppelin/contracts/token/ERC721/extensions/ERC721URIStorage.sol";
import "@openzeppelin/contracts/security/Pausable.sol";
import "@openzeppelin/contracts/security/ReentrancyGuard.sol";
import "@openzeppelin/contracts/access/Ownable.sol";
import "@openzeppelin/contracts/utils/Counters.sol";
import "@openzeppelin/contracts/token/common/ERC2981.sol";

contract LedaNFT is 
        ERC721,
        ERC2981,
        ReentrancyGuard, 
        ERC721Enumerable, 
        ERC721URIStorage, 
        Pausable, 
        Ownable
    {
    using Counters for Counters.Counter;
    Counters.Counter public tokenCount;

    uint public maxCreatorRoyalties;

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
    function mint(string memory _tokenURI, uint96 _royaltiesPercentage)
        whenNotPaused
        nonReentrant
        external 
        returns(uint) 
    {
        require(
            _royaltiesPercentage <= maxCreatorRoyalties, 
            "Royalties percentage exceeds the maximum value!"
        );

        tokenCount.increment();
        uint tokenId = tokenCount.current();

        _setTokenRoyalty(tokenId, msg.sender, _royaltiesPercentage);
        
        _safeMint(msg.sender, tokenId);
        _setTokenURI(tokenId, _tokenURI);
        
        emit LogNFTMinted(tokenId, msg.sender, _tokenURI, _royaltiesPercentage);

        return(tokenId);
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
        virtual 
        override(ERC721, ERC2981, ERC721Enumerable) 
        returns (bool) 
    {
        return super.supportsInterface(interfaceId);
    }

    function _feeDenominator() internal pure override returns (uint96) {
        return 1000;
    }
}