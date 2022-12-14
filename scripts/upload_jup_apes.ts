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
  const jupApesNFT = await JupApesNFT.attach("0xd76b2f2ca06F7F24BAdB5250B73fCe33a0a25C99");
  const owner = "0x9b7920fB94533b0BFbf12914c09b8B22230b6041";
  const royalties = 50;
  const rewards: number[] = [120, 125, 140, 130, 110, 140, 105, 140, 115, 110];
  const totalApes = 5;
  
  for (let i = 4; i < totalApes; i++) {
    console.log("cid: ", obj.table[i].cid);
    let tx1 = await jupApesNFT.mint(
                        owner,
                        obj.table[i].cid,
                        royalties,
                        rewards[i],
                        i+1,
                        { gasPrice: 250000000000,
                          gasLimit: 2100000}
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
