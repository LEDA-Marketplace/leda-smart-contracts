import { expect } from "chai";
import { ethers} from "hardhat";
import { Contract, BigNumber, utils} from "ethers";
const { LazyMinter } = require('../lib')
const { loadFixture } = require("@nomicfoundation/hardhat-network-helpers");

const ipfs = "ipfs://bafybeigdyrzt5sfp7udm7hu76uh7y26nf3efuylqabf3oclgtqy55fbzdi";
const zeroAddress = "0x0000000000000000000000000000000000000000";
const _creatorFeePercent = 25;
const _stakingRewardsPercentage = 100;
const price = 1000;
const feeDenominator = 1000;

const toWei = (num:number) => ethers.utils.parseEther(num.toString())
const fromWei = (num:number) => ethers.utils.formatEther(num)

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
    describe("Jup Apes Test", () => {
        it("should be able to mint a JupApe NFT", async () => {
            const { jupApes, redeemerContract, buyer, minter} = await loadFixture(deploy);
            const _to = minter.address;
            const _tokenId = 1;
            const tx1 = await jupApes.mint(
                        _to,
                        ipfs,
                        _creatorFeePercent,
                        _stakingRewardsPercentage,
                        _tokenId
                        );
            
            const receipt = await tx1.wait();
            
            expect(receipt.events[0].args._nftId).to.equal(_tokenId);
            expect(receipt.events[0].args._owner).to.equal(_to);
            expect(receipt.events[0].args._nftURI).to.equal(ipfs);
            expect(receipt.events[0].args._royaltiesPercentage).to.equal(_creatorFeePercent);
            expect(receipt.events[0].args._stakingRewardsPercentage).to.equal(_stakingRewardsPercentage);
            
            
            expect(await jupApes.balanceOf(minter.address)).to.equal(1);
            expect(await jupApes.ownerOf(1)).to.equal(minter.address);
            expect(await jupApes.tokenURI(1)).to.equal(ipfs);
        });

        it("should be able to mint more than one JupApe NFT", async () => {
            const { jupApes, redeemerContract, buyer, minter} = await loadFixture(deploy);
            const _to = minter.address;
            const _tokenId = 1;
            await jupApes.mint(
                        _to,
                        ipfs,
                        _creatorFeePercent,
                        _stakingRewardsPercentage,
                        _tokenId
                        );
            const ipfs2 = "ipfs2";
            const _tokenId2 = 2;
            await jupApes.mint(
                        _to,
                        ipfs2,
                        _creatorFeePercent,
                        _stakingRewardsPercentage,
                        _tokenId2
                        );
            
            expect(await jupApes.balanceOf(minter.address)).to.equal(2);
            expect(await jupApes.ownerOf(_tokenId)).to.equal(minter.address);
            expect(await jupApes.tokenURI(_tokenId)).to.equal(ipfs);
            expect(await jupApes.ownerOf(_tokenId2)).to.equal(minter.address);
            expect(await jupApes.tokenURI(_tokenId2)).to.equal(ipfs2);
        });

        it("should not mint if the contract is paused", async () => {
            const { jupApes, redeemerContract, buyer, minter} = await loadFixture(deploy);
            const _to = minter.address;
            const _tokenId = 1;

            await jupApes.pause();
            await expect(jupApes.mint(
                        _to,
                        ipfs,
                        _creatorFeePercent,
                        _stakingRewardsPercentage,
                        _tokenId
                        )).to.be.revertedWith("Pausable: paused");
        });

        it("should verify that the royalties system is in place", async () => {
            const { jupApes, redeemerContract, buyer, minter} = await loadFixture(deploy);
            const _INTERFACE_ID_ERC2981 = "0x2a55205a";
            const success = await jupApes.supportsInterface(_INTERFACE_ID_ERC2981);
            expect(success).to.equal(true);
        });

        it("should validate nft creator and royalties", async () => {
            const { jupApes, redeemerContract, buyer, minter} = await loadFixture(deploy);

            const _to = minter.address;
            const _tokenId = 1;

            await jupApes.mint(
                        _to,
                        ipfs,
                        _creatorFeePercent,
                        _stakingRewardsPercentage,
                        _tokenId
                        );
            
            const [_creator, _royalties] = await jupApes.royaltyInfo(1, price);
            expect(_creator).to.equal(minter.address);
            
            const royalties = (price * _creatorFeePercent) / feeDenominator;
            expect(_royalties).to.equal(royalties);
        });

        it("should transfer an nft using transferFrom directly", async () => {
            const { jupApes, redeemerContract, buyer, minter} = await loadFixture(deploy);

            const _to = minter.address;
            const _tokenId = 1;

            await jupApes.mint(
                        _to,
                        ipfs,
                        _creatorFeePercent,
                        _stakingRewardsPercentage,
                        _tokenId
                        );

            await jupApes.transferFrom(minter.address, buyer.address, 1);
            
            expect(await jupApes.ownerOf(1)).to.equal(buyer.address); 
        });

        it("should approve someone else to transfer an NFT", async () => {
            const { jupApes, redeemerContract, buyer, minter} = await loadFixture(deploy);
            const _to = minter.address;
            const _tokenId = 1;

            await jupApes.mint(
                        _to,
                        ipfs,
                        _creatorFeePercent,
                        _stakingRewardsPercentage,
                        _tokenId
                        );

            await jupApes.setApprovalForAll(buyer.address, true);
            await jupApes.connect(buyer).transferFrom(minter.address, buyer.address, 1);

            expect(await jupApes.ownerOf(1)).to.equal(buyer.address);
        });

        it("should approve someone else using safeTransferFrom an NFT", async () => {
            const { jupApes, redeemerContract, buyer, minter} = await loadFixture(deploy);
            const _to = minter.address;
            const _tokenId = 1;

            await jupApes.mint(
                        _to,
                        ipfs,
                        _creatorFeePercent,
                        _stakingRewardsPercentage,
                        _tokenId
                        );

            await jupApes.setApprovalForAll(buyer.address, true);
            await jupApes.connect(buyer)["safeTransferFrom(address,address,uint256)"](minter.address, buyer.address, 1);
            
            expect(await jupApes.ownerOf(1)).to.equal(buyer.address);
        });

        it("should be able to burn an NFT", async () => {
            const { jupApes, redeemerContract, buyer, minter} = await loadFixture(deploy);
            const _to = minter.address;
            const _tokenId = 1;

            await jupApes.mint(
                        _to,
                        ipfs,
                        _creatorFeePercent,
                        _stakingRewardsPercentage,
                        _tokenId
                        );
            
            expect(await jupApes.ownerOf(1)).to.equal(minter.address);

            expect(await jupApes.tokenCount()).to.equal(1);

            await jupApes.burn(1);
            await expect(jupApes.ownerOf(1))
                .to.be.revertedWith("ERC721: invalid token ID");            
        });
    });
    describe("Lazy JupApes NFT", () => {
        it("Should deploy", async () => {
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
            /*
            const nftOwner = await redeemerContract.ownerOf(1);
            expect(nftOwner).to.equal(buyer.address); */
        });
        /*
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
        });*/
    });
});