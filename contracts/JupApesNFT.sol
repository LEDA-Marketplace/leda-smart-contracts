// SPDX-License-Identifier: MIT
pragma solidity 0.8.16;

import "@openzeppelin/contracts/token/ERC721/ERC721.sol";
import "@openzeppelin/contracts/access/AccessControl.sol";
import "@openzeppelin/contracts/token/ERC721/extensions/ERC721URIStorage.sol";
import "@openzeppelin/contracts/token/ERC721/extensions/ERC721Burnable.sol";
import "@openzeppelin/contracts/security/Pausable.sol";
import "@openzeppelin/contracts/security/ReentrancyGuard.sol";
import "@openzeppelin/contracts/access/Ownable.sol";
import "@openzeppelin/contracts/token/common/ERC2981.sol";
import "@openzeppelin/contracts/utils/cryptography/ECDSA.sol";
import "@openzeppelin/contracts/utils/cryptography/draft-EIP712.sol";
import "./JupApesVoucher.sol";

contract JupApesNFT is 
        ERC721,
        ERC2981,
        EIP712,
        AccessControl,
        ReentrancyGuard,
        ERC721URIStorage,
        ERC721Burnable,
        JupApesVoucher,
        Pausable,
        Ownable
{

    mapping(uint => uint) public stakingRewardsPercentage;
    
    // This means that the maximun amount is 10%
    bytes32 public constant MINTER_ROLE = keccak256("MINTER_ROLE");

    uint public constant MAX_ROYALTIES_PERCENTAGE = 100;
    uint public constant CAP_VALUE = 10000;
    uint public tokenCount;

    event LogNFTMinted(
        uint _nftId,
        address _owner,
        string _nftURI,
        uint _royaltiesPercentage,
        uint _stakingRewardsPercentage
    );

    modifier onlyValidRoyalty(uint _royaltyPercentage) {
        require(
            _royaltyPercentage <= MAX_ROYALTIES_PERCENTAGE, 
            "Royalties percentage should be equal or lesss than 10%"
        );
        _;
    }

    modifier validReceiverAddress(address _to) {
        require(_to != address(0), 
        "Receiver is the zero address");
        _;
    }

    constructor(
            string memory _nameNFT,
            string memory _symbolNFT
        )
        ERC721(_nameNFT, _symbolNFT)
        {
            _setupRole(MINTER_ROLE, msg.sender);
        }

    function pause() external onlyOwner {
        _pause();
    }

    function unpause() external onlyOwner {
        _unpause();
    }

    function mint(
            address _to,
            string memory _tokenURI,
            uint96 _royaltiesPercentage,
            uint _stakingRewardsPercentage,
            uint _tokenId
        )
        external
        nonReentrant
        whenNotPaused
        onlyOwner
        validReceiverAddress(_to)
        onlyValidRoyalty(_royaltiesPercentage)
        returns(uint) 
    {

        require(
            tokenCount < CAP_VALUE, 
            "NFTs are capped to 10,000!"
        );

        require(
            _tokenId > 0, 
            "tokenId should be greater than zero!"
        );

        stakingRewardsPercentage[_tokenId] = _stakingRewardsPercentage;

        emit LogNFTMinted(
                _tokenId, 
                msg.sender, 
                _tokenURI, 
                _royaltiesPercentage, 
                _stakingRewardsPercentage
        );
        tokenCount++;
        _setTokenRoyalty(_tokenId, msg.sender, _royaltiesPercentage);
        _safeMint(_to, _tokenId);
        _setTokenURI(_tokenId, _tokenURI);
               
        return(_tokenId);
    }

    function redeem(address redeemer, NFTVoucher calldata voucher) 
        external 
        payable
        nonReentrant
        validReceiverAddress(redeemer)
        onlyValidRoyalty(voucher.royalties)
        returns (uint256) 
    {
        address signer = _verify(voucher);

        require(
            hasRole(MINTER_ROLE, signer), 
            "Signature invalid or unauthorized"
        );

        require(
            msg.value >= voucher.minPrice, 
            "Insufficient funds to redeem"
        );

        tokenCount++;
        stakingRewardsPercentage[voucher.tokenId] = voucher.stakingRewards;
        _setTokenRoyalty(voucher.tokenId, signer, uint96(voucher.royalties));
        _safeMint(signer, voucher.tokenId);
        _setTokenURI(voucher.tokenId, voucher.uri);

        _safeTransfer(signer, redeemer, voucher.tokenId, "");

        return voucher.tokenId;
    }

    // The following functions are overrides required by Solidity.
    function _burn(uint256 tokenId)
        internal 
        override(ERC721, ERC721URIStorage)
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
        override(ERC721, ERC2981, AccessControl)
        returns (bool)
    {
        return super.supportsInterface(interfaceId) || AccessControl.supportsInterface(interfaceId);
    }

    function getContractBalance()
        external
        view
        returns(uint)
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

    function _feeDenominator() 
        internal 
        pure 
        override 
        returns (uint96) 
    {
        return 1000;
    }
}