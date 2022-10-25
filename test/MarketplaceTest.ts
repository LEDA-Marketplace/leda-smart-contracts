import { expect } from "chai";
import { ethers} from "hardhat";
import { Contract, BigNumber, utils} from "ethers";
const { loadFixture } = require("@nomicfoundation/hardhat-network-helpers");

const URI:string = "sample URI";
const marketplaceFeePercent = 30;
const creatorFeePercentage = 25;
const toWei = (num:number) => ethers.utils.parseEther(num.toString());
const fromWei = (num:number) => ethers.utils.formatEther(num);
const Not_Listed = 0;
const Listed = 1;
const Sold = 2;
const toPercentage = 1000;
const price = 1000;

async function marketplaceFixture() {
        const [owner, minterOne, minterTwo, buyerOne, seller, buyerTwo] = await ethers.getSigners();

        const LedaNFT = await ethers.getContractFactory("LedaNFT");
        const ledaNft = await LedaNFT.deploy("LEDA NFT Collection", "LEDA");

        const ApesNFT = await ethers.getContractFactory("ApesNFT");
        const apesNft = await ApesNFT.deploy("Apes NFTs", "Apes", 5);

        await ledaNft.deployed();
        await apesNft.deployed();
        
        const Marketplace = await ethers.getContractFactory("Marketplace");
        const marketplace = await Marketplace.deploy(0);

        await marketplace.deployed();
        await marketplace.setFeePercentage(marketplaceFeePercent);

        return {ledaNft, apesNft, marketplace, owner, minterOne, minterTwo, buyerOne, seller, buyerTwo}
}

