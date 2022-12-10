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
  const jupApesNFT = await JupApesNFT.attach("0x1a1a853b8bc033391ba392387F99E40A29EF279D");
  const owner = "0x9b7920fB94533b0BFbf12914c09b8B22230b6041";
  const royalties = 50;
  const rewards: number[] = [120, 125, 140, 130, 110, 140, 105, 140, 115, 110];
  const totalApes = 5;
  
  for (let i = 0; i < totalApes; i++) {
    console.log("cid: ", obj.table[i].cid);
    let tx1 = await jupApesNFT.mint(
                        owner,
                        obj.table[i].cid,
                        royalties,
                        rewards[i],
                        i+1,
                        { gasPrice: 250000000000,
                          gasLimit: 21000}
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
