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
        
        const NFT = await ethers.getContractFactory("NFT");
        const nft = await NFT.deploy();

        await nft.deployed();
        
        const Marketplace = await ethers.getContractFactory("Marketplace");
        const marketplace = await Marketplace.deploy(0);

        await nft.deployed();
        await marketplace.deployed();

        await marketplace.setFeePercent(feePercent);

        return { nft, marketplace, owner, minterOne, minterTwo, buyer, seller, buyerTwo}
}

async function mintNFTs() {
    const {nft, marketplace, owner, minterOne, minterTwo, buyer, seller, buyerTwo} = await loadFixture(marketplaceFixture);

    //Mint and NFT
    await nft.connect(minterOne).mint(URI)
    //Minter approves marketplace to spend nft
    
    await nft.connect(minterOne).setApprovalForAll(marketplace.address, true);

    return { nft, marketplace, owner, minterOne, minterTwo, buyer, seller, buyerTwo}
}

describe("Marketplace Contract Testing", () => { 
    describe("Deployment", function () {

        it ("should verify the contract's owner", async () => {
            const {nft, marketplace, owner} = await loadFixture(marketplaceFixture);
            expect(await nft.owner()).to.equal(owner.address);
            expect(await marketplace.owner()).to.equal(owner.address);
        });

        it("Should track name and symbol of the nft collection", async () => {
            const {nft} = await loadFixture(marketplaceFixture);
            
            const nftName = "NFT LEDA Collection"
            const nftSymbol = "LEDA"
            
            expect(await nft.name()).to.equal(nftName);
            expect(await nft.symbol()).to.equal(nftSymbol);
        });

        it("Should track feeAccount and feePercent of the marketplace", async function () {
            const {marketplace, owner} = await loadFixture(marketplaceFixture);
            //expect(await marketplace.feeAccount()).to.equal(owner.address);
            expect(await marketplace.feePercent()).to.equal(1);
        });

        it("should be able to list nfts", async () => {
            const {nft, marketplace, minterOne, minterTwo} = await loadFixture(marketplaceFixture);
            nft.connect(minterOne).mint(URI);
            nft.connect(minterTwo).mint(URI);
            nft.connect(minterOne).mint(URI);

            await nft.connect(minterOne).setApprovalForAll(marketplace.address, true);
            await nft.connect(minterTwo).setApprovalForAll(marketplace.address, true);
            await marketplace.connect(minterOne).makeItem(nft.address, 1, 1);
            await marketplace.connect(minterTwo).makeItem(nft.address, 2, 2);
            await marketplace.connect(minterOne).makeItem(nft.address, 3, 1);

            const itemsCount = await marketplace.getItemsCount();
            
            for (let index = 1; index <= itemsCount; index++) {
                const item = await marketplace.items(index);
                expect(index).to.equal(item.itemId);
            }
        });
    });

    describe("Minting NFTs", function () {
        it("should track each minted NFT", async () => {
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
        });

        it("should track newly created item", async () => {
            const price = 1;
            const {nft, marketplace, minterOne} = await loadFixture(mintNFTs);
            // minterOne offers their nft at a price of 1 ether
            await expect(marketplace.connect(minterOne).makeItem(nft.address, 1 , toWei(price)))
                .to.emit(marketplace, "LogCreateItem")
                .withArgs(
                1,
                nft.address,
                1,
                toWei(price),
                minterOne.address
            )
            // Owner of NFT should now be the marketplace
            expect(await nft.ownerOf(1)).to.equal(marketplace.address);
            // Item count should now equal 1
            expect(await marketplace.itemsCount()).to.equal(1)
            // Get item from items mapping then check fields to ensure they are correct
            const item = await marketplace.items(1)
            expect(item.itemId).to.equal(1)
            expect(item.nft).to.equal(nft.address)
            expect(item.tokenId).to.equal(1)
            expect(item.price).to.equal(toWei(price))
            expect(item.sold).to.equal(false)
        });

        it("should fail if price is set to zero", async function () {
            const {nft, marketplace, minterOne} = await loadFixture(mintNFTs);

            await expect(
                marketplace.connect(minterOne).makeItem(nft.address, 1, 0)
            ).to.be.revertedWith("Price must be greater than zero");
        });
    });

    describe("Should purchase marketplace items", () => {
        const price = 2
        const fee = (feePercent*price/100)
        let totalPriceInWei:number;
        
        
        it("should update item when sold", async () => {
            const {nft, marketplace, owner, minterOne, buyer} = await loadFixture(mintNFTs);

            const sellerInitalEthBal = await minterOne.getBalance();

            await marketplace.connect(minterOne).makeItem(nft.address, 1 , toWei(price));
            
            const feeAccountInitialEthBal = await owner.getBalance()
            // fetch items total price (market fees + item price)
            totalPriceInWei = await marketplace.getTotalPrice(1);

            // buyer purchases item.
            await expect(marketplace.connect(buyer).buyItem(1, {value: totalPriceInWei}))
            .to.emit(marketplace, "LogBuyItem")
                .withArgs(
                1,
                nft.address,
                1,
                toWei(price),
                minterOne.address,
                buyer.address
            )

            const sellerFinalEthBal = await buyer.getBalance()
            
            const feeAccountFinalEthBal = await owner.getBalance()
            // Item should be marked as sold
            expect((await marketplace.items(1)).sold).to.equal(true)
            
            // Seller should receive payment for the price of the NFT sold.
            //expect(+fromWei(sellerFinalEthBal)).to.equal( price + fromWei(sellerInitalEthBal))
            
            // feeAccount should receive fee
            //expect(+fromWei(feeAccountFinalEthBal)).to.equal(+fee + +fromWei(feeAccountInitialEthBal));
            
            // The buyer should now own the nft
            expect(await nft.ownerOf(1)).to.equal(buyer.address);
        });

        it("should fail when buying requisits are not valid", async () => {
            const {nft, marketplace, owner, minterOne, buyer, buyerTwo} = await loadFixture(marketplaceFixture);
            
            await expect(nft.connect(minterOne).mint(URI))
            .to.emit(nft, "LogNFTMinted")
                .withArgs(
                1,
                minterOne.address,
                URI
            )

            await nft.connect(minterOne).setApprovalForAll(marketplace.address, true);
            await marketplace.connect(minterOne).makeItem(nft.address, 1 , toWei(price));
            totalPriceInWei = await marketplace.getTotalPrice(1);

            // fails for invalid item ids
            await expect(
                marketplace.connect(buyer).buyItem(2, {value: totalPriceInWei})
            ).to.be.revertedWith("item does not exist");

            await expect(
                marketplace.connect(buyer).buyItem(0, {value: totalPriceInWei})
            ).to.be.revertedWith("item does not exist");

            // Fails when not enough ether is paid with the transaction. 
            // In this instance, fails when buyer only sends enough ether to cover the price of the nft
            // not the additional market fee.
            await expect(
                marketplace.connect(buyer).buyItem(1, {value: toWei(price)})
            ).to.be.revertedWith("not enough ether to cover item price and market fee");

            // buyer purchases item 1
            await marketplace.connect(buyer).buyItem(1, {value: totalPriceInWei});

            // New buyer tries purchasing item 1 after its been sold 
            await expect(
                marketplace.connect(buyerTwo).buyItem(1, {value: totalPriceInWei})
            ).to.be.revertedWith("item already sold");
        });
        it("should be able to count sold nfts", async () => {
            const {nft, marketplace, minterOne, minterTwo, buyer} = await loadFixture(marketplaceFixture);
            nft.connect(minterOne).mint(URI);
            nft.connect(minterTwo).mint(URI);
            nft.connect(minterOne).mint(URI);
            nft.connect(minterTwo).mint(URI);

            await nft.connect(minterOne).setApprovalForAll(marketplace.address, true);
            await nft.connect(minterTwo).setApprovalForAll(marketplace.address, true);
            await marketplace.connect(minterOne).makeItem(nft.address, 1, toWei(price));
            await marketplace.connect(minterTwo).makeItem(nft.address, 2, toWei(price));
            await marketplace.connect(minterOne).makeItem(nft.address, 3, toWei(price));
            await marketplace.connect(minterTwo).makeItem(nft.address, 4, toWei(price));

            const totalPriceInWei = await marketplace.getTotalPrice(1);

            await marketplace.connect(buyer).buyItem(1, {value: totalPriceInWei});
            await marketplace.connect(buyer).buyItem(4, {value: totalPriceInWei});

            expect(await marketplace.getItemsSold()).to.equal(2);
            expect(await marketplace.getItemsCount()).to.equal(4);

        });
    });
    describe("Should purchase marketplace items", () => {
        const price = 2
        
        it("should be able to update an item listing status", async () => {
            const {nft, marketplace, minterOne} = await loadFixture(marketplaceFixture);
            nft.connect(minterOne).mint(URI);
            
            await nft.connect(minterOne).setApprovalForAll(marketplace.address, true);
            await marketplace.connect(minterOne).makeItem(nft.address, 1, 1);

            await expect(marketplace.connect(minterOne).changeItemStatus(1, false))
            .to.emit(marketplace, "LogChangeStatus")
                .withArgs(
                1,
                minterOne.address,
                false
            );
        });

        it("should NOT be able to buy if the item is not listed", async () => {
            const {nft, marketplace, minterOne, buyer} = await loadFixture(marketplaceFixture);
            nft.connect(minterOne).mint(URI);

            await nft.connect(minterOne).setApprovalForAll(marketplace.address, true);
            await marketplace.connect(minterOne).makeItem(nft.address, 1, toWei(price));

            const totalPriceInWei = await marketplace.getTotalPrice(1);

            await marketplace.connect(minterOne).changeItemStatus(1, false);

            await expect(marketplace.connect(buyer).buyItem(1, {value: totalPriceInWei}))
            .to.be.revertedWith("item should be listed");
            
        });
    });
 
});