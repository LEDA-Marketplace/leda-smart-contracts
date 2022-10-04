// SPDX-License-Identifier: MIT
pragma solidity ^0.8.16;

import "@openzeppelin/contracts/token/ERC721/extensions/ERC721URIStorage.sol";
import "@openzeppelin/contracts/utils/Counters.sol";
import "@openzeppelin/contracts/access/Ownable.sol";
import "hardhat/console.sol";

contract ApesNFT is ERC721URIStorage, Ownable {
    uint public constant MAX_ROYALTIES_PERCENTAGE = 10;
    using Counters for Counters.Counter;
    Counters.Counter public tokenCount;
    
    struct Attributes {
        uint idAttribute;
        uint value;
    }

    Attributes[] temp;
    uint public royaltyPercentage;

    mapping(uint => Attributes[]) public onChainData;
    
    event LogNFTMinted(
        uint _nftId,
        address _owner,
        string _nftURI
    );

    modifier onlyValidRoyalty(uint _royaltyPercentage) {
        require(_royaltyPercentage <= MAX_ROYALTIES_PERCENTAGE, "Royalties percentage should be equal or lesss than 10%");
        _;
    }

    constructor(string memory _name, string memory _symbol, uint _royaltyPercentage) ERC721(_name, _symbol)
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
    
    function mint(
            string memory _tokenURI, 
            Attributes[] memory _attributes
        )
        external 
        onlyOwner
        returns(uint) 
    {
        require(tokenCount.current() < 10000, "NFTs are capped to 10,000!");
        
        tokenCount.increment();
        uint itemId = tokenCount.current();
        
        _safeMint(msg.sender, itemId);
        _setTokenURI(itemId, _tokenURI);

        uint totalAttributes = _attributes.length;
                
        for(uint i=0; i < totalAttributes; i++) {
            temp.push(Attributes(_attributes[i].idAttribute, _attributes[i].value));
        }
        
        onChainData[itemId] = temp;
        delete temp;
        emit LogNFTMinted(tokenCount.current(), msg.sender, _tokenURI);
        
        return(itemId);
    }

    function getApeAttributes(uint _nftId)
        external
        view
        returns (Attributes[] memory)
    {
        return onChainData[_nftId];
    }

    function getCurrentTokenId() view external returns (uint) {
        return tokenCount.current();
    }
}