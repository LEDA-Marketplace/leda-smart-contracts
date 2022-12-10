import { expect } from "chai";
import { ethers} from "hardhat";
const { loadFixture } = require("@nomicfoundation/hardhat-network-helpers");

const URI:string = "sample URI";
const feePercent = 1;
const toWei = (num:number) => ethers.utils.parseEther(num.toString())
const fromWei = (num:number) => ethers.utils.formatEther(num)
const price = 1000;
const feeDenominator = 1000;
const creatorFeePercent = 25;

async function ledaNftFixture() {
        const [owner, minterOne, minterTwo, buyerOne, seller, buyerTwo] = await ethers.getSigners();
        
        const LedaNFT = await ethers.getContractFactory("LedaNFT");
        const ledaNft = await LedaNFT.deploy("Leda NFTs", "Leda");

        await ledaNft.deployed();
        
        return { ledaNft, owner, minterOne, minterTwo, buyerOne, seller, buyerTwo}
}

describe("LedaNFT Contract Testing", () => { 
    describe("Minting Leda NFTs", function () {
        it("should be able to mint a Leda NFT", async () => {
            const {ledaNft, owner, minterOne, minterTwo, buyer, seller, buyerTwo} = await loadFixture(ledaNftFixture);

            const tx1 = await ledaNft.connect(owner).mint(URI, creatorFeePercent);
            const tx2 = await ledaNft.connect(owner).mint(URI, creatorFeePercent);
            const receipt = await tx2.wait();

            expect(receipt.events[1].args._owner).to.equal(owner.address);
            expect(receipt.events[1].args._nftId).to.equal(2);
            expect(receipt.events[1].args._royalties).to.equal(creatorFeePercent);
            expect(receipt.events[1].args._nftURI).to.equal("sample URI");
            
            expect(await ledaNft.balanceOf(owner.address)).to.equal(2);
            expect(await ledaNft.totalSupply()).to.equal(2);
            expect(await ledaNft.ownerOf(1)).to.equal(owner.address);
            expect(await ledaNft.tokenURI(1)).to.equal(URI);

        });

        it("should track each minted NFT", async () => {
            const {ledaNft, minterOne, minterTwo} = await loadFixture(ledaNftFixture);

            // minterOne mints an nft
            await expect(ledaNft.connect(minterOne).mint(URI, creatorFeePercent))
            .to.emit(ledaNft, "LogNFTMinted")
                .withArgs(
                1,
                minterOne.address,
                URI,
                creatorFeePercent
            );

            expect(await ledaNft.tokenCount()).to.equal(1);
            expect(await ledaNft.balanceOf(minterOne.address)).to.equal(1);
            expect(await ledaNft.tokenURI(1)).to.equal(URI);

            // minterTwo mints an nft
            await expect(ledaNft.connect(minterTwo).mint(URI, creatorFeePercent))
            .to.emit(ledaNft, "LogNFTMinted")
                .withArgs(
                2,
                minterTwo.address,
                URI,
                creatorFeePercent
            );
            expect(await ledaNft.tokenCount()).to.equal(2);
            expect(await ledaNft.balanceOf(minterTwo.address)).to.equal(1);
            expect(await ledaNft.tokenURI(2)).to.equal(URI);
        });

        it("should not mint if the contract is paused", async () => {
            const {ledaNft, minterOne, minterTwo} = await loadFixture(ledaNftFixture);
            await ledaNft.pause();
            await expect(ledaNft.connect(minterOne).mint(URI, creatorFeePercent))
            .to.be.revertedWith("Pausable: paused");
        });

        it("should mint a token with royalties equal to zero", async () => {
            const {ledaNft, minterOne, minterTwo} = await loadFixture(ledaNftFixture);
            await ledaNft.connect(minterOne).mint(URI, 0);
            expect(await ledaNft.tokenCount()).to.equal(1);
            const price = 100;
            const [_creator, _royalties] = await ledaNft.royaltyInfo(1, price);
            expect(_royalties).to.equal(0);
            expect(_creator).to.equal(minterOne.address);
        });

        it("should fail if the royalties are greater than the maximum creators royalties", async () => {
            const {ledaNft, minterOne, minterTwo} = await loadFixture(ledaNftFixture);

            const creatorRoyalties = 101;

            await expect(ledaNft.connect(minterOne).mint(URI, creatorRoyalties))
            .to.be.revertedWith("Royalties percentage exceeds the maximum value!");

            expect(await ledaNft.tokenCount()).to.equal(0);
            expect(await ledaNft.balanceOf(minterOne.address)).to.equal(0);
        });

        it("should be able to set the maximum royalties amount value", async () => {
            const {ledaNft, minterOne, minterTwo} = await loadFixture(ledaNftFixture);

            const newMaxCreatorRoyalties = 150;

            await expect(ledaNft.connect(minterOne).mint(URI, newMaxCreatorRoyalties))
            .to.be.revertedWith("Royalties percentage exceeds the maximum value!");

            // New max is 15%
            await expect(ledaNft.setMaxCreatorRoyalties(newMaxCreatorRoyalties))
            .to.emit(ledaNft, "LogSetMaxCreatorRoyalties")
            .withArgs(
                newMaxCreatorRoyalties
            );

            await ledaNft.connect(minterOne).mint(URI, newMaxCreatorRoyalties);

            expect(await ledaNft.tokenCount()).to.equal(1);
            expect(await ledaNft.balanceOf(minterOne.address)).to.equal(1);
        });

        it("should verify that the royalties system is in place", async () => {
            const {ledaNft, minterOne, owner, minterTwo, buyerOne} = await loadFixture(ledaNftFixture);
            const _INTERFACE_ID_ERC2981 = "0x2a55205a";
            const success = await ledaNft.supportsInterface(_INTERFACE_ID_ERC2981);
            expect(success).to.equal(true);
        });

        it("should validate nft creator and royalties", async () => {
            const {ledaNft, minterOne, owner, minterTwo} = await loadFixture(ledaNftFixture);

            await ledaNft.connect(minterOne).mint(URI, creatorFeePercent);

            const [_creator, _royalties] = await ledaNft.royaltyInfo(1, price);

            expect(_creator).to.equal(minterOne.address);
            
            const royalties = (price * creatorFeePercent) / feeDenominator;
            expect(_royalties).to.equal(royalties);
        });

        it("should transfer an nft using transferFrom directly", async () => {
            const {ledaNft, minterOne, owner, minterTwo, buyerOne} = await loadFixture(ledaNftFixture);
            await ledaNft.connect(minterOne).mint(URI, creatorFeePercent);

            await ledaNft.connect(minterOne).transferFrom(minterOne.address, buyerOne.address, 1);
            
            expect(await ledaNft.ownerOf(1)).to.equal(buyerOne.address); 
        });

        

        it("should approve someone else to transfer an NFT", async () => {
            const {ledaNft, minterOne, owner, minterTwo, buyerOne} = await loadFixture(ledaNftFixture);
            await ledaNft.connect(minterOne).mint(URI, creatorFeePercent);

            await ledaNft.connect(minterOne).setApprovalForAll(buyerOne.address, true);
            await ledaNft.connect(buyerOne).transferFrom(minterOne.address, buyerOne.address, 1);

            expect(await ledaNft.ownerOf(1)).to.equal(buyerOne.address);
        });

        it("should approve someone else using safeTransferFrom an NFT", async () => {
            const {ledaNft, minterOne, owner, minterTwo, buyerOne} = await loadFixture(ledaNftFixture);
            await ledaNft.connect(minterOne).mint(URI, creatorFeePercent);

            await ledaNft.connect(minterOne).setApprovalForAll(buyerOne.address, true);
            await ledaNft.connect(buyerOne)["safeTransferFrom(address,address,uint256)"](minterOne.address, buyerOne.address, 1);
            
            expect(await ledaNft.ownerOf(1)).to.equal(buyerOne.address);
        });

        it("should be able to burn an NFT", async () => {
            const {ledaNft, minterOne, owner, minterTwo, buyerOne} = await loadFixture(ledaNftFixture);
            await ledaNft.connect(minterOne).mint(URI, creatorFeePercent);
            
            expect(await ledaNft.ownerOf(1)).to.equal(minterOne.address);

            expect(await ledaNft.tokenCount()).to.equal(1);

            await ledaNft.connect(minterOne).burn(1);
            await expect(ledaNft.ownerOf(1))
                .to.be.revertedWith("ERC721: invalid token ID");            
        });
    });
});