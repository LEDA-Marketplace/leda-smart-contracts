import { ethers } from "hardhat";
const fs = require('fs');

async function main() {
  const [deployer] = await ethers.getSigners();

  console.log("Deploying contracts with the account:", deployer.address);
  console.log("Account balance:", (await deployer.getBalance()).toString());

  let fileName = __dirname + "/output.json";
  let json = fs.readFileSync(fileName);
  let obj = JSON.parse(json);

  const JupApesNFT = await ethers.getContractFactory("JupApesNFT");
  const jupApesNFT = await JupApesNFT.attach("0xCf7Ed3AccA5a467e9e704C703E8D87F634fB0Fc9");
  const owner = "0x70997970C51812dc3A010C7d01b50e0d17dc79C8";
  const royalties = 50;
  const rewards: number[] = [120, 125, 140, 130, 110, 140, 105, 140, 115, 110];
  const totalApes = 3;
  
  for (let i = 0; i < totalApes; i++) {
    console.log("cid: ", obj.table[i].cid);
    let tx1 = await jupApesNFT.mint(
                        owner,
                        obj.table[i].cid,
                        royalties,
                        rewards[i],
                        i+1
              );
    await tx1.wait();
  }

  
}

main()
  .then(() => process.exit(0))
  .catch(error => {
    console.error(error);
    process.exit(1);
  });
