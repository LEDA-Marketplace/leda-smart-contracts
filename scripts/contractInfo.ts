import { ethers } from "hardhat";



async function main() {
  const [deployer] = await ethers.getSigners();

  console.log("Deploying contracts with the account:", deployer.address);
  console.log("Account balance:", (await deployer.getBalance()).toString());
  
  const LedaNFT = await ethers.getContractFactory("LedaNFT");
  const ledaNft = await LedaNFT.attach("0x9fE46736679d2D9a65F0992F2272dE9f3c7fa6e0");
  
  const items = await ledaNft.totalSupply();
  console.log(items);

  console.log(ledaNft.address, " Leda NFTs contract address");
  
}

main()
  .then(() => process.exit(0))
  .catch(error => {
    console.error(error);
    process.exit(1);
  });
