import { expect } from "chai";
import { ethers} from "hardhat";
import { Contract, BigNumber, utils} from "ethers";
const { LazyLedaMinter } = require('../lib')
const { loadFixture } = require("@nomicfoundation/hardhat-network-helpers");

const toWei = (num:number) => ethers.utils.parseEther(num.toString())
const fromWei = (num:number) => ethers.utils.formatEther(num)
const ipfs = "ipfs://bafybeigdyrzt5sfp7udm7hu76uh7y26nf3efuylqabf3oclgtqy55fbzdi";
const zeroAddress = "0x0000000000000000000000000000000000000000";
const feeDenominator = 1000;

async function deploy() {
    const [minter, buyer, seller, _] = await ethers.getSigners();

    let LedaNft = await ethers.getContractFactory("LedaNFT", minter);
    const ledaNft = await LedaNft.deploy("Leda NFTs", "LEDA");

    // the redeemerContract is an instance of the contract that's wired up to the redeemer's signing key
    const redeemerFactory = ledaNft.connect(buyer);
    const redeemerContract = redeemerFactory.attach(ledaNft.address);

    return { minter, buyer, seller, ledaNft, redeemerContract }
}

describe("LedaNFT Contract Testing", () => { 
    describe("LazyNFT", function() {
        it("Should deploy", async function() {
            const signers = await ethers.getSigners();
            const minter = signers[0].address;

            const LedaNft = await ethers.getContractFactory("LedaNFT");
            const ledaNft = await LedaNft.deploy("Leda NFTs", "LEDA");
            await ledaNft.deployed();
        });

         it("Should redeem an NFT in Pinata from a signed voucher", async () => {
            const { ledaNft, redeemerContract, buyer, minter} = await loadFixture(deploy);

            const lazyMinter = new LazyLedaMinter( ledaNft, minter );
            const minPrice = 100000000000000;
            const royalties = 50;
            const voucher = 
                await lazyMinter.createVoucher(
                    "https://chocolate-impressed-bandicoot-860.mypinata.cloud/ipfs/Qmc1XcZiodoRb9UVyi3ChagkyN5GN9xRcYhUrdLaKx6oi1",
                    minPrice,
                    "0xf39fd6e51aad88f6f4ce6ab8827279cfffb92266",
                    royalties
                );
            
            await expect(redeemerContract.redeem(buyer.address, voucher, { value: minPrice }))
                .to.emit(ledaNft, 'Transfer')  // transfer from null address to minter
                .withArgs(zeroAddress, minter.address, 1)
                .and.to.emit(ledaNft, 'Transfer') // transfer from minter to redeemer
                .withArgs(minter.address, buyer.address, 1);

            const nftOwner = await redeemerContract.ownerOf(1);
            expect(nftOwner).to.equal(buyer.address);
        });

        it("Should redeem an NFT from a signed voucher", async () => {
            const { ledaNft, redeemerContract, buyer, minter} = await loadFixture(deploy);

            const lazyMinter = new LazyLedaMinter( ledaNft, minter );
            const minPrice = 0;
            const royalties = 50;
            const voucher = 
                await lazyMinter.createVoucher(
                    ipfs,
                    minPrice,
                    minter.address,
                    royalties
                );
  
            await expect(redeemerContract.redeem(buyer.address, voucher))
                .to.emit(ledaNft, 'Transfer')  // transfer from null address to minter
                .withArgs(zeroAddress, minter.address, 1)
                .and.to.emit(ledaNft, 'Transfer') // transfer from minter to redeemer
                .withArgs(minter.address, buyer.address, 1);

            const nftOwner = await redeemerContract.ownerOf(1);
            expect(nftOwner).to.equal(buyer.address);
        });

        it("Should fail to redeem a voucher that's already been claimed", async function() {
            const { ledaNft, redeemerContract, buyer, minter} = await loadFixture(deploy);

            const lazyMinter = new LazyLedaMinter( ledaNft, minter );
            const minPrice = 0;
            const royalties = 50;
            const voucher = 
                await lazyMinter.createVoucher(
                    ipfs,
                    minPrice,
                    minter.address,
                    royalties
                );

            await expect(redeemerContract.redeem(buyer.address, voucher))
                .to.emit(ledaNft, 'Transfer')  // transfer from null address to minter
                .withArgs(zeroAddress, minter.address, 1)
                .and.to.emit(ledaNft, 'Transfer') // transfer from minter to redeemer
                .withArgs(minter.address, buyer.address, 1);

            await expect(redeemerContract.redeem(buyer.address, voucher))
                .to.be.revertedWith('The voucher has been redeemed!');
        });

        it("Should fail to redeem a voucher if minter address is equal to zero", async () => {
            const { ledaNft, redeemerContract, buyer, minter} = await loadFixture(deploy);

            const lazyMinter = new LazyLedaMinter(ledaNft, minter);
            const minPrice = 0;
            const royalties = 50;
            const voucher = 
                await lazyMinter.createVoucher(
                    ipfs,
                    minPrice,
                    zeroAddress,
                    royalties
                );

            await expect(redeemerContract.redeem(buyer.address, voucher))
                .to.be.revertedWith('Creator is the zero address!');
        });

        //TODO: verify this
        it("Should fail if royalties are greater than the max creator fee percentage", async () => {
            const { ledaNft, redeemerContract, buyer, minter} = await loadFixture(deploy);

            const lazyMinter = new LazyLedaMinter(ledaNft, minter);
            const minPrice = 0;
            const royalties = 101;
            const voucher = 
                await lazyMinter.createVoucher(
                    ipfs,
                    minPrice,
                    minter.address,
                    royalties
                );

            await expect(redeemerContract.redeem(buyer.address, voucher))
                .to.be.revertedWith('Royalties exceed the max creator royalties percentage');

            await ledaNft.setMaxCreatorRoyalties(royalties);

            await redeemerContract.redeem(buyer.address, voucher);
            const nftOwner = await redeemerContract.ownerOf(1);
            expect(nftOwner).to.equal(buyer.address);
        });

        it("Should fail to redeem a voucher if buyer address is equal to zero", async () => {
            const { ledaNft, redeemerContract, buyer, minter} = await loadFixture(deploy);

            const lazyMinter = new LazyLedaMinter(ledaNft, minter);
            const minPrice = 0;
            const royalties = 50;
            const voucher = 
                await lazyMinter.createVoucher(
                    ipfs,
                    minPrice,
                    minter.address,
                    royalties
                );

            await expect(redeemerContract.redeem(zeroAddress, voucher))
                .to.be.revertedWith('Redeemer is the zero address!');
        });

        it("Should fail to redeem a voucher signed by an unauthorized account", async () => {
            const { ledaNft, redeemerContract, buyer, minter} = await loadFixture(deploy);

            const signers = await ethers.getSigners();
            const rando = signers[signers.length-1];
    
            const lazyMinter = new LazyLedaMinter(ledaNft, rando);
            const minPrice = 0;
            const royalties = 50;
            const voucher = 
                await lazyMinter.createVoucher(
                    ipfs,
                    minPrice,
                    minter.address,
                    royalties
                );

            await expect(redeemerContract.redeem(buyer.address, voucher))
                .to.be.revertedWith('Signature invalid or unauthorized');
        });
        
        it("Should fail to redeem a voucher that's been modified", async function() {
            const { ledaNft, redeemerContract, buyer, minter} = await loadFixture(deploy);

            const signers = await ethers.getSigners();
            const rando = signers[signers.length-1];
            
            const lazyMinter = new LazyLedaMinter( ledaNft, rando );
            const minPrice = 0;
            const royalties = 50;
            const voucher = 
                await lazyMinter.createVoucher(
                    ipfs,
                    minPrice,
                    rando.address,
                    royalties
                );
            voucher.royalties = 40;
            await expect(redeemerContract.redeem(buyer.address, voucher))
            .to.be.revertedWith('Signature invalid or unauthorized');
        });
        
        it("Should fail to redeem a voucher with an invalid signature", async function() {
            const { ledaNft, redeemerContract, buyer, minter, seller} = await loadFixture(deploy);

            const lazyMinter = new LazyLedaMinter( ledaNft, seller );
            const minPrice = 0;
            const royalties = 50;
            const voucher = 
                await lazyMinter.createVoucher(
                    ipfs,
                    minPrice,
                    seller.address,
                    royalties
                );

            const dummyData = ethers.utils.randomBytes(128)
            voucher.signature = await minter.signMessage(dummyData);
            
            await expect(redeemerContract.redeem(buyer.address, voucher))
            .to.be.revertedWith('Signature invalid or unauthorized');
        });
        
        it("Should redeem if payment is >= minPrice", async function() {
            const { ledaNft, redeemerContract, buyer, minter, seller} = await loadFixture(deploy);

            const lazyMinter = new LazyLedaMinter( ledaNft, seller );
            const minPrice = ethers.constants.WeiPerEther; // charge 1 Eth
            const royalties = 50;
            const voucher = 
                await lazyMinter.createVoucher(
                    ipfs,
                    minPrice,
                    seller.address,
                    royalties
                );

            await expect(redeemerContract.redeem(buyer.address, voucher, { value: minPrice }))
                .to.emit(ledaNft, 'Transfer')  // transfer from null address to minter
                .withArgs(zeroAddress, seller.address, 1)
                .and.to.emit(ledaNft, 'Transfer') // transfer from minter to redeemer
                .withArgs(seller.address, buyer.address, 1);
        });
        
        it("Should fail to redeem if payment is < minPrice", async function() {
            const { ledaNft, redeemerContract, buyer, minter, seller} = await loadFixture(deploy);

            const lazyMinter = new LazyLedaMinter( ledaNft, seller );
            const minPrice = ethers.constants.WeiPerEther // charge 1 Eth
            const royalties = 50;
            const voucher = 
                await lazyMinter.createVoucher(
                    ipfs,
                    minPrice,
                    seller.address,
                    royalties
                );

            const payment = minPrice.sub(1)
            await expect(redeemerContract.redeem(buyer.address, voucher, { value: payment }))
            .to.be.revertedWith('Insufficient funds to redeem')
        });
        
        // TODO: This test is wrong!
        it("Should be possible to increase the lazy minting royalty fees percentage", async () => {
            const { ledaNft, redeemerContract, buyer, minter} = await loadFixture(deploy);

            const lazyMinter = new LazyLedaMinter(ledaNft, minter);
            const minPrice = ethers.constants.WeiPerEther // charge 1 Eth
            const royalties = 50;
            const voucher = 
                await lazyMinter.createVoucher(
                    ipfs,
                    minPrice,
                    minter.address,
                    royalties
                );

            // New percentage is equal to 10%
            const newLazyMintingFeePercentage = 100;
            await expect(ledaNft.setLazyMintingFee(newLazyMintingFeePercentage))
            .to.emit(ledaNft, "LogSetLazyMintingFee")
            .withArgs(
                newLazyMintingFeePercentage
            );

            const lazyMintingFee = await ledaNft.lazyMintingFee();
            const profits = minPrice.sub(minPrice.mul(lazyMintingFee).div(feeDenominator));
            const contractBalance = minPrice.sub(profits);

            await expect(await redeemerContract.redeem(buyer.address, voucher, { value: minPrice }))
            .to.changeEtherBalances([ledaNft, buyer, minter], [contractBalance, minPrice.mul(-1), profits]);

            await expect(await ledaNft.withdraw())
            .to.changeEtherBalance(minter, contractBalance);

            const nftOwner = await redeemerContract.ownerOf(1);
            expect(nftOwner).to.equal(buyer.address);
        });

        it("Should make payments available to minter for withdrawal", async function() {
            const { ledaNft, redeemerContract, buyer, minter, seller} = await loadFixture(deploy);

            const lazyMinter = new LazyLedaMinter( ledaNft, seller );
            const minPrice = ethers.constants.WeiPerEther // charge 1 Eth
            const royalties = 50;
            const voucher = 
                await lazyMinter.createVoucher(
                    ipfs,
                    minPrice,
                    seller.address,
                    royalties
                );

            // the payment should be sent from the redeemer's account to the contract address
            const lazyMintingFee = await ledaNft.lazyMintingFee();

            // contrac's owner should have funds available to withdraw
            const profits = minPrice.sub(minPrice.mul(lazyMintingFee).div(feeDenominator));
            const contractBalance = minPrice.sub(profits);

            await expect(await redeemerContract.redeem(buyer.address, voucher, { value: minPrice }))
            .to.changeEtherBalances([ledaNft, buyer, seller], [contractBalance, minPrice.mul(-1), profits]);
                        
            expect(await ledaNft.getContractBalance()).to.equal(contractBalance);

            // withdrawal should increase minter's balance
            await expect(await ledaNft.withdraw())
            .to.changeEtherBalance(minter, contractBalance);

            // minter should now have zero available
            expect(await ledaNft.getContractBalance()).to.equal(0);
        });

        it("Should withdraw funds from several redeems", async () => {
            const { ledaNft, redeemerContract, buyer, minter} = await loadFixture(deploy);

            const signers = await ethers.getSigners();
            const creatorOne = signers[signers.length-1];
            const creatorTwo = signers[signers.length-2];
            const creatorThree = signers[signers.length-3];

            const royalties = 50;
            const minPrice = ethers.constants.WeiPerEther;
            const lazyMinterOne = new LazyLedaMinter( ledaNft, creatorOne );
            const voucherOne = 
                await lazyMinterOne.createVoucher(
                    ipfs,
                    minPrice,
                    creatorOne.address,
                    royalties
                );

            const lazyMinterTwo = new LazyLedaMinter( ledaNft, creatorTwo );
            const voucherTwo = 
                await lazyMinterTwo.createVoucher(
                    ipfs,
                    minPrice.mul(2),
                    creatorTwo.address,
                    royalties
                );

            const lazyMinterThree = new LazyLedaMinter( ledaNft, creatorThree );
            const voucherThree = 
                await lazyMinterThree.createVoucher(
                    ipfs,
                    minPrice.mul(3),
                    creatorThree.address,
                    royalties
                );

            const priceOne = minPrice;
            const priceTwo = minPrice.mul(2);
            const priceThree = minPrice.mul(3);

            await redeemerContract.redeem(buyer.address, voucherOne, { value: priceOne });
            await redeemerContract.redeem(buyer.address, voucherTwo, { value: priceTwo });
            await redeemerContract.redeem(buyer.address, voucherThree, { value: priceThree });

            const nftOwnerOne = await redeemerContract.ownerOf(1);
            const nftOwnerTwo = await redeemerContract.ownerOf(2);
            const nftOwnerThree = await redeemerContract.ownerOf(3);

            expect(nftOwnerOne).to.equal(buyer.address);
            expect(nftOwnerTwo).to.equal(buyer.address);
            expect(nftOwnerThree).to.equal(buyer.address);

            const lazyMintingFee = await ledaNft.lazyMintingFee();
            const profitsOne = priceOne.sub(priceOne.mul(lazyMintingFee).div(feeDenominator));
            const profitsTwo = priceTwo.sub(priceTwo.mul(lazyMintingFee).div(feeDenominator));
            const profitsThree = priceThree.sub(priceThree.mul(lazyMintingFee).div(feeDenominator));

            const totalProfits = profitsOne.add(profitsTwo).add(profitsThree);

            const contractBalance = minPrice.mul(6).sub(totalProfits);
            expect(await ledaNft.getContractBalance()).to.equal(contractBalance);

            // withdrawal should increase minter's balance
            await expect(await ledaNft.withdraw())
            .to.changeEtherBalance(minter, contractBalance);

            // minter should now have zero available
            expect(await ledaNft.getContractBalance()).to.equal(0);
            expect(await ledaNft.totalSupply()).to.equal(3);

        });
    });
});