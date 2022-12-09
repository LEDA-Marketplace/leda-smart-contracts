import { ethers } from "hardhat";
const fs = require('fs');

async function main() {
  const [deployer] = await ethers.getSigners();

  console.log("Deploying contracts with the account:", deployer.address);
  console.log("Account balance:", (await deployer.getBalance()).toString());

  // Get the ContractFactories and Signers here.
  const JupApesNFT = await ethers.getContractFactory("JupApesNFT");
  
  // deploy contracts
  const jupApesNft = await JupApesNFT.deploy("Jupe Apes", "APES");
  console.log(jupApesNft.address, " Apes NFTs contract address");
  
  // Save copies of each contracts abi and address to the frontend.
  saveFrontendFiles(jupApesNft , "JupApesNFT");
}

function saveFrontendFiles(contract:any, name:string) {
  const fs = require("fs");
  const hre = require('hardhat');

  const contractsDir = __dirname + "/../data";

  if (!fs.existsSync(contractsDir)) {
    fs.mkdirSync(contractsDir);
  }

  fs.writeFileSync(
    contractsDir + `/${name}-address.json`,
    JSON.stringify({ address: contract.address }, undefined, 2)
  );

  const contractArtifact = hre.artifacts.readArtifactSync(name);

  fs.writeFileSync(
    contractsDir + `/${name}.json`,
    JSON.stringify(contractArtifact, null, 2)
  ); 
}

main()
  .then(() => process.exit(0))
  .catch(error => {
    console.error(error);
    process.exit(1);
  });
