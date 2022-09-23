// SPDX-License-Identifier: MIT
pragma solidity ^0.8.16;

import "@openzeppelin/contracts/utils/Counters.sol";
import "@openzeppelin/contracts/token/ERC721/IERC721.sol";
import "@openzeppelin/contracts/security/ReentrancyGuard.sol";
import "@openzeppelin/contracts/access/Ownable.sol";
import "hardhat/console.sol";

contract Marketplace is Ownable, ReentrancyGuard {
    using Counters for Counters.Counter;
    // Variables
    //address payable public immutable feeAccount; // the account that receives fees
    uint public feePercent; // the fee percentage on sales 
    Counters.Counter public itemsCount;
    Counters.Counter public itemsSold;

    struct Item {
        uint itemId;
        IERC721 nft;
        uint tokenId;
        uint price;
        address payable seller;
        bool listed;
        bool sold;
    }

    // itemId -> Item
    mapping(uint => Item) public items;

    event LogCreateItem(
        uint itemId,
        address indexed nft,
        uint tokenId,
        uint price,
        address indexed seller
    );

    event LogBuyItem(
        uint itemId,
        address indexed nft,
        uint tokenId,
        uint price,
        address indexed seller,
        address indexed buyer
    );

    event LogChangeStatus(
        uint _itemID, 
        address _seller, 
        bool _newStatus);

    constructor(uint _feePercent) {
        feePercent = _feePercent;
        //feeAccount = payable(msg.sender);
    }

    function setFeePercent(uint _feePercent) 
        onlyOwner 
        external 
    {
        feePercent = _feePercent;
    }

    // Make item to offer on the marketplace
    function makeItem(IERC721 _nft, uint _tokenId, uint _price) 
        external 
        nonReentrant 
    {
        require(_price > 0, "Price must be greater than zero");
        // increment itemCount
        itemsCount.increment();
        uint itemId = itemsCount.current();
        // transfer nft
        _nft.transferFrom(msg.sender, address(this), _tokenId);
        // add new item to items mapping
        items[itemId] = Item(
            itemId, 
            _nft, 
            _tokenId, 
            _price, 
            payable(msg.sender), 
            true,
            false
        );
        // emit Offered event
        emit LogCreateItem(
            itemId,
            address(_nft),
            _tokenId,
            _price,
            msg.sender
        );
    }

    function changeItemStatus(uint _itemId, bool _newStatus)
        external
    {
        Item storage item = items[_itemId];
        require(item.seller == msg.sender, "only seller can change status!");
        require(item.listed != _newStatus, "status should be new!");
        require(!item.sold, "item already sold!");

        item.listed = _newStatus;
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
        nonReentrant 
    {
        uint _totalPrice = getTotalPrice(_itemId);
        Item storage item = items[_itemId];
        require(_itemId > 0 && _itemId <= itemsCount.current(), "item does not exist");
        require(msg.value >= _totalPrice, "not enough ether to cover item price and market fee");
        require(!item.sold, "item already sold");
        require(item.listed, "item should be listed");
        // pay seller and feeAccount
        item.seller.transfer(item.price);
        //feeAccount.transfer(_totalPrice - item.price);
        // update item to sold
        item.sold = true;
        item.listed = false;
        // transfer nft to buyer
        item.nft.transferFrom(address(this), msg.sender, item.tokenId);
        // increase counter
        itemsSold.increment();
        // emit Bought event
        emit LogBuyItem(
            _itemId,
            address(item.nft),
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

    function getTotalPrice(uint _itemId) 
        view 
        public 
        returns(uint)
    {
        return((items[_itemId].price*(100 + feePercent))/100);
    }
}