// SPDX-License-Identifier: MIT
pragma solidity 0.8.16;

import "../Marketplace.sol";

contract MarketplaceV2Test is Marketplace{

    //constructor() Markeplace(50) {};
    function getVersion () pure public returns (uint) 
    {
        return 2;
    }
}