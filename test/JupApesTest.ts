import { expect } from "chai";
import { ethers} from "hardhat";
import { Contract, BigNumber, utils} from "ethers";
const { LazyMinter } = require('../lib')
const { loadFixture } = require("@nomicfoundation/hardhat-network-helpers");

const ipfs = "ipfs://bafybeigdyrzt5sfp7udm7hu76uh7y26nf3efuylqabf3oclgtqy55fbzdi";
const zeroAddress = "0x0000000000000000000000000000000000000000";
const toWei = (num:number) => ethers.utils.parseEther(num.toString())
const fromWei = (num:number) => ethers.utils.formatEther(num)

async function marketplaceFixture() {
        const [owner, minterOne, minterTwo, buyer, seller, buyerTwo] = await ethers.getSigners();
        
        const ApesNFT = await ethers.getContractFactory("JupApesNFT");
        const apesNft = await ApesNFT.deploy("Jupe Apes NFTs", "APES");

        await apesNft.deployed();
        
        return { apesNft, owner, minterOne, minterTwo, buyer, seller, buyerTwo}
}

async function deploy() {
    const [minter, buyer, _] = await ethers.getSigners()

    let JupApes = await ethers.getContractFactory("JupApesNFT", minter)
    const jupApes = await JupApes.deploy("Jup Apes Contract", "JUP")

    // the redeemerContract is an instance of the contract that's wired up to the redeemer's signing key
    const redeemerFactory = jupApes.connect(buyer)
    const redeemerContract = redeemerFactory.attach(jupApes.address)

    return { minter, buyer, jupApes, redeemerContract }
}

describe("JupApes Contract Testing", () => { 
    describe("Lazy JupApes NFT", function() {
        it("Should deploy", async function() {
            const signers = await ethers.getSigners();
            const minter = signers[0].address;

            const JupApes = await ethers.getContractFactory("JupApesNFT");
            const jupApes = await JupApes.deploy("Jup Apes Contract", "JUP");
            await jupApes.deployed();
        });

        it("Should redeem an NFT from a signed voucher", async () => {
            const { jupApes, redeemerContract, buyer, minter} = await loadFixture(deploy);

            const lazyMinter = new LazyMinter( jupApes, minter );
            const voucher = await lazyMinter.createVoucher(1,ipfs);
            
            await expect(redeemerContract.redeem(buyer.address, voucher))
            .to.emit(jupApes, 'Transfer')  // transfer from null address to minter
            .withArgs(zeroAddress, minter.address, voucher.tokenId)
            .and.to.emit(jupApes, 'Transfer') // transfer from minter to redeemer
            .withArgs(minter.address, buyer.address, voucher.tokenId);

            const nftOwner = await redeemerContract.ownerOf(1);
            expect(nftOwner).to.equal(buyer.address);
        });

        it("Should fail to redeem an NFT that's already been claimed", async function() {
            const { jupApes, redeemerContract, buyer, minter} = await loadFixture(deploy);

            const lazyMinter = new LazyMinter(jupApes, minter );
            const voucher = await lazyMinter.createVoucher(1, ipfs);

            await expect(redeemerContract.redeem(buyer.address, voucher))
                .to.emit(jupApes, 'Transfer')  // transfer from null address to minter
                .withArgs(zeroAddress, minter.address, voucher.tokenId)
                .and.to.emit(jupApes, 'Transfer') // transfer from minter to redeemer
                .withArgs(minter.address, buyer.address, voucher.tokenId);

            await expect(redeemerContract.redeem(buyer.address, voucher))
                .to.be.revertedWith('ERC721: token already minted');
        });

        it("Should fail to redeem an NFT voucher that's signed by an unauthorized account", async () => {
            const { jupApes, redeemerContract, buyer, minter} = await loadFixture(deploy);

            const signers = await ethers.getSigners();
            const rando = signers[signers.length-1];
    
            const lazyMinter = new LazyMinter(jupApes, rando);
            const voucher = await lazyMinter.createVoucher(1, ipfs);

            await expect(redeemerContract.redeem(buyer.address, voucher))
                .to.be.revertedWith('Signature invalid or unauthorized');
        });

        it("Should fail to redeem an NFT voucher that's been modified", async function() {
            const { jupApes, redeemerContract, buyer, minter} = await loadFixture(deploy);

            const signers = await ethers.getSigners();
            const rando = signers[signers.length-1];
            
            const lazyMinter = new LazyMinter( jupApes, rando );
            const voucher = await lazyMinter.createVoucher(1, ipfs);
            voucher.tokenId = 2;
            await expect(redeemerContract.redeem(buyer.address, voucher))
            .to.be.revertedWith('Signature invalid or unauthorized');
        });

        it("Should fail to redeem an NFT voucher with an invalid signature", async function() {
            const { jupApes, redeemerContract, buyer, minter} = await loadFixture(deploy);

            const signers = await ethers.getSigners();
            const rando = signers[signers.length-1];
            
            const lazyMinter = new LazyMinter( jupApes, rando );
            const voucher = await lazyMinter.createVoucher(1, ipfs);

            const dummyData = ethers.utils.randomBytes(128)
            voucher.signature = await minter.signMessage(dummyData);
            
            await expect(redeemerContract.redeem(buyer.address, voucher))
            .to.be.revertedWith('Signature invalid or unauthorized');
        });

        it("Should redeem if payment is >= minPrice", async function() {
            const { jupApes, redeemerContract, buyer, minter} = await loadFixture(deploy);

            const lazyMinter = new LazyMinter( jupApes, minter );
            const minPrice = ethers.constants.WeiPerEther; // charge 1 Eth
            const voucher = await lazyMinter.createVoucher(1, ipfs, minPrice);

            await expect(redeemerContract.redeem(buyer.address, voucher, { value: minPrice }))
            .to.emit(jupApes, 'Transfer')  // transfer from null address to minter
            .withArgs('0x0000000000000000000000000000000000000000', minter.address, voucher.tokenId)
            .and.to.emit(jupApes, 'Transfer') // transfer from minter to redeemer
            .withArgs(minter.address, buyer.address, voucher.tokenId);
        });

        it("Should fail to redeem if payment is < minPrice", async function() {
            const { jupApes, redeemerContract, buyer, minter} = await loadFixture(deploy);

            const lazyMinter = new LazyMinter( jupApes, minter );
            const minPrice = ethers.constants.WeiPerEther // charge 1 Eth
            const voucher = await lazyMinter.createVoucher(
                1, 
                ipfs, 
                minPrice
            );

            const payment = minPrice.sub(10000)
            await expect(redeemerContract.redeem(buyer.address, voucher, { value: payment }))
            .to.be.revertedWith('Insufficient funds to redeem')
        });
    });
});