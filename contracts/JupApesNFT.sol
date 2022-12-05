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
    mapping (address => uint256) pendingWithdrawals;
    
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

    constructor(
            string memory name, 
            string memory symbol
        )
        ERC721(name, symbol)
        //EIP712(SIGNING_DOMAIN, SIGNATURE_VERSION) 
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

        require(
            !_exists(_tokenId), 
            "tokenId has been created!"
        );

        require(
            _to != address(0), 
            "Receiver is the zero address"
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
        returns (uint256) 
    {
        require(
            redeemer != address(0), 
            "Redeemer is the zero address"
        );

        address signer = _verify(voucher);

        require(hasRole(MINTER_ROLE, signer), "Signature invalid or unauthorized");

        require(msg.value >= voucher.minPrice, "Insufficient funds to redeem");

        tokenCount++;
        //add royalties
        _safeMint(signer, voucher.tokenId);
        _setTokenURI(voucher.tokenId, voucher.uri);
        _safeTransfer(signer, redeemer, voucher.tokenId, "");

        pendingWithdrawals[signer] += msg.value;

        return voucher.tokenId;
    }

    function getChainID() external view returns (uint256) {
        uint256 id;
        assembly {
            id := chainid()
        }
        return id;
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