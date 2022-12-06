// SPDX-License-Identifier: MIT
pragma solidity 0.8.16;

import "@openzeppelin/contracts/utils/cryptography/ECDSA.sol";
import "@openzeppelin/contracts/utils/cryptography/draft-EIP712.sol";

contract JupApesVoucher is EIP712{
    struct NFTVoucher {
        uint256 tokenId;
        uint256 minPrice;
        string uri;
        uint256 royalties;
        uint256 stakingRewards;
        bytes signature;
    }

    string private constant SIGNING_DOMAIN = "LazyNFT-Voucher";
    string private constant SIGNATURE_VERSION = "1";

    constructor() EIP712(SIGNING_DOMAIN, SIGNATURE_VERSION){
    }

    function _verify(NFTVoucher calldata voucher) 
        internal 
        view 
        returns (address) 
    {
        bytes32 digest = _hash(voucher);
        return ECDSA.recover(digest, voucher.signature);
    }

    /// @notice Returns a hash of the given NFTVoucher, prepared using EIP712 typed data hashing rules.
    /// @param voucher An NFTVoucher to hash.
    function _hash(NFTVoucher calldata voucher) 
        internal 
        view 
        returns (bytes32) 
    {   
        return _hashTypedDataV4(keccak256(abi.encode(
            keccak256(
                "NFTVoucher(uint256 tokenId,uint256 minPrice,string uri,uint256 royalties,uint256 stakingRewards)"
            ),
            voucher.tokenId,
            voucher.minPrice,
            keccak256(bytes(voucher.uri)),
            voucher.royalties,
            voucher.stakingRewards
        )));
    }

    function getChainID() external view returns (uint256) {
        uint256 id;
        assembly {
            id := chainid()
        }
        return id;
    }

}