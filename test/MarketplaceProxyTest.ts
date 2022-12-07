import { expect } from "chai";
import { ethers} from "hardhat";
import { Contract, BigNumber, utils} from "ethers";
import { upgrades } from "hardhat"
const { loadFixture } = require("@nomicfoundation/hardhat-network-helpers");

const URI:string = "sample URI";
const marketplaceFeePercent = 30;
const creatorFeePercentage = 25;
const toWei = (num:number) => ethers.utils.parseEther(num.toString());
const fromWei = (num:number) => ethers.utils.formatEther(num);
const zeroAddress = "0x0000000000000000000000000000000000000000";
const Not_Listed = 0;
const Listed = 1;
const Sold = 2;
const toPercentage = 1000;
const price = 1000;

async function marketplaceFixture() {
        const [owner, minterOne, minterTwo, buyerOne, seller, buyerTwo] = await ethers.getSigners();

        const LedaNFT = await ethers.getContractFactory("LedaNFT");
        const ledaNft = await LedaNFT.deploy("LEDA NFT Collection", "LEDA");
        await ledaNft.deployed();

        const Marketplace = await ethers.getContractFactory("Marketplace");
            const marketplaceFee = 50;
            
            const proxy = await upgrades.deployProxy( 
                Marketplace, 
                [marketplaceFee], 
                {
                    initializer: 'initialize', 
                    pollingInterval: 3000,
                    timeout: 100000,
                    kind: 'uups'
                });

            await proxy.deployed()
            await proxy.setFeePercentage(marketplaceFeePercent);
            const proxyOwner = await proxy.owner();


        return {ledaNft, proxy, owner, minterOne, minterTwo, buyerOne, seller, buyerTwo}
}

async function mintNFTs() {
    const {ledaNft, owner, proxy, minterOne, minterTwo, buyerOne, seller, buyerTwo} = await loadFixture(marketplaceFixture);

    //Mint and NFT
    await ledaNft.connect(minterOne).mint(URI, creatorFeePercentage)
    //Minter approves marketplace to spend ledaNft
    
    await ledaNft.connect(minterOne).setApprovalForAll(proxy.address, true);

    return { ledaNft, owner, proxy, minterOne, minterTwo, buyerOne, seller, buyerTwo}
}

