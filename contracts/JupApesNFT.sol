// SPDX-License-Identifier: MIT
pragma solidity 0.8.16;

import "@openzeppelin/contracts/token/ERC721/ERC721.sol";
import "@openzeppelin/contracts/access/AccessControl.sol";
import "@openzeppelin/contracts/token/ERC721/extensions/ERC721URIStorage.sol";
import "@openzeppelin/contracts/security/Pausable.sol";
import "@openzeppelin/contracts/security/ReentrancyGuard.sol";
import "@openzeppelin/contracts/access/Ownable.sol";
import "@openzeppelin/contracts/token/common/ERC2981.sol";
import "@openzeppelin/contracts/utils/cryptography/ECDSA.sol";
import "@openzeppelin/contracts/utils/cryptography/draft-EIP712.sol";

contract JupApesNFT is 
        ERC721,
        ERC2981,
        EIP712,
        AccessControl,
        ReentrancyGuard,
        ERC721URIStorage, 
        Pausable,
        Ownable
{
      
    struct NFTVoucher {
        uint256 tokenId;
        uint256 minPrice;
        string uri;
        bytes signature;
    }

    mapping(uint => uint) public stakingRewardsPercentage;
    
    // This means that the maximun amount is 10%
    bytes32 public constant MINTER_ROLE = keccak256("MINTER_ROLE");
    string private constant SIGNING_DOMAIN = "LazyNFT-Voucher";
    string private constant SIGNATURE_VERSION = "1";

    uint public constant MAX_ROYALTIES_PERCENTAGE = 100;
    uint public constant CAP_VALUE = 10000;
    uint private tokenCount;

    event LogNFTMinted(
        uint _nftId,
        address _owner,
        string _nftURI
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
        EIP712(SIGNING_DOMAIN, SIGNATURE_VERSION) 
        {
            _setupRole(MINTER_ROLE, msg.sender);
        }

    function pause() public onlyOwner {
        _pause();
    }

    function unpause() public onlyOwner {
        _unpause();
    }

    function mint(
            address _to,
            string memory _tokenURI,
            uint96 _royaltiesPercentage,
            uint _stakingRewardsPercentage,
            uint tokenId
        )
        external
        nonReentrant
        whenNotPaused
        onlyOwner
        returns(uint) 
    {
        /*require(
            tokenCount.current() < CAP_VALUE, 
            "NFTs are capped to 10,000!"
        );*/
        require(
            tokenCount < CAP_VALUE, 
            "NFTs are capped to 10,000!"
        );

        require(
            tokenId > 0, 
            "tokenId should be greater than zero!"
        );

        require(
            !_exists(tokenId), 
            "tokenId has been created!"
        );

        require(
            _to != address(0), 
            "Receiver can't be the zero address"
        );
        
        // verify if we need to imcrement the Id
        // tokenCount.increment(); 
        // uint tokenId = tokenCount.current();
        stakingRewardsPercentage[tokenId] = _stakingRewardsPercentage;
        emit LogNFTMinted(tokenId, msg.sender, _tokenURI);
        tokenCount++;
        _setTokenRoyalty(tokenId, msg.sender, _royaltiesPercentage);
        _safeMint(_to, tokenId);
        _setTokenURI(tokenId, _tokenURI);
               
        return(tokenId);
    }

    function redeem(address redeemer, NFTVoucher calldata voucher) public payable returns (uint256) {
        address signer = _verify(voucher);

        require(hasRole(MINTER_ROLE, signer), "Signature invalid or unauthorized");

        require(msg.value >= voucher.minPrice, "Insufficient funds to redeem");

        //add royalties
        _safeMint(signer, voucher.tokenId);
        _setTokenURI(voucher.tokenId, voucher.uri);
        // verify this second transfer
        _transfer(signer, redeemer, voucher.tokenId);

        //pendingWithdrawals[signer] += msg.value;

        return voucher.tokenId;
    }

    /// @notice Returns a hash of the given NFTVoucher, prepared using EIP712 typed data hashing rules.
    /// @param voucher An NFTVoucher to hash.
    function _hash(NFTVoucher calldata voucher) internal view returns (bytes32) {
        return _hashTypedDataV4(keccak256(abi.encode(
            keccak256("NFTVoucher(uint256 tokenId,uint256 minPrice,string uri)"),
            voucher.tokenId,
            voucher.minPrice,
            keccak256(bytes(voucher.uri))
        )));
    }

    // Do I need this???
    function getChainID() external view returns (uint256) {
        uint256 id;
        assembly {
            id := chainid()
        }
        return id;
    }

    function _verify(NFTVoucher calldata voucher) internal view returns (address) {
        bytes32 digest = _hash(voucher);
        return ECDSA.recover(digest, voucher.signature);
    }

    /*function getCurrentTokenId() 
        view 
        external 
        returns (uint) 
    {
        return tokenCount.current();
    }*/

    /*function _beforeTokenTransfer(address from, address to, uint256 tokenId)
        internal
        whenNotPaused
        override(ERC721)
    {
        super._beforeTokenTransfer(from, to, tokenId);
    } */

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

    /*function supportsInterface(bytes4 interfaceId) public view virtual override (AccessControl, ERC721) returns (bool) {
        return ERC721.supportsInterface(interfaceId) || AccessControl.supportsInterface(interfaceId);
    }*/

    function _feeDenominator() internal pure override returns (uint96) {
        return 1000;
    }
}