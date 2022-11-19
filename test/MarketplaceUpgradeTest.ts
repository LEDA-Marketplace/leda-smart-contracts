import { expect } from "chai";
import { ethers} from "hardhat";
import { Contract, BigNumber, utils} from "ethers";
import { upgrades } from "hardhat"
import { IGetCreatorAndRoyalties__factory } from "../typechain-types";
const { loadFixture } = require("@nomicfoundation/hardhat-network-helpers");



const URI:string = "sample URI";
const marketplaceFeePercent = 30;
const creatorFeePercentage = 25;
const toWei = (num:number) => ethers.utils.parseEther(num.toString());
const fromWei = (num:number) => ethers.utils.formatEther(num);
const zero = 0;
const Not_Listed = 0;
const Listed = 1;
const Sold = 2;
const toPercentage = 1000;
const price = 1000;
let proxyV1: Contract;

async function ledaNftFixture () {
    const LedaNFT = await ethers.getContractFactory("LedaNFT");
    const ledaNft = await LedaNFT.deploy("LEDA NFT Collection", "LEDA");
    await ledaNft.deployed();

    return { ledaNft}
}

async function marketplaceFixture() {
        const [owner, minterOne, minterTwo, buyerOne, seller, buyerTwo] = await ethers.getSigners();

        const Marketplace = await ethers.getContractFactory("Marketplace");
            const marketplaceFee = 50;
            
            proxyV1 = await upgrades.deployProxy( 
                Marketplace, 
                [marketplaceFee], 
                {
                    initializer: 'initialize', 
                    pollingInterval: 3000,
                    timeout: 100000,
                    kind: 'uups'
                });

            await proxyV1.deployed();
            await proxyV1.setFeePercentage(marketplaceFeePercent);
            
        return {proxyV1, owner, minterOne, minterTwo, buyerOne, seller, buyerTwo}
}

async function upgradeProxy() {
    const [owner, minterOne, minterTwo, buyerOne, seller, buyerTwo] = await ethers.getSigners();

    const MarketplaceV2Test = await ethers.getContractFactory("MarketplaceV2Test");

    const proxyV2 = await upgrades.upgradeProxy(proxyV1.address, MarketplaceV2Test)

    return {proxyV2, owner, minterOne, minterTwo, buyerOne, seller, buyerTwo}
}

async function mintNFTs() {
    const {ledaNft, owner, proxy, minterOne, minterTwo, buyerOne, seller, buyerTwo} = await loadFixture(marketplaceFixture);

    //Mint and NFT
    await ledaNft.connect(minterOne).mint(URI, creatorFeePercentage)
    //Minter approves marketplace to spend ledaNft
    
    await ledaNft.connect(minterOne).setApprovalForAll(proxy.address, true);

    return { ledaNft, owner, proxy, minterOne, minterTwo, buyerOne, seller, buyerTwo}
}

