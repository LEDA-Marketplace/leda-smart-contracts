// SPDX-License-Identifier: MIT
pragma solidity 0.8.16;

import "@openzeppelin/contracts/token/ERC721/ERC721.sol";
import "@openzeppelin/contracts/token/ERC721/extensions/ERC721Enumerable.sol";
import "@openzeppelin/contracts/token/ERC721/extensions/ERC721URIStorage.sol";
import "@openzeppelin/contracts/token/ERC721/extensions/ERC721Burnable.sol";
import "@openzeppelin/contracts/security/Pausable.sol";
import "@openzeppelin/contracts/security/ReentrancyGuard.sol";
import "@openzeppelin/contracts/access/Ownable.sol";
import "@openzeppelin/contracts/utils/Counters.sol";
import "@openzeppelin/contracts/token/common/ERC2981.sol";
import "@openzeppelin/contracts/utils/cryptography/ECDSA.sol";
import "@openzeppelin/contracts/utils/cryptography/draft-EIP712.sol";

import "hardhat/console.sol";

contract LedaNFT is 
        ERC721,
        ERC2981,
        EIP712,
        ReentrancyGuard, 
        ERC721Enumerable, 
        ERC721URIStorage,
        ERC721Burnable,
        Pausable, 
        Ownable
    {

    struct NFTVoucher {
        uint256 minPrice;
        string uri;
        address creator;
        uint96 royalties;
        bytes signature;
    }

    mapping(bytes32 => bool) private signatures;

    using Counters for Counters.Counter;
    Counters.Counter public tokenCount;

    string private constant SIGNING_DOMAIN = "LazyLeda-Voucher";
    string private constant SIGNATURE_VERSION = "1";
    uint constant TO_PERCENTAGE = 1000;
    uint public maxCreatorRoyalties;
    uint public lazyMintingFee; 

    event LogNFTMinted( uint _nftId, address _owner, string _nftURI, uint _royalties);
    
    constructor(string memory name, string memory symbol) 
        ERC721(name, symbol)
        EIP712(SIGNING_DOMAIN, SIGNATURE_VERSION) 
    {
        // Maximun royalties percentage is 10%
        maxCreatorRoyalties = 100;
        // Collection Lazy minting fee percentage is 5%
        lazyMintingFee = 50;
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
      
        (bool success, uint tokenId) = 
            mintNFT(msg.sender, _tokenURI, _royaltiesPercentage);

        require(
            success,
            "Minting failed!"
        );
        
        emit LogNFTMinted(tokenId, msg.sender, _tokenURI, _royaltiesPercentage);

        return(tokenId);
    }

    function mintNFT(
            address _newOwner, 
            string memory _tokenURI, 
            uint96 _royaltiesPercentage
        ) 
        private
        returns (bool, uint)
    {
        require(
            _royaltiesPercentage <= maxCreatorRoyalties, 
            "Royalties percentage exceeds the maximum value!"
        );

        tokenCount.increment();
        uint tokenId = tokenCount.current();

        _setTokenRoyalty(tokenId, _newOwner, _royaltiesPercentage);
        _safeMint(_newOwner, tokenId);
        _setTokenURI(tokenId, _tokenURI);

        return (true, tokenId);
    }

    // Add Lazy Minting Feature
    function redeem(address redeemer, NFTVoucher calldata voucher)
        external
        payable
        nonReentrant
        returns (uint256) 
    {
        require(
            !signatures[keccak256(voucher.signature)], 
            "The voucher has been redeemed!"
        );

        require(
            msg.value >= voucher.minPrice, 
            "Insufficient funds to redeem"
        );

        address signer = _verify(voucher);
        
        require(
            signer == voucher.creator, 
            "Signature invalid or unauthorized"
        );

        signatures[keccak256(voucher.signature)] = true;
        (bool success, uint tokenId) = 
            mintNFT(signer, voucher.uri, voucher.royalties);

        require(
            success,
            "Lazy minting failed!"
        );
        _safeTransfer(signer, redeemer, tokenId, "");
   
        uint profits = getProfits(msg.value);
        payable(signer).transfer(profits);
        
        return tokenId;
    }

    function setLazyMintingFee(uint _lazyMintingFee) 
        onlyOwner 
        external
    {
        // This means that the maximun amount is 10%
        lazyMintingFee = _lazyMintingFee;
    }

    function getProfits(uint _receivedAmount)
        view 
        internal
        returns(uint)
    {
        uint _platformFees;
        
        _platformFees = (_receivedAmount * lazyMintingFee) / TO_PERCENTAGE;
        return _receivedAmount - _platformFees;
    }

    function _verify(NFTVoucher calldata voucher) 
        internal 
        view 
        returns (address) 
    {
        bytes32 digest = _hash(voucher);
        return ECDSA.recover(digest, voucher.signature);
    }

    function _hash(NFTVoucher calldata voucher) 
        internal 
        view 
        returns (bytes32) 
    {
        return _hashTypedDataV4(keccak256(abi.encode(
            keccak256("NFTVoucher(uint256 minPrice,string uri,address creator,uint256 royalties)"),
            voucher.minPrice,
            keccak256(bytes(voucher.uri)),
            voucher.creator,
            voucher.royalties
        )));
    }

    function getContractBalance()
        external
        view
        onlyOwner
        returns (uint)
    {
        return address(this).balance;
    }

    function withdraw() 
        external
        onlyOwner
        nonReentrant
    {
        payable(owner()).transfer(address(this).balance);
    }

    function getChainID() external view returns (uint256) {
        uint256 id;
        assembly {
            id := chainid()
        }
        return id;
    }

    function tokenURI(uint256 tokenId)
        public
        view
        override(ERC721, ERC721URIStorage)
        returns (string memory)
    {
        return super.tokenURI(tokenId);
    }

    function _feeDenominator() 
        internal 
        pure 
        override 
        returns (uint96) 
    {
        return 1000;
    }

    // The following functions are overrides required by Solidity.
    function _burn(uint256 tokenId) 
        internal
        override(ERC721, ERC721URIStorage) 
    {
        super._burn(tokenId);
    }

    function _beforeTokenTransfer(address from, address to, uint256 tokenId)
        internal
        whenNotPaused
        override(ERC721, ERC721Enumerable)
    {
        super._beforeTokenTransfer(from, to, tokenId);
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

}