async function mintNFTs() {
    const {ledaNft, marketplace, owner, minterOne, minterTwo, buyerOne, seller, buyerTwo} = await loadFixture(marketplaceFixture);

    //Mint and NFT
    await ledaNft.connect(minterOne).mint(URI, creatorFeePercentage)
    //Minter approves marketplace to spend ledaNft
    
    await ledaNft.connect(minterOne).setApprovalForAll(marketplace.address, true);

    return { ledaNft, marketplace, owner, minterOne, minterTwo, buyerOne, seller, buyerTwo}
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

        it("Should track feeAccount and feePercent of the marketplace", async () => {
            const {marketplace, owner} = await loadFixture(marketplaceFixture);

            //expect(await marketplace.feeAccount()).to.equal(owner.address);
            expect(await marketplace.feePercentage()).to.equal(marketplaceFeePercent);
        });

        it("should track the marketplace's owner to be equal to the owner's account", async () => {
            const {marketplace, owner} = await loadFixture(marketplaceFixture);

            expect(await marketplace.owner()).to.equal(owner.address);
        });

        it("should be able to set a new fee percentage", async () => {
            const {ledaNft, marketplace, minterOne, minterTwo} = await loadFixture(marketplaceFixture);
            const newFeePercentage = 30;
            await marketplace.setFeePercentage(newFeePercentage);

            expect(await marketplace.feePercentage()).to.equal(newFeePercentage);
        });

        it("should be able to list nfts", async () => {
            const {ledaNft, marketplace, minterOne, minterTwo} = await loadFixture(marketplaceFixture);
            await ledaNft.connect(minterOne).mint(URI, creatorFeePercentage);
            await ledaNft.connect(minterTwo).mint(URI, creatorFeePercentage);
            await ledaNft.connect(minterOne).mint(URI, creatorFeePercentage);
            await ledaNft.connect(minterTwo).mint(URI, creatorFeePercentage);

            
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

    describe("Listing NFTs", function () {

        it("should track each minted NFT", async () => {
            const {ledaNft, minterOne, minterTwo} = await loadFixture(marketplaceFixture);

            // minterOne mints an ledaNft
            await expect(ledaNft.connect(minterOne).mint(URI, creatorFeePercentage))
            .to.emit(ledaNft, "LogNFTMinted")
                .withArgs(
                1,
                minterOne.address,
                URI,
                creatorFeePercentage
            );
            
            expect(await ledaNft.tokenCount()).to.equal(1);
            expect(await ledaNft.balanceOf(minterOne.address)).to.equal(1);
            expect(await ledaNft.tokenURI(1)).to.equal(URI);

            // minterTwo mints an ledaNft
            await expect(ledaNft.connect(minterTwo).mint(URI, creatorFeePercentage))
            .to.emit(ledaNft, "LogNFTMinted")
                .withArgs(
                2,
                minterTwo.address,
                URI,
                creatorFeePercentage
            );
            expect(await ledaNft.tokenCount()).to.equal(2);
            expect(await ledaNft.balanceOf(minterTwo.address)).to.equal(1);
            expect(await ledaNft.tokenURI(2)).to.equal(URI);
        });

        it("should track newly created item", async () => {
            const {ledaNft, marketplace,minterOne, minterTwo} = await loadFixture(marketplaceFixture);
            const price = 1000;
            
            await ledaNft.connect(minterOne).mint(URI, creatorFeePercentage);
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
            expect(item.creatorRoyaltiesPercentage).to.equal(creatorFeePercentage);
            expect(item.status).to.equal(Not_Listed);
        });

        it("should initialize listing fees equal to zero", async () => {
            const {ledaNft, marketplace,minterOne, minterTwo} = await loadFixture(marketplaceFixture);

            expect(await marketplace.listingFeePercentage()).to.equal(0);
        });

        it("should be able to change the listing fees", async () => {
            const {ledaNft, marketplace,minterOne, minterTwo} = await loadFixture(marketplaceFixture);
            const newListinFeePercentage = 20;

            await marketplace.setListingFeesPercentage(20);
            expect(await marketplace.listingFeePercentage()).to.equal(newListinFeePercentage);
        });

        it("should pay the listing fee percentage",  async () => {
            const {ledaNft, marketplace,minterOne, minterTwo} = await loadFixture(marketplaceFixture);
            
            expect(await marketplace.getItemsCount()).to.equal(0);

            const newListinFeePercentage = 20;
            await marketplace.setListingFeesPercentage(20);

            await ledaNft.connect(minterOne).mint(URI, creatorFeePercentage);
            await ledaNft.connect(minterOne).setApprovalForAll(marketplace.address, true);

            const listingFees = await marketplace.getListingFees(price);
            
            await marketplace.connect(minterOne).makeItem(ledaNft.address, 1, price, {value: listingFees});

            expect(await marketplace.getItemsCount()).to.equal(1);
            expect(await marketplace.getContractBalance()).to.equal(listingFees);

        })
        
        it("should not fail if price is set to zero", async function () {
            const {ledaNft, marketplace, minterOne} = await loadFixture(mintNFTs);

            await marketplace.connect(minterOne).makeItem(ledaNft.address, 1, 0);
            expect(await await marketplace.itemsCount()).to.equal(1);
            const item = await marketplace.items(1);
            expect(item.price).to.equal(0);
        });
    });
    
    describe("Should purchase marketplace items", () => {
        it("should update item's owner when sold", async () => {
            const {ledaNft, marketplace, owner, minterOne, buyerOne} = await loadFixture(mintNFTs);
            expect(await marketplace.itemsCount()).to.equal(0);

            await marketplace.getContractBalance();

            await marketplace.connect(minterOne).makeItem(ledaNft.address, 1, price);
            await marketplace.connect(minterOne).changeItemStatus(1, Listed);

            const item = await marketplace.items(1);
            expect(item.status).to.equal(Listed);

            // buyerOne purchases item.
            await expect(marketplace.connect(buyerOne).buyItem(1, {value: price}))
            .to.emit(marketplace, "LogBuyItem")
                .withArgs(
                1,
                ledaNft.address,
                1,
                price,
                minterOne.address,
                buyerOne.address
            );
            
            // Item should be marked as sold
            expect((await marketplace.items(1)).status).to.equal(Sold);

            // The buyerOne should now own the ledaNft
            expect(await ledaNft.ownerOf(1)).to.equal(buyerOne.address);
        });

        it("the marketplace should receive the percentage fee", async () => {
            const {ledaNft, marketplace, owner, minterOne, buyerOne} = await loadFixture(mintNFTs);
            
            await marketplace.getContractBalance();

            await marketplace.connect(minterOne).makeItem(ledaNft.address, 1, price);

            await marketplace.connect(minterOne).changeItemStatus(1, Listed);

            const item = await marketplace.items(1);
            expect(item.status).to.equal(Listed);

            await marketplace.connect(buyerOne).buyItem(1, {value: price});

            expect(await ledaNft.ownerOf(1)).to.equal(buyerOne.address);
 
            const contractBalance = await marketplace.getContractBalance();
            const marketplaceFees = price * marketplaceFeePercent/toPercentage;

            expect(contractBalance).to.equal(marketplaceFees);
        });

        it("should give the royalties plus the selling price", async () => {
            const {ledaNft, marketplace, owner, minterOne, buyerOne} = await loadFixture(mintNFTs);
            
            await marketplace.connect(minterOne).makeItem(ledaNft.address, 1, price);
            await marketplace.connect(minterOne).changeItemStatus(1, Listed);

            const item = await marketplace.items(1);
            expect(item.status).to.equal(Listed);

            const minterOneBalance =  await minterOne.getBalance();
            
            await marketplace.connect(buyerOne).buyItem(1, {value: price});
            expect(await ledaNft.ownerOf(1)).to.equal(buyerOne.address);

            const newMinterOneBalance =  await minterOne.getBalance();

            const _creatorAmount = (price * creatorFeePercentage)/toPercentage;
            const _platformFees = (price * marketplaceFeePercent)/toPercentage;
            const _sellerAmount = price - _platformFees - _creatorAmount;

            expect(newMinterOneBalance).to.equal(
                    minterOneBalance
                    .add(_sellerAmount)
                    .add(_creatorAmount)
            );

        });

        it("should give the royalties after reselling the item", async () => {
            const {ledaNft, marketplace, owner, minterOne, buyerOne, buyerTwo} = await loadFixture(mintNFTs);
            
            await marketplace.connect(minterOne).makeItem(ledaNft.address, 1, price);
            await marketplace.connect(minterOne).changeItemStatus(1, Listed);

            const item = await marketplace.items(1);
            const minterOneBalance =  await minterOne.getBalance();
            
            await marketplace.connect(buyerOne).buyItem(1, {value: price});
            
            const newMinterOneBalance =  await minterOne.getBalance();

            const _creatorAmount = (price * creatorFeePercentage)/toPercentage;
            const _platformFees = (price * marketplaceFeePercent)/toPercentage;
            const _sellerAmount = price - _platformFees - _creatorAmount;

            expect(newMinterOneBalance).to.equal(
                    minterOneBalance
                    .add(_sellerAmount)
                    .add(_creatorAmount)
            );

            await ledaNft.connect(buyerOne).setApprovalForAll(marketplace.address, true);
            await marketplace.connect(buyerOne).makeItem(ledaNft.address, 1, price);
            
            await marketplace.connect(buyerOne).changeItemStatus(2, Listed);

            const buyerOneBalance =  await buyerOne.getBalance();

            await marketplace.connect(buyerTwo).buyItem(2, {value: price});
            expect(await ledaNft.ownerOf(1)).to.equal(buyerTwo.address);

            const newBuyerOneBalance =  await buyerOne.getBalance();

            expect(newBuyerOneBalance).to.equal(
                    buyerOneBalance
                    .add(_sellerAmount)
            );

            const newMinterOneBalanceTwo =  await minterOne.getBalance();            

            expect(newMinterOneBalanceTwo).to.equal(
                    newMinterOneBalance
                    .add(_creatorAmount)
            );        
        });

        it("should be able to count sold nfts", async () => {
            const {ledaNft, marketplace, minterOne, minterTwo, buyerOne} = await loadFixture(marketplaceFixture);
            await ledaNft.connect(minterOne).mint(URI, creatorFeePercentage);
            await ledaNft.connect(minterTwo).mint(URI, creatorFeePercentage);
            await ledaNft.connect(minterOne).mint(URI, creatorFeePercentage);
            await ledaNft.connect(minterTwo).mint(URI, creatorFeePercentage);

            await ledaNft.connect(minterOne).setApprovalForAll(marketplace.address, true);
            await ledaNft.connect(minterTwo).setApprovalForAll(marketplace.address, true);

            await marketplace.connect(minterOne).makeItem(ledaNft.address, 1, price);
            await marketplace.connect(minterTwo).makeItem(ledaNft.address, 2, price);
            await marketplace.connect(minterOne).makeItem(ledaNft.address, 3, price);
            await marketplace.connect(minterTwo).makeItem(ledaNft.address, 4, price);

            await marketplace.connect(minterOne).changeItemStatus(1, Listed);
            await marketplace.connect(minterTwo).changeItemStatus(4, Listed);

            await marketplace.connect(buyerOne).buyItem(1, {value: price});
            await marketplace.connect(buyerOne).buyItem(4, {value: price});

            expect(await marketplace.getItemsSold()).to.equal(2);
            expect(await marketplace.getItemsCount()).to.equal(4);
        });

        it("should be able to send collected fees to the owner", async () => {
            const {ledaNft, marketplace, owner, minterOne, minterTwo, buyerOne, buyerTwo} = await loadFixture(marketplaceFixture);

            const newPrice = toWei(1);

            await ledaNft.connect(minterOne).mint(URI, creatorFeePercentage);
            await ledaNft.connect(minterTwo).mint(URI, creatorFeePercentage);
            
            await ledaNft.connect(minterOne).setApprovalForAll(marketplace.address, true);
            await ledaNft.connect(minterTwo).setApprovalForAll(marketplace.address, true);

            const priceOne = newPrice.mul(2);
            const priceTwo = newPrice.mul(3);

            await marketplace.connect(minterOne).makeItem(ledaNft.address, 1, priceOne);
            await marketplace.connect(minterTwo).makeItem(ledaNft.address, 2, priceTwo);
            
            await marketplace.connect(minterOne).changeItemStatus(1, Listed);
            await marketplace.connect(minterTwo).changeItemStatus(2, Listed);

            await marketplace.connect(buyerOne).buyItem(1, {value: priceOne});
            await marketplace.connect(buyerTwo).buyItem(2, {value: priceTwo});

            const firstSaleFees = (await marketplace.feePercentage()).mul(priceOne).div(1000);
            const secondSaleFees = (await marketplace.feePercentage()).mul(priceTwo).div(1000);
            
            expect(await marketplace.getContractBalance()).to.equal(firstSaleFees.add(secondSaleFees));
            const initBalance = await owner.getBalance();
            
            const tx = await marketplace.withdraw();
            const receipt = await tx.wait();

            const gasPaid = receipt.gasUsed.mul(receipt.effectiveGasPrice);
            

            expect(await marketplace.getContractBalance()).to.equal(0);
            const newBalance = await owner.getBalance();
            expect(await owner.getBalance()).to.equal(initBalance.sub(gasPaid).add(firstSaleFees).add(secondSaleFees));
        });

        
    });

    describe("Should fail if requirements are not fullfilled", () => { 
        it("should NOT be able to buy if the item is not listed", async () => {
            const {ledaNft, marketplace, minterOne, buyerOne} = await loadFixture(marketplaceFixture);
            await ledaNft.connect(minterOne).mint(URI, creatorFeePercentage);

            await ledaNft.connect(minterOne).setApprovalForAll(marketplace.address, true);
            await marketplace.connect(minterOne).makeItem(ledaNft.address, 1, price);

            await expect(marketplace.connect(buyerOne).buyItem(1, {value: price}))
            .to.be.revertedWith("item should be listed");
        });

        it("should not be able to set a new fee percentage if caller is not the owner", async () => {
            const {ledaNft, marketplace, minterOne, minterTwo} = await loadFixture(marketplaceFixture);
            const newFeePercentage = 30;
            
            await expect(marketplace.connect(minterOne).setFeePercentage(newFeePercentage))
            .to.be.revertedWith("Ownable: caller is not the owner");
        });

        it("should not be able to set a new listing fee percentage if caller is not the owner", async () => {
            const {ledaNft, marketplace, minterOne, minterTwo} = await loadFixture(marketplaceFixture);
            const newFeePercentage = 30;
            
            await expect(marketplace.connect(minterOne).setListingFeesPercentage(newFeePercentage))
            .to.be.revertedWith("Ownable: caller is not the owner");
        });
    });
    
});