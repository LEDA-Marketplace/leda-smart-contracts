import { expect } from "chai";
import { ethers} from "hardhat";
import { Contract, BigNumber, utils} from "ethers";
const { loadFixture } = require("@nomicfoundation/hardhat-network-helpers");

const URI:string = "sample URI";
const marketplaceFeePercent = 30;
const creatorFeePercent = 25;
const toWei = (num:number) => ethers.utils.parseEther(num.toString())
const fromWei = (num:number) => ethers.utils.formatEther(num)

async function marketplaceFixture() {
        const [owner, minterOne, minterTwo, buyer, seller, buyerTwo] = await ethers.getSigners();
        
        const LedaNFT = await ethers.getContractFactory("LedaNFT");
        const ledaNft = await LedaNFT.deploy("LEDA NFT Collection", "LEDA");

        const ApesNFT = await ethers.getContractFactory("ApesNFT");
        const apesNft = await ApesNFT.deploy("Apes NFTs", "Apes", 5);

        await ledaNft.deployed();
        await apesNft.deployed();
        
        const Marketplace = await ethers.getContractFactory("Marketplace");
        const marketplace = await Marketplace.deploy(0);

        await marketplace.deployed();
        await marketplace.setFeePercent(marketplaceFeePercent);

        return {ledaNft, apesNft, marketplace, owner, minterOne, minterTwo, buyer, seller, buyerTwo}
}

async function mintNFTs() {
    const {ledaNft, marketplace, owner, minterOne, minterTwo, buyer, seller, buyerTwo} = await loadFixture(marketplaceFixture);

    //Mint and NFT
    await ledaNft.connect(minterOne).mint(URI, creatorFeePercent)
    //Minter approves marketplace to spend ledaNft
    
    await ledaNft.connect(minterOne).setApprovalForAll(marketplace.address, true);

    return { ledaNft, marketplace, owner, minterOne, minterTwo, buyer, seller, buyerTwo}
}

