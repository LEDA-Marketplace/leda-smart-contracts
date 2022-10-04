// SPDX-License-Identifier: MIT
pragma solidity ^0.8.16;

import "@openzeppelin/contracts/token/ERC721/extensions/ERC721URIStorage.sol";
import "@openzeppelin/contracts/utils/Counters.sol";
import "@openzeppelin/contracts/access/Ownable.sol";

contract LedaNFT is ERC721URIStorage, Ownable {
    uint public maxCreatorRoyalties;
    using Counters for Counters.Counter;


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

    Counters.Counter public tokenCount;

    constructor(string memory _name, string memory _symbol) ERC721(_name, _symbol){
        maxCreatorRoyalties = 10;
    }

    function setMaxCreatorRoyalties(uint _maxCreatorRoyalties)
        onlyOwner
        external 
    {
        maxCreatorRoyalties = _maxCreatorRoyalties;
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

}