describe("Upgrading Marketplace Contract Testing", () => { 
    
    describe("Upgrading", function () {
        
        it("should validate original values", async () => {
            const {owner, proxyV1} = await loadFixture(marketplaceFixture);
            expect(await proxyV1.owner()).to.equal(owner.address);
            expect(await proxyV1.feePercentage()).to.equal(marketplaceFeePercent);
            expect(await proxyV1.getItemsCount()).to.equal(zero);
            expect(await proxyV1.getItemsSold()).to.equal(0);


            const {proxyV2} = await loadFixture(upgradeProxy);
            
            expect(await proxyV2.owner()).to.equal(owner.address);
            expect(await proxyV2.feePercentage()).to.equal(marketplaceFeePercent);
            expect(await proxyV2.getItemsCount()).to.equal(zero);
            expect(await proxyV2.getItemsSold()).to.equal(zero);
        });

        it("should validate new contract", async () => {
            const {proxyV2} = await loadFixture(upgradeProxy);
            const newVersion = 2;
            expect(await proxyV2.getVersion()).to.equal(newVersion);
        });

        
        it("should be able to set a new fee percentage", async () => {
            const {proxyV2} = await loadFixture(upgradeProxy);
            const newFeePercentage = 30;
            await proxyV2.setFeePercentage(newFeePercentage);

            expect(await proxyV2.feePercentage()).to.equal(newFeePercentage);
        });
        
        it("should be able to list nfts", async () => {
            const {proxyV2, owner, minterOne, minterTwo, buyerOne, seller, buyerTwo} = await loadFixture(upgradeProxy);
            const {ledaNft} = await loadFixture(ledaNftFixture);

            
            await ledaNft.connect(minterOne).mint(URI, creatorFeePercentage);
            await ledaNft.connect(minterTwo).mint(URI, creatorFeePercentage);
            await ledaNft.connect(minterOne).mint(URI, creatorFeePercentage);
            await ledaNft.connect(minterTwo).mint(URI, creatorFeePercentage);

            
            await ledaNft.connect(minterOne).setApprovalForAll(proxyV2.address, true);
            await ledaNft.connect(minterTwo).setApprovalForAll(proxyV2.address, true);

            await proxyV2.connect(minterOne).makeItem(ledaNft.address, 1, 1000);
            await proxyV2.connect(minterTwo).makeItem(ledaNft.address, 2, 2000);
            await proxyV2.connect(minterOne).makeItem(ledaNft.address, 3, 1000);
            await proxyV2.connect(minterTwo).makeItem(ledaNft.address, 4, 1500);

            const itemsCount = await proxyV2.getItemsCount();
            
            for (let index = 1; index <= itemsCount; index++) {
                const item = await proxyV2.items(index);
                expect(index).to.equal(item.itemId);
            }
        });
    });
    
    describe("Listing NFTs", function () {

        it("Should verify items after upgrading", async () => {
            const {ledaNft} = await loadFixture(ledaNftFixture);
            const [owner, minterOne, minterTwo, buyerOne, seller, buyerTwo] = await ethers.getSigners();
            

            const MarketplaceOriginal = await ethers.getContractFactory("Marketplace");
            const marketplaceFee = 50;
            
            const proxyOne = await upgrades.deployProxy( 
                MarketplaceOriginal, 
                [marketplaceFee], 
                {
                    initializer: 'initialize',
                    kind: 'uups'
                });
            
            await proxyOne.deployed();
            
            await ledaNft.connect(minterOne).mint(URI, creatorFeePercentage);
            await ledaNft.connect(minterTwo).mint(URI, creatorFeePercentage);
            
            await ledaNft.connect(minterOne).setApprovalForAll(proxyOne.address, true);
            await ledaNft.connect(minterTwo).setApprovalForAll(proxyOne.address, true);
            
            await proxyOne.connect(minterOne).makeItem(ledaNft.address, 1, price);
            await proxyOne.connect(minterTwo).makeItem(ledaNft.address, 2, price * 2);

            expect(await proxyOne.listingFeePercentage()).to.equal(zero);
            
            const itemsCount = await proxyOne.getItemsCount();
            
            for (let index = 1; index <= itemsCount; index++) {
                const item = await proxyOne.items(index);
                expect(index).to.equal(item.itemId);
            }

            // Upgrade the contract
            const MarketplaceV2Test = await ethers.getContractFactory("MarketplaceV2Test");

            const proxyTwo = await upgrades.upgradeProxy(proxyOne.address, MarketplaceV2Test);

            const itemsCountTwo = await proxyOne.getItemsCount();

            expect(itemsCountTwo).to.equal(itemsCount);
            expect(await proxyTwo.listingFeePercentage()).to.equal(zero);
            

            for (let index = 1; index <= itemsCountTwo; index++) {
                const item = await proxyTwo.items(index);
                expect(index).to.equal(item.itemId);
            }

            const itemOne = await proxyTwo.items(1);
            const itemTwo = await proxyTwo.items(2);
            const [_receiverOne, _royaltyAmountOne] = await ledaNft.royaltyInfo(itemOne.itemId, price);
            const [_receiverTwo, _royaltyAmountTwo] = await ledaNft.royaltyInfo(itemTwo.itemId, price * 2);

            expect(itemOne.itemId).to.equal(1)
            expect(itemOne.nftAddress).to.equal(ledaNft.address)
            expect(itemOne.tokenId).to.equal(1)
            expect(itemOne.price).to.equal(price)
            expect(itemOne.seller).to.equal(minterOne.address);
            expect(itemOne.creator).to.equal(minterOne.address);
            expect(itemOne.creatorRoyalties).to.equal(_royaltyAmountOne);
            expect(itemOne.status).to.equal(Listed);

            expect(itemTwo.itemId).to.equal(2)
            expect(itemTwo.nftAddress).to.equal(ledaNft.address)
            expect(itemTwo.tokenId).to.equal(2)
            expect(itemTwo.price).to.equal(price * 2)
            expect(itemTwo.seller).to.equal(minterTwo.address);
            expect(itemTwo.creator).to.equal(minterTwo.address);
            expect(itemTwo.creatorRoyalties).to.equal(_royaltyAmountTwo);
            expect(itemTwo.status).to.equal(Listed);
        });

    });
    
    describe("Should buy marketplace items from proxy", () => {
      
        it("should preserve the buying information after upgrading", async () => {
            const {ledaNft} = await loadFixture(ledaNftFixture);
            const [owner, minterOne, minterTwo, buyerOne, seller, buyerTwo] = await ethers.getSigners();
            await ledaNft.connect(minterOne).mint(URI, creatorFeePercentage);

            const MarketplaceOriginal = await ethers.getContractFactory("Marketplace");
            
            const proxyTest = await upgrades.deployProxy( 
                MarketplaceOriginal, 
                [marketplaceFeePercent], 
                {
                    initializer: 'initialize',
                    kind: 'uups'
                });
            
            await proxyTest.deployed();

            await ledaNft.connect(minterOne).setApprovalForAll(proxyTest.address, true);
            await proxyTest.connect(minterOne).makeItem(ledaNft.address, 1, price);
            const minterOneBalance =  await minterOne.getBalance();

            await proxyTest.connect(buyerOne).buyItem(1, {value: price});

            const MarketplaceV2Test = await ethers.getContractFactory("MarketplaceV2Test");
            const proxyTestTwo = await upgrades.upgradeProxy(proxyTest.address, MarketplaceV2Test);

            expect((await proxyTestTwo.items(1)).status).to.equal(Sold);

            expect(await ledaNft.ownerOf(1)).to.equal(buyerOne.address);

            const contractBalance = await proxyTestTwo.getContractBalance();
            const marketplaceFees = price * marketplaceFeePercent/toPercentage;

            expect(contractBalance).to.equal(marketplaceFees);

            const _creatorAmount = (price * creatorFeePercentage)/toPercentage;
            const _platformFees = (price * marketplaceFeePercent)/toPercentage;
            const _sellerAmount = price - _platformFees - _creatorAmount;

            const newMinterOneBalance =  await minterOne.getBalance();
            expect(newMinterOneBalance).to.equal(
                    minterOneBalance
                    .add(_sellerAmount)
                    .add(_creatorAmount)
            );
        });

        it("should preserve reselling royalties after upgrading", async () => {
            const {ledaNft} = await loadFixture(ledaNftFixture);
            const [owner, minterOne, minterTwo, buyerOne, seller, buyerTwo] = await ethers.getSigners();
            await ledaNft.connect(minterOne).mint(URI, creatorFeePercentage);

            const MarketplaceOriginal = await ethers.getContractFactory("Marketplace");
            
            const proxyTest = await upgrades.deployProxy( 
                MarketplaceOriginal, 
                [marketplaceFeePercent], 
                {
                    initializer: 'initialize',
                    kind: 'uups'
                });
            
            await proxyTest.deployed();

            await ledaNft.connect(minterOne).setApprovalForAll(proxyTest.address, true);
            await proxyTest.connect(minterOne).makeItem(ledaNft.address, 1, price);
            const minterOneBalance =  await minterOne.getBalance();

            await proxyTest.connect(buyerOne).buyItem(1, {value: price});

            expect(await proxyTest.getItemsSold()).to.equal(1);
            expect(await proxyTest.getItemsCount()).to.equal(1);

            const MarketplaceV2Test = await ethers.getContractFactory("MarketplaceV2Test");
            const proxyTestTwo = await upgrades.upgradeProxy(proxyTest.address, MarketplaceV2Test);

            await ledaNft.connect(buyerOne).setApprovalForAll(proxyTestTwo.address, true);
            await proxyTestTwo.connect(buyerOne).makeItem(ledaNft.address, 1, price);

            const buyerOneBalance =  await buyerOne.getBalance();

            const newMinterOneBalance =  await minterOne.getBalance();

            await proxyTestTwo.connect(buyerTwo).buyItem(2, {value: price});
            expect(await ledaNft.ownerOf(1)).to.equal(buyerTwo.address);

            const newBuyerOneBalance =  await buyerOne.getBalance();

            const _creatorAmount = (price * creatorFeePercentage)/toPercentage;
            const _platformFees = (price * marketplaceFeePercent)/toPercentage;
            const _sellerAmount = price - _platformFees - _creatorAmount;

            expect(newBuyerOneBalance).to.equal(
                    buyerOneBalance
                    .add(_sellerAmount)
            );

            const newMinterOneBalanceTwo =  await minterOne.getBalance();            

            expect(newMinterOneBalanceTwo).to.equal(
                    newMinterOneBalance
                    .add(_creatorAmount)
            );

            expect(await proxyTestTwo.getItemsSold()).to.equal(2);
            expect(await proxyTestTwo.getItemsCount()).to.equal(2);
        });

        it("should be able to send collected fees to the owner", async () => {
            const {ledaNft} = await loadFixture(ledaNftFixture);
            const [owner, minterOne, minterTwo, buyerOne, seller, buyerTwo] = await ethers.getSigners();
            await ledaNft.connect(minterOne).mint(URI, creatorFeePercentage);

            const MarketplaceOriginal = await ethers.getContractFactory("Marketplace");
            
            const proxyTest = await upgrades.deployProxy( 
                MarketplaceOriginal, 
                [marketplaceFeePercent], 
                {
                    initializer: 'initialize',
                    kind: 'uups'
                });
            
            await proxyTest.deployed();

            await ledaNft.connect(minterOne).setApprovalForAll(proxyTest.address, true);
            await proxyTest.connect(minterOne).makeItem(ledaNft.address, 1, price);

            await proxyTest.connect(buyerOne).buyItem(1, {value: price});
            const firstSaleFees = (await proxyTest.feePercentage()).mul(price).div(1000);

            const minterOneBalance =  await minterOne.getBalance();

            expect(await proxyTest.getContractBalance()).to.equal(firstSaleFees);
            
            const MarketplaceV2Test = await ethers.getContractFactory("MarketplaceV2Test");
            const proxyTestTwo = await upgrades.upgradeProxy(proxyTest.address, MarketplaceV2Test);

            const initBalance = await owner.getBalance();

            const tx = await proxyTestTwo.withdraw();
            const receipt = await tx.wait();

            const gasPaid = receipt.gasUsed.mul(receipt.effectiveGasPrice);

            expect(await proxyTestTwo.getContractBalance()).to.equal(0);

            const newBalance = await owner.getBalance();
            expect(await owner.getBalance()).to.equal(initBalance.sub(gasPaid).add(firstSaleFees));

        });
    });
});