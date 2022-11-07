import { HardhatUserConfig } from "hardhat/config";
import '@openzeppelin/hardhat-upgrades';
import "@nomicfoundation/hardhat-toolbox";
import "@nomiclabs/hardhat-etherscan";
import { ethers } from "hardhat"

require("dotenv").config();

const { GOERLI_URL, PRIVATE_KEY } = process.env;

const PRIVATE = PRIVATE_KEY;
const config: HardhatUserConfig = {
  solidity: "0.8.17",
  
  networks: {
    hardhat: {
      chainId: 1337 // We set 1337 to make interacting with MetaMask simpler
    },
    goerli: {
      url: GOERLI_URL || "",
      accounts: PRIVATE_KEY !== undefined ? [PRIVATE_KEY] : [],
      gasPrice: 600000000000,
      gas: 50000000000000
    },
  },
  etherscan: {
    apiKey: {
      goerli: "K65MVS5BV4QXWYQEZE78IRRF5SG5TSND7C"
    }
  }
};

export default config;
