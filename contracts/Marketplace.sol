// SPDX-License-Identifier: MIT
pragma solidity ^0.8.16;

import "@openzeppelin/contracts/utils/Counters.sol";
import "@openzeppelin/contracts/token/ERC721/IERC721.sol";
import "@openzeppelin/contracts/security/ReentrancyGuard.sol";
import "@openzeppelin/contracts/security/Pausable.sol";
import "@openzeppelin/contracts/access/Ownable.sol";
import "hardhat/console.sol";

interface IGetCreatorAndRoyalties{
    function getCreatorAndRoyalties(uint idNFT) external returns (address, uint);
}

contract Marketplace is Ownable, ReentrancyGuard, Pausable {
    using Counters for Counters.Counter;
    uint public feePercent; // the fee percentage on sales
    uint public listingFeePercent;
    Counters.Counter public itemsCount;
    Counters.Counter public itemsSold;
    // Royalties should be received as an integer number
    // i.e., if royalties are 2.5% this contract should receive 25
    uint constant toPercentage = 1000;

    enum item_status
    {
      Listed,
      Not_Listed,
      Sold
    }

    struct Item {
        uint itemId;
        address nftAddress;
        uint tokenId;
        uint price;
        address payable seller;
        address payable creator;
        uint creatorRoyaltiesPercent;
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

    constructor(uint _feePercent) {
        feePercent = _feePercent;
        listingFeePercent = 0;
    }

    function setListingFeesPercent(uint _listingFeePercent) 
        onlyOwner 
        external 
    {
        listingFeePercent = _listingFeePercent;
    }

    function setFeePercent(uint _feePercent) 
        onlyOwner 
        external 
    {
        feePercent = _feePercent;
    }

    function getListingFees(uint _price)
        private
        view
        returns(uint)
    {
        return (_price * listingFeePercent)/toPercentage;
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
        IERC721(_nft).transferFrom(msg.sender, address(this), _tokenId);

        if(listingFeesAmount > 0)
            payable(address(this)).transfer(listingFeesAmount);

        (address _creator, uint _creatorRoyaltiesPercent) = IGetCreatorAndRoyalties(_nft).getCreatorAndRoyalties(_tokenId);

        // add new item to items mapping
        items[itemId] = Item(
            itemId,
            _nft,
            _tokenId,
            _price,
            payable(msg.sender),
            payable(_creator),
            _creatorRoyaltiesPercent,
            item_status.Not_Listed
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
            = getRoyalties(_itemId, item.creatorRoyaltiesPercent);
        console.log(sellerAmount);
        console.log(creatorAmount);
        // pay seller and feeAccount
        (item.creator).transfer(creatorAmount);
        (item.seller).transfer(sellerAmount);
        
        // update item to sold
        item.status =  item_status.Sold;
        // transfer nft to buyer
        address nft = item.nftAddress;
        IERC721(nft).transferFrom(address(this), msg.sender, item.tokenId);
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

    function getRoyalties(uint _itemId, uint _creatorRoyaltiesPercent) 
        view 
        private 
        returns(uint _sellerAmount, uint _creatorAmount)
    {
        uint _platformFees;
        uint _price = items[_itemId].price;
        
        _creatorAmount = (_price * _creatorRoyaltiesPercent)/toPercentage; 
        _platformFees = (_price * feePercent)/toPercentage;
        _sellerAmount = _price - _platformFees - _creatorAmount;
    }
}