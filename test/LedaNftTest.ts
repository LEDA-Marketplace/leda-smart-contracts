import { expect } from "chai";
import { ethers} from "hardhat";
import { Contract, BigNumber, utils} from "ethers";
const { loadFixture } = require("@nomicfoundation/hardhat-network-helpers");

const URI:string = "sample URI";
const feePercent = 1;
const toWei = (num:number) => ethers.utils.parseEther(num.toString())
const fromWei = (num:number) => ethers.utils.formatEther(num)

async function marketplaceFixture() {
        const [owner, minterOne, minterTwo, buyer, seller, buyerTwo] = await ethers.getSigners();
        
        const LedaNFT = await ethers.getContractFactory("LedaNFT");
        const ledaNft = await LedaNFT.deploy("Leda NFTs", "Leda");

        await ledaNft.deployed();
        
        return { ledaNft, owner, minterOne, minterTwo, buyer, seller, buyerTwo}
}

describe("Marketplace Contract Testing", () => { 
    describe("Minting Leda NFTs", function () {
        it("should be able to mint a Leda NFT", async () => {
            const {ledaNft, owner, minterOne, minterTwo, buyer, seller, buyerTwo} = await loadFixture(marketplaceFixture);
 
            const tx1 = await ledaNft.connect(owner).mint(URI, 3);
            const tx2 = await ledaNft.connect(owner).mint(URI, 5);
            const receipt = await tx2.wait();
            const [events] = receipt.events;
            /*
                console.log("id:", events.args);
                console.log("id:", events.args.tokenId);
            */
            expect(await ledaNft.balanceOf(owner.address)).to.equal(2);
            expect(await ledaNft.totalSupply()).to.equal(2);
            expect(await ledaNft.ownerOf(1)).to.equal(owner.address);
            expect(await ledaNft.tokenURI(1)).to.equal(URI);

        });

        /*it("should track each minted NFT", async () => {
            const {nft, minterOne, minterTwo} = await loadFixture(marketplaceFixture);

            // minterOne mints an nft
            await expect(nft.connect(minterOne).mint(URI))
            .to.emit(nft, "LogNFTMinted")
                .withArgs(
                1,
                minterOne.address,
                URI
            );

            expect(await nft.tokenCount()).to.equal(1);
            expect(await nft.balanceOf(minterOne.address)).to.equal(1);
            expect(await nft.tokenURI(1)).to.equal(URI);

            // minterTwo mints an nft
            await expect(nft.connect(minterTwo).mint(URI))
            .to.emit(nft, "LogNFTMinted")
                .withArgs(
                2,
                minterTwo.address,
                URI
            );
            expect(await nft.tokenCount()).to.equal(2);
            expect(await nft.balanceOf(minterTwo.address)).to.equal(1);
            expect(await nft.tokenURI(2)).to.equal(URI);
        });*/

    });

    
});