import { expect } from "chai";
import { ethers} from "hardhat";
const { LazyMinter } = require('../lib')
const { loadFixture } = require("@nomicfoundation/hardhat-network-helpers");

require("dotenv").config();
require("dotenv").config();

const { VOUCHER_PRIVATE_KEY } = process.env;

const ipfs = "ipfs://bafybeigdyrzt5sfp7udm7hu76uh7y26nf3efuylqabf3oclgtqy55fbzdi";
const zeroAddress = "0x0000000000000000000000000000000000000000";
const _creatorFeePercent = 25;
const _stakingRewardsPercentage = 100;
const minPrice = ethers.constants.WeiPerEther; // charge 1 Eth
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

describe("Offchain Voucher creation", () => {
    describe("Lazy JupApes NFT", () => {
        it("Should redeem an NFT from a signed voucher", async () => {
            const { jupApes, redeemerContract, buyer, minter} = await loadFixture(deploy);
            const _tokenId = 1;
            const lazyMinter = new LazyMinter( jupApes, minter );
            
            const voucher = await lazyMinter.createVoucher(
                _tokenId,
                ipfs,
                0,
                _creatorFeePercent,
                _stakingRewardsPercentage
            );
            
            const privateKey:any = VOUCHER_PRIVATE_KEY;
            let wallet = new ethers.Wallet(privateKey);

            const newMinter = new LazyMinter( jupApes, wallet );
            const newVoucher = await newMinter.createVoucher(
                _tokenId,
                ipfs,
                0,
                _creatorFeePercent,
                _stakingRewardsPercentage
            );
            
        });

        it("Should redeem a voucher signed offline", async function() {
            const signers = await ethers.getSigners();
            const rando = signers[signers.length-1];
            const minter = signers[0];

            const privateKey:any = VOUCHER_PRIVATE_KEY
            let wallet = new ethers.Wallet(privateKey);
            
            const JupApes = await ethers.getContractFactory("JupApesNFT", minter);
            const jupApes = await JupApes.deploy("Jup Apes Contract", "JUP")
    
            const owner = await jupApes.owner();

            const _tokenId = 1;

            const newMinter = new LazyMinter( jupApes, wallet );
            const newVoucher = await newMinter.createVoucher(
                _tokenId,
                ipfs,
                minPrice,
                _creatorFeePercent,
                _stakingRewardsPercentage
            );

            await expect(jupApes.redeem(rando.address, newVoucher, { value: minPrice }))
            .to.emit(jupApes, 'Transfer')  // transfer from null address to minter
            .withArgs(zeroAddress, wallet.address, newVoucher.tokenId)
            .and.to.emit(jupApes, 'Transfer') // transfer from minter to redeemer
            .withArgs(wallet.address, rando.address, newVoucher.tokenId);
        });

        it("Should redeem several vouchers", async function() {
            const { jupApes, redeemerContract, buyer, minter} = await loadFixture(deploy);
            const signers = await ethers.getSigners();
            const totalVouchers = 19
            let vouchers:any[] = [];

            const owner = await jupApes.owner();
            
            const privateKey:any = VOUCHER_PRIVATE_KEY;
            let wallet = new ethers.Wallet(privateKey);
            const newMinter = new LazyMinter( jupApes, wallet );

            let newVoucher;
            for (let i = 0; i < totalVouchers; i++){    
                 newVoucher = await newMinter.createVoucher(
                    i + 1,
                    ipfs,
                    minPrice.mul(i),
                    _creatorFeePercent,
                    _stakingRewardsPercentage * i
                );
                vouchers[i] = newVoucher;
            }
            
            for (let i = 0; i < totalVouchers; i++){    
                await expect(jupApes.redeem(signers[i+1].address, vouchers[i], { value: minPrice.mul(i) }))
                .to.emit(jupApes, 'Transfer')  
                .withArgs(zeroAddress, wallet.address, i + 1)
                .and.to.emit(jupApes, 'Transfer') 
                .withArgs(wallet.address, signers[i+1].address, i + 1);
            }
        });
    });
});