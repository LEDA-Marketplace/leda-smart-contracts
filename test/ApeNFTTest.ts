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
        
        const ApesNFT = await ethers.getContractFactory("ApesNFT");
        const apesNft = await ApesNFT.deploy("Jupe Apes NFTs", "APES", 3);

        await apesNft.deployed();
        
        return { apesNft, owner, minterOne, minterTwo, buyer, seller, buyerTwo}
}

describe("Marketplace Contract Testing", () => { 
    describe("Minting NFTs", function () {
        it("should be able to mint an Ape NFT", async () => {
            const {apesNft, owner, minterOne, minterTwo, buyer, seller, buyerTwo} = await loadFixture(marketplaceFixture);
            await apesNft.connect(owner).mint(URI, [[1,1],[2,0]]);

            expect(await apesNft.balanceOf(owner.address)).to.equal(1);
            expect(await apesNft.getCurrentTokenId()).to.equal(1);
            expect(await apesNft.ownerOf(1)).to.equal(owner.address);
            expect(await apesNft.tokenURI(1)).to.equal(URI);

            const attributes = await apesNft.getApeAttributes(1);
            //console.log("Attributes: ", attributes);
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