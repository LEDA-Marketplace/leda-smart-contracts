// scripts/1.deploy_box.ts
import { ethers } from "hardhat"
import { upgrades } from "hardhat"

async function main() {

    const [owner] = await ethers.getSigners();
    console.log("\n");
    console.log("Deploying Box...");

    const LedaNFT = await ethers.getContractFactory("LedaNFT");
    const ledaNft = await LedaNFT.deploy("Leda NFT", "LEDA");

    console.log("\nLeda NFT contracts");
    console.log(ledaNft.address, " Leda NFTs contract address");

    const Marketplace = await ethers.getContractFactory("Marketplace");
    const marketplaceFee = 50;
    const proxy = await upgrades.deployProxy(Marketplace, [marketplaceFee], {initializer: 'initialize'});

    saveFrontendFiles(ledaNft , "LedaNFT");
    saveFrontendFiles(proxy , "Marketplace");

    console.log("\nMarketplace proxy contracts: ");
    console.log(proxy.address," Marketplace (proxy) address");
    console.log(await upgrades.erc1967.getImplementationAddress(proxy.address)," getImplementationAddress");
    console.log(await upgrades.erc1967.getAdminAddress(proxy.address)," getAdminAddress");
    console.log("\n");
}

function saveFrontendFiles(contract:any, name:string) {
  const fs = require("fs");
  const hre = require('hardhat');

  const contractsDir = __dirname + "/../data";
  //const contractsDir = "/Users/gimer/Desktop/Stackit/Projects/NFTs/leda-web/src/contracts";

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

main().catch((error) => {
  console.error(error)
  process.exitCode = 1
});