describe("Marketplace Contract Testing", () => { 
    describe("Deployment", function () {

        it ("should verify the contract's owner", async () => {
            const {ledaNft, marketplace, owner} = await loadFixture(marketplaceFixture);
            expect(await ledaNft.owner()).to.equal(owner.address);
            expect(await marketplace.owner()).to.equal(owner.address);
        });

        it("Should track name and symbol of the ledaNft collection", async () => {
            const {ledaNft} = await loadFixture(marketplaceFixture);
            
            const nftName = "LEDA NFT Collection"
            const nftSymbol = "LEDA"
            
            expect(await ledaNft.name()).to.equal(nftName);
            expect(await ledaNft.symbol()).to.equal(nftSymbol);
        });

        it("Should track feeAccount and feePercent of the marketplace", async function () {
            const {marketplace, owner} = await loadFixture(marketplaceFixture);
            //expect(await marketplace.feeAccount()).to.equal(owner.address);
            expect(await marketplace.feePercent()).to.equal(marketplaceFeePercent);
        });

        it("should be able to list nfts", async () => {
            const {ledaNft, marketplace, minterOne, minterTwo} = await loadFixture(marketplaceFixture);
            await ledaNft.connect(minterOne).mint(URI, creatorFeePercent);
            await ledaNft.connect(minterTwo).mint(URI, creatorFeePercent);
            await ledaNft.connect(minterOne).mint(URI, creatorFeePercent);
            await ledaNft.connect(minterTwo).mint(URI, creatorFeePercent);

            
            await ledaNft.connect(minterOne).setApprovalForAll(marketplace.address, true);
            await ledaNft.connect(minterTwo).setApprovalForAll(marketplace.address, true);

            await marketplace.connect(minterOne).makeItem(ledaNft.address, 1, 1000);
            await marketplace.connect(minterTwo).makeItem(ledaNft.address, 2, 2000);
            await marketplace.connect(minterOne).makeItem(ledaNft.address, 3, 1000);
            await marketplace.connect(minterTwo).makeItem(ledaNft.address, 4, 1500);

            const itemsCount = await marketplace.getItemsCount();
            
            for (let index = 1; index <= itemsCount; index++) {
                const item = await marketplace.items(index);
                expect(index).to.equal(item.itemId);
            }
        });
    });

    describe("Minting NFTs", function () {
        it("should track each minted NFT", async () => {
            const {ledaNft, minterOne, minterTwo} = await loadFixture(marketplaceFixture);

            // minterOne mints an ledaNft
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

            // minterTwo mints an ledaNft
            await expect(ledaNft.connect(minterTwo).mint(URI, marketplaceFeePercent))
            .to.emit(ledaNft, "LogNFTMinted")
                .withArgs(
                2,
                minterTwo.address,
                URI,
                marketplaceFeePercent
            );
            expect(await ledaNft.tokenCount()).to.equal(2);
            expect(await ledaNft.balanceOf(minterTwo.address)).to.equal(1);
            expect(await ledaNft.tokenURI(2)).to.equal(URI);
        });

        it("should track newly created item", async () => {
            const {ledaNft, marketplace,minterOne, minterTwo} = await loadFixture(marketplaceFixture);
            const price = 1000;
            const Not_Listed = 1;
            
            await ledaNft.connect(minterOne).mint(URI, creatorFeePercent);
            await ledaNft.connect(minterOne).setApprovalForAll(marketplace.address, true);

            await expect(marketplace.connect(minterOne).makeItem(
                    ledaNft.address,
                    1,
                    price
                ))
                .to.emit(marketplace, "LogCreateItem")
                .withArgs(
                    1,
                    ledaNft.address,
                    1,
                    price,
                    minterOne.address,
                    minterOne.address
            )
            
            // Owner of NFT should now be the marketplace
            expect(await ledaNft.ownerOf(1)).to.equal(marketplace.address);
            // Item count should now equal 1
            expect(await marketplace.itemsCount()).to.equal(1)
            // Get item from items mapping then check fields to ensure they are correct
            const item = await marketplace.items(1);
            expect(item.itemId).to.equal(1)
            expect(item.nftAddress).to.equal(ledaNft.address)
            expect(item.tokenId).to.equal(1)
            expect(item.price).to.equal(price)
            expect(item.seller).to.equal(minterOne.address);
            expect(item.creator).to.equal(minterOne.address);
            expect(item.creatorRoyaltiesPercent).to.equal(creatorFeePercent);
            expect(item.status).to.equal(Not_Listed);
        });
        
        it("should not fail if price is set to zero", async function () {
            const {ledaNft, marketplace, minterOne} = await loadFixture(mintNFTs);

            await marketplace.connect(minterOne).makeItem(ledaNft.address, 1, 0);
            expect(await await marketplace.itemsCount()).to.equal(1);
            const item = await marketplace.items(1);
            expect(item.price).to.equal(0);
        });
    });
    
    describe("Should purchase marketplace items", () => {
        const price = 1000;
        const marketplaceFee = (marketplaceFeePercent * price/1000)
        let totalPriceInWei:number;
        
        
        it("should update item when sold", async () => {
            const {ledaNft, marketplace, owner, minterOne, buyer} = await loadFixture(mintNFTs);
            expect(await marketplace.itemsCount()).to.equal(0);

            const Listed = 0;
            const Sold = 2;

            await marketplace.connect(minterOne).makeItem(ledaNft.address, 1 , price);
            await marketplace.connect(minterOne).changeItemStatus(1, Listed);

            const item = await marketplace.items(1);
            expect(item.status).to.equal(Listed);

            // buyer purchases item.
            await expect(marketplace.connect(buyer).buyItem(1, {value: price}))
            .to.emit(marketplace, "LogBuyItem")
                .withArgs(
                1,
                ledaNft.address,
                1,
                price,
                minterOne.address,
                buyer.address
            );
            
            
            // Item should be marked as sold
            expect((await marketplace.items(1)).status).to.equal(Sold);

            // The buyer should now own the ledaNft
            expect(await ledaNft.ownerOf(1)).to.equal(buyer.address);

            const contractBalance = await marketplace.getContractBalance();
            console.log(contractBalance);
            
            // Seller should receive payment for the price of the NFT sold.
            //expect(+fromWei(sellerFinalEthBal)).to.equal( price + fromWei(sellerInitalEthBal))
            
            // feeAccount should receive fee
            //expect(+fromWei(feeAccountFinalEthBal)).to.equal(+fee + +fromWei(feeAccountInitialEthBal));
            
            
        });

        /*
        it("should fail when buying requisits are not valid", async () => {
            const {ledaNft, marketplace, owner, minterOne, buyer, buyerTwo} = await loadFixture(marketplaceFixture);
            
            await expect(ledaNft.connect(minterOne).mint(URI, creatorFeePercent))
            .to.emit(ledaNft, "LogNFTMinted")
                .withArgs(
                1,
                minterOne.address,
                URI
            )

            await ledaNft.connect(minterOne).setApprovalForAll(marketplace.address, true);
            await marketplace.connect(minterOne).makeItem(ledaNft.address, 1 , toWei(price));
            totalPriceInWei = await marketplace.getTotalPrice(1);

            // fails for invalid item ids
            await expect(
                marketplace.connect(buyer).buyItem(2, {value: totalPriceInWei})
            ).to.be.revertedWith("item does not exist");

            await expect(
                marketplace.connect(buyer).buyItem(0, {value: totalPriceInWei})
            ).to.be.revertedWith("item does not exist");

            // Fails when not enough ether is paid with the transaction. 
            // In this instance, fails when buyer only sends enough ether to cover the price of the ledaNft
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
            const {ledaNft, marketplace, minterOne, minterTwo, buyer} = await loadFixture(marketplaceFixture);
            ledaNft.connect(minterOne).mint(URI);
            ledaNft.connect(minterTwo).mint(URI);
            ledaNft.connect(minterOne).mint(URI);
            ledaNft.connect(minterTwo).mint(URI);

            await ledaNft.connect(minterOne).setApprovalForAll(marketplace.address, true);
            await ledaNft.connect(minterTwo).setApprovalForAll(marketplace.address, true);
            await marketplace.connect(minterOne).makeItem(ledaNft.address, 1, toWei(price));
            await marketplace.connect(minterTwo).makeItem(ledaNft.address, 2, toWei(price));
            await marketplace.connect(minterOne).makeItem(ledaNft.address, 3, toWei(price));
            await marketplace.connect(minterTwo).makeItem(ledaNft.address, 4, toWei(price));

            const totalPriceInWei = await marketplace.getTotalPrice(1);

            await marketplace.connect(buyer).buyItem(1, {value: totalPriceInWei});
            await marketplace.connect(buyer).buyItem(4, {value: totalPriceInWei});

            expect(await marketplace.getItemsSold()).to.equal(2);
            expect(await marketplace.getItemsCount()).to.equal(4);

        });
        */
    });
    /*
    describe("Should purchase marketplace items", () => {
        const price = 2
        
        it("should be able to update an item listing status", async () => {
            const {ledaNft, marketplace, minterOne} = await loadFixture(marketplaceFixture);
            ledaNft.connect(minterOne).mint(URI);
            
            await ledaNft.connect(minterOne).setApprovalForAll(marketplace.address, true);
            await marketplace.connect(minterOne).makeItem(ledaNft.address, 1, 1);

            await expect(marketplace.connect(minterOne).changeItemStatus(1, false))
            .to.emit(marketplace, "LogChangeStatus")
                .withArgs(
                1,
                minterOne.address,
                false
            );
        });

        it("should NOT be able to buy if the item is not listed", async () => {
            const {ledaNft, marketplace, minterOne, buyer} = await loadFixture(marketplaceFixture);
            ledaNft.connect(minterOne).mint(URI);

            await ledaNft.connect(minterOne).setApprovalForAll(marketplace.address, true);
            await marketplace.connect(minterOne).makeItem(ledaNft.address, 1, toWei(price));

            const totalPriceInWei = await marketplace.getTotalPrice(1);

            await marketplace.connect(minterOne).changeItemStatus(1, false);

            await expect(marketplace.connect(buyer).buyItem(1, {value: totalPriceInWei}))
            .to.be.revertedWith("item should be listed");
            
        });
    });*/
 
});