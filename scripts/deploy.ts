import { ethers } from "hardhat";



async function main() {
  const [deployer] = await ethers.getSigners();

  console.log("Deploying contracts with the account:", deployer.address);
  console.log("Account balance:", (await deployer.getBalance()).toString());

  
  // Get the ContractFactories and Signers here.
  const ApesNFT = await ethers.getContractFactory("ApesNFT");
  const LedaNFT = await ethers.getContractFactory("LedaNFT");
  const Marketplace = await ethers.getContractFactory("Marketplace");
  // deploy contracts
  const marketplace = await Marketplace.deploy(1);
  const apesNft = await ApesNFT.deploy("Jupe Apes", "APES", 3);
  const ledaNft = await LedaNFT.deploy("Leda NFT", "LEDA");

  console.log(marketplace.address, " Marketplace contract address");
  console.log(apesNft.address, " Apes NFTs contract address");
  console.log(ledaNft.address, " Leda NFTs contract address");
  // Save copies of each contracts abi and address to the frontend.
  saveFrontendFiles(marketplace , "Marketplace");
  saveFrontendFiles(ledaNft , "LedaNFT");
  saveFrontendFiles(apesNft , "ApesNFT");
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
