// SPDX-License-Identifier: MIT
pragma solidity 0.8.17;

import "@openzeppelin/contracts-upgradeable/access/OwnableUpgradeable.sol";
import "@openzeppelin/contracts-upgradeable/security/PausableUpgradeable.sol";
import "@openzeppelin/contracts-upgradeable/utils/CountersUpgradeable.sol";
import "@openzeppelin/contracts-upgradeable/proxy/utils/Initializable.sol";
import "@openzeppelin/contracts-upgradeable/security/ReentrancyGuardUpgradeable.sol";
import "@openzeppelin/contracts-upgradeable/token/ERC721/IERC721Upgradeable.sol";
import "@openzeppelin/contracts-upgradeable/proxy/utils/UUPSUpgradeable.sol";
import "@openzeppelin/contracts-upgradeable/token/ERC721/utils/ERC721HolderUpgradeable.sol";

import "hardhat/console.sol";

interface IGetCreatorAndRoyalties{
    function getCreatorAndRoyalties(uint idNFT) external returns (address, uint);
}

contract Marketplace is UUPSUpgradeable, OwnableUpgradeable, ERC721HolderUpgradeable, ReentrancyGuardUpgradeable, PausableUpgradeable {
    using CountersUpgradeable for CountersUpgradeable.Counter;
    CountersUpgradeable.Counter private itemsCount;
    CountersUpgradeable.Counter private itemsSold;

    uint public feePercentage; // the fee percentage on sales
    uint public listingFeePercentage;
    // Royalties should be received as an integer number
    // i.e., if royalties are 2.5% this contract should receive 25
    uint constant toPercentage = 1000;

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
        uint creatorRoyaltiesPercentage;
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
        item_status _newStatus);

    event LogChangePrice(
        uint _itemId, 
        address _sender, 
        uint _newPrice);

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
        onlyOwner 
        external 
    {
        listingFeePercentage = _listingFeePercentage;
    }

    function setFeePercentage(uint _feePercentage) 
        onlyOwner 
        external 
    {
        feePercentage = _feePercentage;
    }

    function getListingFees(uint _price)
        public
        view
        returns(uint)
    {
        return (_price * listingFeePercentage)/toPercentage;
    }

    function pause() public onlyOwner {
        _pause();
    }

    function unpause() public onlyOwner {
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
        //require(_price > 0, "Price must be greater than zero!");
        uint listingFeesAmount = getListingFees(_price);
        require(listingFeesAmount <= msg.value, "Should pay listing fees!");
        // increment itemCount
        itemsCount.increment();
        uint itemId = itemsCount.current();
        // transfer nft
        IERC721Upgradeable(_nft).safeTransferFrom(msg.sender, address(this), _tokenId);

        (address _creator, uint _creatorRoyaltiesPercentage) = IGetCreatorAndRoyalties(_nft).getCreatorAndRoyalties(_tokenId);

        // add new item to items mapping
        items[itemId] = Item(
            itemId,
            _nft,
            _tokenId,
            _price,
            payable(msg.sender),
            payable(_creator),
            _creatorRoyaltiesPercentage,
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
        return itemsCount.current();
    }
    
    // This function is required by the OpenZeppelin module.
    function _authorizeUpgrade(address) internal override onlyOwner {}

    function changeItemStatus(uint _itemId, item_status _newStatus)
        external
    {
        Item storage item = items[_itemId];
        require(item.seller == msg.sender, "only seller can change status!");
        require(item.status != _newStatus, "status should be new!");
        require(item.status != item_status.Sold, "item already sold!");
        item.status = _newStatus;
        emit LogChangeStatus(_itemId, msg.sender, _newStatus);
    }

    function changeItemPrice(uint _itemId, uint _newPrice)
        external
    {
        Item storage item = items[_itemId];
        require(item.seller == msg.sender, "only seller can change status!");
        require(item.status != item_status.Sold, "item already sold!");
        require(item.status == item_status.Not_Listed, "item should be listed");
        item.price = _newPrice;
        emit LogChangePrice(_itemId, msg.sender, _newPrice);
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
        whenNotPaused
        nonReentrant 
    {
        Item storage item = items[_itemId];
        require(_itemId > 0 && _itemId <= itemsCount.current(), "item does not exist");
        require(msg.value >= item.price, "not enough ether to cover item price and market fee");
        require(item.status == item_status.Listed, "item should be listed");

        (uint sellerAmount, uint creatorAmount) 
            = getRoyalties(_itemId, item.creatorRoyaltiesPercentage);
        // pay seller and feeAccount
        (item.creator).transfer(creatorAmount);
        (item.seller).transfer(sellerAmount);
        
        // update item to sold
        item.status =  item_status.Sold;
        // transfer nft to buyer
        address nft = item.nftAddress;
        IERC721Upgradeable(nft).safeTransferFrom(address(this), msg.sender, item.tokenId);
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
    }

    function getItemsSold() 
        view 
        public 
        returns (uint) 
    {
        return itemsSold.current();
    }

    function getItemsCount() 
        view 
        public 
        returns (uint) 
    {
        return itemsCount.current();
    }

    function getRoyalties(uint _itemId, uint _creatorRoyaltiesPercentage) 
        view 
        private 
        returns(uint _sellerAmount, uint _creatorAmount)
    {
        uint _platformFees;
        uint _price = items[_itemId].price;
        
        _creatorAmount = (_price * _creatorRoyaltiesPercentage)/toPercentage; 
        _platformFees = (_price * feePercentage)/toPercentage;
        _sellerAmount = _price - _platformFees - _creatorAmount;
    }
}