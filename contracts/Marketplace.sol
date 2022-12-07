// SPDX-License-Identifier: MIT
pragma solidity 0.8.16;

import "@openzeppelin/contracts-upgradeable/access/OwnableUpgradeable.sol";
import "@openzeppelin/contracts-upgradeable/security/PausableUpgradeable.sol";
import "@openzeppelin/contracts-upgradeable/utils/CountersUpgradeable.sol";
import "@openzeppelin/contracts-upgradeable/proxy/utils/Initializable.sol";
import "@openzeppelin/contracts-upgradeable/security/ReentrancyGuardUpgradeable.sol";
import "@openzeppelin/contracts-upgradeable/token/ERC721/IERC721Upgradeable.sol";
import "@openzeppelin/contracts-upgradeable/proxy/utils/UUPSUpgradeable.sol";
import "@openzeppelin/contracts-upgradeable/token/ERC721/utils/ERC721HolderUpgradeable.sol";
import "@openzeppelin/contracts-upgradeable/interfaces/IERC2981Upgradeable.sol";
import "@openzeppelin/contracts-upgradeable/interfaces/IERC165Upgradeable.sol";

contract Marketplace is 
            Initializable,
            UUPSUpgradeable, 
            OwnableUpgradeable, 
            PausableUpgradeable,
            ERC721HolderUpgradeable, 
            ReentrancyGuardUpgradeable
    {
    using CountersUpgradeable for CountersUpgradeable.Counter;
    CountersUpgradeable.Counter private itemsCount;
    CountersUpgradeable.Counter private itemsSold;

    // Royalties should be received as an integer number
    // i.e., if royalties are 2.5% this contract should receive 25
    uint private constant TO_PERCENTAGE = 1000;
    bytes4 private constant _INTERFACE_ID_ERC2981 = 0x2a55205a;

    // Percentage fee on sales
    uint public feePercentage; 
    uint public listingFeePercentage;
    
    enum item_status
    {
      Not_Listed,
      Listed,
      Sold
    }

    struct Item {
        uint itemId;
        address nftAddress;
        uint tokenId;
        uint price;
        address payable seller;
        address payable creator;
        uint creatorRoyalties;
        item_status status;
    }

    // itemId -> Item
    mapping(uint => Item) public items;

    event LogCreateItem(
        uint _itemId,
        address indexed _nft,
        uint _tokenId,
        uint _price,
        address indexed _seller,
        address _creator
    );

    event LogBuyItem(
        uint _itemId,
        address indexed _nft,
        uint _tokenId,
        uint _price,
        address indexed _seller,
        address indexed _buyer
    );

    event LogChangeStatus(
        uint _itemID, 
        address _seller, 
        item_status _newStatus
    );

    event LogChangePrice(
        uint _itemId, 
        address _sender, 
        uint _newPrice
    );

    event LogSettListingFeesPercentage(
        uint _listingFeePercentage
    );
    
    event LogSetFeePercentage(
        uint _feePercentage
    );

    function initialize(uint _feePercentage) 
        public
        initializer
    {
        __UUPSUpgradeable_init();
        __Ownable_init();
        __Pausable_init();
        __ERC721Holder_init();
        feePercentage = _feePercentage;
        listingFeePercentage = 0;
    }

    function setListingFeesPercentage(uint _listingFeePercentage)
        external
        onlyOwner 
    {
        listingFeePercentage = _listingFeePercentage;
        emit LogSettListingFeesPercentage(_listingFeePercentage);
    }

    function setFeePercentage(uint _feePercentage) 
        external 
        onlyOwner 
    {
        feePercentage = _feePercentage;
        emit LogSetFeePercentage(_feePercentage);
    }

    function getListingFees(uint _price)
        public
        view
        returns(uint)
    {
        return (_price * listingFeePercentage)/TO_PERCENTAGE;
    }

    function pause() external onlyOwner {
        _pause();
    }

    function unpause() external onlyOwner {
        _unpause();
    }

    // Make item to offer on the marketplace
    function makeItem(address _nft, uint _tokenId, uint _price)
        external
        whenNotPaused
        nonReentrant
        payable
        returns(uint)
    {
        require(_nft != address(0), "Zero address is not allowed!");
        require(_tokenId > 0, "Token id should be greater than zero!");
        require(
            IERC721Upgradeable(_nft).ownerOf(_tokenId) == msg.sender, 
            "Only owner can list its NFT!"
        );
        require(
            getListingFees(_price) <= msg.value, 
            "Should pay listing fees!"
        );
        
        // increment itemCount
        itemsCount.increment();
        uint itemId = itemsCount.current();
        
        address _creator;
        uint _creatorRoyalties = 0;

        if(checkRoyalties(_nft))
            (_creator, _creatorRoyalties) = IERC2981Upgradeable(_nft).royaltyInfo(_tokenId, _price);
        else
            _creator = msg.sender;
        
        // add new item to items mapping
        items[itemId] = Item(
            itemId,
            _nft,
            _tokenId,
            _price,
            payable(msg.sender),
            payable(_creator),
            _creatorRoyalties,
            item_status.Listed
        );
        // emit Offered event
        emit LogCreateItem(
            itemId,
            _nft,
            _tokenId,
            _price,
            msg.sender,
            _creator
        );

        // transfer nft
        IERC721Upgradeable(_nft).safeTransferFrom(msg.sender, address(this), _tokenId);

        return itemsCount.current();
    }

    function checkRoyalties(address _contract) 
        internal 
        view
        returns (bool) 
    {
        (bool success) = IERC165Upgradeable(_contract).supportsInterface(_INTERFACE_ID_ERC2981);
        return success;
    }
    
    function getListedAgain(uint _itemId, uint _newPrice)
        external
    {
        require(changeItemPrice(_itemId, _newPrice), "Set new price failed!");
        require(changeItemStatus(_itemId, item_status.Listed), "Set new item status failed!");
    }

    function changeItemStatus(uint _itemId, item_status _newStatus)
        public
        returns(bool)
    {
        Item storage item = items[_itemId];
        require(item.seller == msg.sender, "only seller can change status!");
        require(item.status != _newStatus, "status should be new!");
        require(item.status != item_status.Sold, "item already sold!");
        item.status = _newStatus;
        emit LogChangeStatus(_itemId, msg.sender, _newStatus);

        return true;
    }

    function changeItemPrice(uint _itemId, uint _newPrice)
        internal
        returns(bool)
    {
        Item storage item = items[_itemId];
        require(item.seller == msg.sender, "only seller can change status!");
        require(item.status != item_status.Sold, "item already sold!");
        require(item.status == item_status.Not_Listed, "item should not be listed");

        item.price = _newPrice;
        emit LogChangePrice(_itemId, msg.sender, _newPrice);

        return true;
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
   
    function buyItem(uint _itemId) 
        external 
        payable
        nonReentrant
        whenNotPaused
    {
        Item storage item = items[_itemId];
        require(_itemId > 0 && _itemId <= itemsCount.current(), "item does not exist");
        require(msg.value >= item.price, "not enough ether to cover item price and market fee");
        require(item.status == item_status.Listed, "item should be listed");

        uint profits = getProfits(_itemId, item.creatorRoyalties);
        // pay seller and feeAccount
        (item.creator).transfer(item.creatorRoyalties);
        (item.seller).transfer(profits);
        
        // update item to sold
        item.status = item_status.Sold;
        
        // increase counter
        itemsSold.increment();

        // emit Bought event
        emit LogBuyItem(
            _itemId,
            address(item.nftAddress),
            item.tokenId,
            item.price,
            item.seller,
            msg.sender
        );
        // transfer nft to buyer
        address nft = item.nftAddress;

        IERC721Upgradeable(nft).safeTransferFrom(address(this), msg.sender, item.tokenId);
    }

    function getItemsSold() 
        external
        view 
        returns (uint) 
    {
        return itemsSold.current();
    }

    function getItemsCount()
        external
        view
        returns (uint) 
    {
        return itemsCount.current();
    }

    function getProfits(uint _itemId, uint _creatorRoyalties)
        internal
        view 
        returns(uint _sellerAmount)
    {
        uint _platformFees;
        uint _price = items[_itemId].price;
        
        _platformFees = (_price * feePercentage) / TO_PERCENTAGE;
        _sellerAmount = _price - (_platformFees + _creatorRoyalties);
    }

    // This function is required by the OpenZeppelin module.
    function _authorizeUpgrade(address) internal override onlyOwner {}

}