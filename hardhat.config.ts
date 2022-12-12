import { HardhatUserConfig } from "hardhat/config";
import '@openzeppelin/hardhat-upgrades';
import "@nomicfoundation/hardhat-toolbox";
import "@nomiclabs/hardhat-etherscan";
import "@nomiclabs/hardhat-ethers";

require("dotenv").config();

const { GOERLI_URL, PRIVATE_KEY, MAINNET_URL } = process.env;

const PRIVATE = PRIVATE_KEY;
const config: HardhatUserConfig = {
  solidity: "0.8.16",
  defaultNetwork: "hardhat",
  networks: {
    hardhat: {
      chainId: 1337 // We set 1337 to make interacting with MetaMask simpler
    },
    goerli: {
      url: GOERLI_URL || "",
      accounts: PRIVATE_KEY !== undefined ? [PRIVATE_KEY] : [],
      gasPrice: 150000000000,
      gas: 21000
    },
    mainnet: {
      url: MAINNET_URL || "",
      accounts: PRIVATE_KEY !== undefined ? [PRIVATE_KEY] : [],
      gasPrice: 150000000000,
      gas: 21000
      
    },
  },
  etherscan: {
    apiKey: {
      goerli: "K65MVS5BV4QXWYQEZE78IRRF5SG5TSND7C"
    }
  }
};

export default config;
