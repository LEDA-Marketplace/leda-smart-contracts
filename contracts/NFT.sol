// SPDX-License-Identifier: MIT
pragma solidity ^0.8.16;

import "@openzeppelin/contracts/token/ERC721/extensions/ERC721URIStorage.sol";
import "@openzeppelin/contracts/utils/Counters.sol";
import "@openzeppelin/contracts/access/Ownable.sol";

contract NFT is ERC721URIStorage, Ownable {
    using Counters for Counters.Counter;

    event LogNFTMinted(
        uint _nftId,
        address _owner,
        string _nftURI
    );

    Counters.Counter public tokenCount;

    constructor() ERC721("NFT LEDA Collection", "LEDA"){}

    function mint(string memory _tokenURI) external returns(uint) {
        tokenCount.increment();
        _safeMint(msg.sender, tokenCount.current());
        _setTokenURI(tokenCount.current(), _tokenURI);
        emit LogNFTMinted(tokenCount.current(), msg.sender, _tokenURI);
        
        return(tokenCount.current());
    }
}