describe("Marketplace Contract Testing", () => { 
    
    describe("Deployment", function () {
        it ("should verify the Leda's owner", async () => {
            const {ledaNft, owner} = await loadFixture(marketplaceFixture);
            expect(await ledaNft.owner()).to.equal(owner.address);
        });

        it("should track the marketplace's owner to be equal to the owner's account", async () => {
            const {owner, proxy} = await loadFixture(marketplaceFixture);

            expect(await proxy.owner()).to.equal(owner.address);
        });

        it("Should track name and symbol of the ledaNft collection", async () => {
            const {ledaNft} = await loadFixture(marketplaceFixture);
            
            const nftName = "LEDA NFT Collection"
            const nftSymbol = "LEDA"
            
            expect(await ledaNft.name()).to.equal(nftName);
            expect(await ledaNft.symbol()).to.equal(nftSymbol);
        });

        it("Should track feePercent of the marketplace", async () => {
            const {proxy} = await loadFixture(marketplaceFixture);

            expect(await proxy.feePercentage()).to.equal(marketplaceFeePercent);
        });

        it("should be able to set a new fee percentage", async () => {
            const {proxy} = await loadFixture(marketplaceFixture);
            const newFeePercentage = 30;
            await proxy.setFeePercentage(newFeePercentage);

            expect(await proxy.feePercentage()).to.equal(newFeePercentage);
        });
        
        it("should be able to list nfts", async () => {
            const {ledaNft, proxy, minterOne, minterTwo} = await loadFixture(marketplaceFixture);
            await ledaNft.connect(minterOne).mint(URI, creatorFeePercentage);
            await ledaNft.connect(minterTwo).mint(URI, creatorFeePercentage);
            await ledaNft.connect(minterOne).mint(URI, creatorFeePercentage);
            await ledaNft.connect(minterTwo).mint(URI, creatorFeePercentage);

            
            await ledaNft.connect(minterOne).setApprovalForAll(proxy.address, true);
            await ledaNft.connect(minterTwo).setApprovalForAll(proxy.address, true);

            await proxy.connect(minterOne).makeItem(ledaNft.address, 1, 1000);
            await proxy.connect(minterTwo).makeItem(ledaNft.address, 2, 2000);
            await proxy.connect(minterOne).makeItem(ledaNft.address, 3, 1000);
            await proxy.connect(minterTwo).makeItem(ledaNft.address, 4, 1500);

            const itemsCount = await proxy.getItemsCount();
            
            for (let index = 1; index <= itemsCount; index++) {
                const item = await proxy.items(index);
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
            const {ledaNft, proxy,minterOne} = await loadFixture(marketplaceFixture);
            await ledaNft.connect(minterOne).mint(URI, creatorFeePercentage);
            await ledaNft.connect(minterOne).setApprovalForAll(proxy.address, true);

            await expect(proxy.connect(minterOne).makeItem(
                    ledaNft.address,
                    1,
                    price
                ))
                .to.emit(proxy, "LogCreateItem")
                .withArgs(
                    1,
                    ledaNft.address,
                    1,
                    price,
                    minterOne.address,
                    minterOne.address
            )
            //
            

            // Owner of NFT should now be the marketplace
            expect(await ledaNft.ownerOf(1)).to.equal(proxy.address);
            // Item count should now equal 1
            expect(await proxy.getItemsCount()).to.equal(1)
            // Get item from items mapping then check fields to ensure they are correct
            const item = await proxy.items(1);
            const [_receiver, _royaltyAmount] = await ledaNft.royaltyInfo(item.itemId, price);
            
            expect(item.itemId).to.equal(1)
            expect(item.nftAddress).to.equal(ledaNft.address)
            expect(item.tokenId).to.equal(1)
            expect(item.price).to.equal(price)
            expect(item.seller).to.equal(minterOne.address);
            expect(item.creator).to.equal(minterOne.address);
            expect(item.creatorRoyalties).to.equal(_royaltyAmount);
            expect(item.status).to.equal(Listed);
        });

        
        it("should initialize listing fees equal to zero", async () => {
            const {ledaNft, proxy,minterOne, minterTwo} = await loadFixture(marketplaceFixture);

            expect(await proxy.listingFeePercentage()).to.equal(0);
        });
        
        it("should be able to change the listing fees", async () => {
            const {proxy} = await loadFixture(marketplaceFixture);
            const newListinFeePercentage = 20;

            await proxy.setListingFeesPercentage(20);
            expect(await proxy.listingFeePercentage()).to.equal(newListinFeePercentage);
        });
        
        it("should pay the listing fee percentage",  async () => {
            const {ledaNft, proxy,minterOne, minterTwo} = await loadFixture(marketplaceFixture);
            
            expect(await proxy.getItemsCount()).to.equal(0);

            const newListinFeePercentage = 20;
            await proxy.setListingFeesPercentage(20);

            await ledaNft.connect(minterOne).mint(URI, creatorFeePercentage);
            await ledaNft.connect(minterOne).setApprovalForAll(proxy.address, true);

            const listingFees = await proxy.getListingFees(price);
            
            await proxy.connect(minterOne).makeItem(ledaNft.address, 1, price, {value: listingFees});

            expect(await proxy.getItemsCount()).to.equal(1);
            expect(await proxy.getContractBalance()).to.equal(listingFees);

        })
        
        it("should not fail if price is set to zero", async function () {
            const {ledaNft, proxy, minterOne} = await loadFixture(mintNFTs);

            await proxy.connect(minterOne).makeItem(ledaNft.address, 1, 0);
            expect(await await proxy.getItemsCount()).to.equal(1);
            const item = await proxy.items(1);
            expect(item.price).to.equal(0);
        });

        it("should be able to list, delist and list again", async function () {
            const {ledaNft, proxy, minterOne} = await loadFixture(mintNFTs);

            await proxy.connect(minterOne).makeItem(ledaNft.address, 1, 100);
            expect(await proxy.getItemsCount()).to.equal(1);

            await proxy.connect(minterOne).changeItemStatus(1, Not_Listed);

            const itemBefore = await proxy.items(1);
            expect(itemBefore.status).to.equal(Not_Listed);
            expect(itemBefore.price).to.equal(100);

            await proxy.connect(minterOne).getListedAgain(1, 150);

            const itemAfter = await proxy.items(1);
            expect(itemAfter.status).to.equal(Listed);
            expect(itemAfter.price).to.equal(150);
        });
    });
    
    describe("Should purchase marketplace items", () => {
        it("should update item's owner when sold", async () => {
            const {ledaNft, proxy, minterOne, buyerOne} = await loadFixture(mintNFTs);
            expect(await proxy.getItemsCount()).to.equal(0);

            await proxy.getContractBalance();

            await proxy.connect(minterOne).makeItem(ledaNft.address, 1, price);
            
            const item = await proxy.items(1);
            
            // buyerOne purchases item.
            await expect(proxy.connect(buyerOne).buyItem(1, {value: price}))
            .to.emit(proxy, "LogBuyItem")
                .withArgs(
                1,
                ledaNft.address,
                1,
                price,
                minterOne.address,
                buyerOne.address
            );
            
            // Item should be marked as sold
            expect((await proxy.items(1)).status).to.equal(Sold);

            // The buyerOne should now own the ledaNft
            expect(await ledaNft.ownerOf(1)).to.equal(buyerOne.address);
        });

        it("the marketplace should receive the percentage fee", async () => {
            const {ledaNft, proxy, owner, minterOne, buyerOne} = await loadFixture(mintNFTs);
            
            await proxy.connect(minterOne).makeItem(ledaNft.address, 1, price);

            const item = await proxy.items(1);
            expect(item.status).to.equal(Listed);

            await proxy.connect(buyerOne).buyItem(1, {value: price});

            expect(await ledaNft.ownerOf(1)).to.equal(buyerOne.address);
 
            const contractBalance = await proxy.getContractBalance();
            const marketplaceFees = price * marketplaceFeePercent/toPercentage;

            expect(contractBalance).to.equal(marketplaceFees);
        });
        
        it("should give the royalties plus the selling price", async () => {
            const {ledaNft, proxy, owner, minterOne, buyerOne} = await loadFixture(mintNFTs);
            
            await proxy.connect(minterOne).makeItem(ledaNft.address, 1, price);
            
            const item = await proxy.items(1);
            expect(item.status).to.equal(Listed);

            const minterOneBalance =  await minterOne.getBalance();
            
            await proxy.connect(buyerOne).buyItem(1, {value: price});
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
            const {ledaNft, proxy, minterOne, buyerOne, buyerTwo} = await loadFixture(mintNFTs);
            
            await proxy.connect(minterOne).makeItem(ledaNft.address, 1, price);
            
            const item = await proxy.items(1);
            const minterOneBalance =  await minterOne.getBalance();
            
            await proxy.connect(buyerOne).buyItem(1, {value: price});
            
            const newMinterOneBalance =  await minterOne.getBalance();

            const _creatorAmount = (price * creatorFeePercentage)/toPercentage;
            const _platformFees = (price * marketplaceFeePercent)/toPercentage;
            const _sellerAmount = price - _platformFees - _creatorAmount;

            expect(newMinterOneBalance).to.equal(
                    minterOneBalance
                    .add(_sellerAmount)
                    .add(_creatorAmount)
            );

            await ledaNft.connect(buyerOne).setApprovalForAll(proxy.address, true);
            await proxy.connect(buyerOne).makeItem(ledaNft.address, 1, price);
            
            const buyerOneBalance =  await buyerOne.getBalance();

            await proxy.connect(buyerTwo).buyItem(2, {value: price});
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
            const {ledaNft, proxy, minterOne, minterTwo, buyerOne} = await loadFixture(marketplaceFixture);
            await ledaNft.connect(minterOne).mint(URI, creatorFeePercentage);
            await ledaNft.connect(minterTwo).mint(URI, creatorFeePercentage);
            await ledaNft.connect(minterOne).mint(URI, creatorFeePercentage);
            await ledaNft.connect(minterTwo).mint(URI, creatorFeePercentage);

            await ledaNft.connect(minterOne).setApprovalForAll(proxy.address, true);
            await ledaNft.connect(minterTwo).setApprovalForAll(proxy.address, true);

            await proxy.connect(minterOne).makeItem(ledaNft.address, 1, price);
            await proxy.connect(minterTwo).makeItem(ledaNft.address, 2, price);
            await proxy.connect(minterOne).makeItem(ledaNft.address, 3, price);
            await proxy.connect(minterTwo).makeItem(ledaNft.address, 4, price);

            await proxy.connect(buyerOne).buyItem(1, {value: price});
            await proxy.connect(buyerOne).buyItem(4, {value: price});

            expect(await proxy.getItemsSold()).to.equal(2);
            expect(await proxy.getItemsCount()).to.equal(4);
        });
        
        it("should be able to send collected fees to the owner", async () => {
            const {ledaNft, proxy, owner, minterOne, minterTwo, buyerOne, buyerTwo} = await loadFixture(marketplaceFixture);

            const newPrice = toWei(1);

            await ledaNft.connect(minterOne).mint(URI, creatorFeePercentage);
            await ledaNft.connect(minterTwo).mint(URI, creatorFeePercentage);
            
            await ledaNft.connect(minterOne).setApprovalForAll(proxy.address, true);
            await ledaNft.connect(minterTwo).setApprovalForAll(proxy.address, true);

            const priceOne = newPrice.mul(2);
            const priceTwo = newPrice.mul(3);

            await proxy.connect(minterOne).makeItem(ledaNft.address, 1, priceOne);
            await proxy.connect(minterTwo).makeItem(ledaNft.address, 2, priceTwo);
            
            await proxy.connect(buyerOne).buyItem(1, {value: priceOne});
            await proxy.connect(buyerTwo).buyItem(2, {value: priceTwo});

            const firstSaleFees = (await proxy.feePercentage()).mul(priceOne).div(1000);
            const secondSaleFees = (await proxy.feePercentage()).mul(priceTwo).div(1000);
            
            expect(await proxy.getContractBalance()).to.equal(firstSaleFees.add(secondSaleFees));
            const initBalance = await owner.getBalance();
            
            const tx = await proxy.withdraw();
            const receipt = await tx.wait();

            const gasPaid = receipt.gasUsed.mul(receipt.effectiveGasPrice);
            

            expect(await proxy.getContractBalance()).to.equal(0);
            const newBalance = await owner.getBalance();
            expect(await owner.getBalance()).to.equal(initBalance.sub(gasPaid).add(firstSaleFees).add(secondSaleFees));
        }); 
    });
    
    describe("Should fail if requirements are not fullfilled", () => { 
        it("should NOT be able to buy if the item is not listed", async () => {
            const {ledaNft, proxy, minterOne, buyerOne} = await loadFixture(marketplaceFixture);
            await ledaNft.connect(minterOne).mint(URI, creatorFeePercentage);

            await ledaNft.connect(minterOne).setApprovalForAll(proxy.address, true);
            await proxy.connect(minterOne).makeItem(ledaNft.address, 1, price);

            await proxy.connect(minterOne).changeItemStatus(1, Not_Listed);

            await expect(proxy.connect(buyerOne).buyItem(1, {value: price}))
            .to.be.revertedWith("item should be listed");
        });

        it("should not be able to set a new fee percentage if caller is not the owner", async () => {
            const {proxy, minterOne} = await loadFixture(marketplaceFixture);
            const newFeePercentage = 30;
            
            await expect(proxy.connect(minterOne).setFeePercentage(newFeePercentage))
            .to.be.revertedWith("Ownable: caller is not the owner");
        });

        it("should not be able to set a new listing fee percentage if caller is not the owner", async () => {
            const {proxy, minterOne} = await loadFixture(marketplaceFixture);
            const newFeePercentage = 30;
            
            await expect(proxy.connect(minterOne).setListingFeesPercentage(newFeePercentage))
            .to.be.revertedWith("Ownable: caller is not the owner");
        });

        it("should not be able to set a new item if the collection address is equal to zero", async () => {
            const {ledaNft, proxy, minterOne, buyerOne} = await loadFixture(marketplaceFixture);
            await ledaNft.connect(minterOne).mint(URI, creatorFeePercentage);

            await ledaNft.connect(minterOne).setApprovalForAll(proxy.address, true);
            
            await expect(proxy.connect(minterOne).makeItem(zeroAddress, 1, price))
            .to.be.revertedWith("Zero address is not allowed!");
        });


        it("should not be able to set a new item if nft does not exist!", async () => {
            const {ledaNft, proxy, minterOne, buyerOne} = await loadFixture(marketplaceFixture);
            await ledaNft.connect(minterOne).mint(URI, creatorFeePercentage);
            expect(await ledaNft.totalSupply()).to.equal(1);

            await ledaNft.connect(minterOne).setApprovalForAll(proxy.address, true);
            
            await expect(proxy.connect(minterOne).makeItem(ledaNft.address, 2, price))
            .to.be.revertedWith("ERC721: invalid token ID");
        });

        it("should not allow to list an nft if you are not the owner!", async () => {
            const {ledaNft, proxy, minterOne, minterTwo, buyerOne} = await loadFixture(marketplaceFixture);
            await ledaNft.connect(minterOne).mint(URI, creatorFeePercentage);
            expect(await ledaNft.totalSupply()).to.equal(1);

            await ledaNft.connect(minterOne).setApprovalForAll(proxy.address, true);
            
            await expect(proxy.connect(minterTwo).makeItem(ledaNft.address, 1, price))
            .to.be.revertedWith("Only owner can list its NFT!");
        });

        it("should not fail if the collection does not support royalties!", async () => {
            const {ledaNft, proxy, minterOne, minterTwo, buyerOne} = await loadFixture(marketplaceFixture);

            const LedaNFTTest = await ethers.getContractFactory("LedaNFTTest");
            const ledaNftTest = await LedaNFTTest.deploy("LEDA NFT Collection", "LEDATest");
            await ledaNftTest.deployed();

            await ledaNftTest.connect(minterOne).mint(URI, creatorFeePercentage);
            expect(await ledaNftTest.totalSupply()).to.equal(1);     

            await ledaNftTest.connect(minterOne).setApprovalForAll(proxy.address, true);

            await proxy.connect(minterOne).makeItem(ledaNftTest.address, 1, price);

            const item = await proxy.items(1);
            //const [_receiver, _royaltyAmount] = await ledaNftTest.royaltyInfo(item.itemId, price);
            
            expect(item.itemId).to.equal(1)
            expect(item.nftAddress).to.equal(ledaNftTest.address)
            expect(item.tokenId).to.equal(1)
            expect(item.price).to.equal(price)
            expect(item.seller).to.equal(minterOne.address);
            expect(item.creator).to.equal(minterOne.address);
            expect(item.creatorRoyalties).to.equal(0);
            expect(item.status).to.equal(Listed);
        });
    });
    
    
});