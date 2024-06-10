const { expect } = require("chai");
const { ethers } = require("hardhat");

describe("charity_Platform", function () {
  it("should register a new user", async function () {
    const [owner, addr1, addr2] = await ethers.getSigners();
    const Charity_Platform = await ethers.getContractFactory("charity_Platform");
    const charity_Platform = await Charity_Platform.deploy();

    await charity_Platform.registerUser(addr1.address);
    const user = await charity_Platform.users(addr1.address);
    expect(user.registered).to.equal(true);
    expect(user.credits).to.equal(1000);
    expect(await charity_Platform.userCounter()).to.equal(1);
  });

  it("should get user credits", async function () {
    const [owner, addr1, addr2] = await ethers.getSigners();
    const Charity_Platform = await ethers.getContractFactory("charity_Platform");
    const charity_Platform = await Charity_Platform.deploy();

    await charity_Platform.registerUser(addr1.address);
    const credits = await charity_Platform.getUserCredits(addr1.address);
    expect(credits).to.equal(1000);
  });

  it("should add credits to a user", async function () {
    const [owner, addr1, addr2] = await ethers.getSigners();
    const Charity_Platform = await ethers.getContractFactory("charity_Platform");
    const charity_Platform = await Charity_Platform.deploy();

    await charity_Platform.registerUser(addr1.address);
    await charity_Platform.addCredits(addr1.address, 500);
    const user = await charity_Platform.users(addr1.address);
    expect(user.credits).to.equal(1500);
  });

  it("should create a new campaign", async function () {
    const [owner, addr1, addr2] = await ethers.getSigners();
    const Charity_Platform = await ethers.getContractFactory("charity_Platform");
    const charity_Platform = await Charity_Platform.deploy();
  
    await charity_Platform.registerUser(owner.address);
    await charity_Platform.addCredits(owner.address, 1000);
    await charity_Platform.createCampaign("Test Campaign", "Test Description", 100);
    const campaign = await charity_Platform.getCampaignDetails(1);
    expect(campaign.campaignId).to.equal(1);
    expect(campaign.creator).to.equal(owner.address);
    expect(campaign.title).to.equal("Test Campaign");
    expect(campaign.description).to.equal("Test Description");
    expect(campaign.goal).to.equal(100);
    expect(campaign.raisedAmount).to.equal(0);
    expect(campaign.completed).to.equal(false);
  });
  
  it("should get campaign details", async function () {
    const [owner, addr1, addr2] = await ethers.getSigners();
    const Charity_Platform = await ethers.getContractFactory("charity_Platform");
    const charity_Platform = await Charity_Platform.deploy();
  
    await charity_Platform.registerUser(owner.address);
    await charity_Platform.addCredits(owner.address, 1000);
    await charity_Platform.createCampaign("Test Campaign", "Test Description", 100);
    const campaign = await charity_Platform.getCampaignDetails(1);
    expect(campaign.campaignId).to.equal(1);
    expect(campaign.creator).to.equal(owner.address);
    expect(campaign.title).to.equal("Test Campaign");
    expect(campaign.description).to.equal("Test Description");
    expect(campaign.goal).to.equal(100);
    expect(campaign.raisedAmount).to.equal(0);
    expect(campaign.completed).to.equal(false);
  });

  it("should donate to a campaign", async function () {
    const [owner, addr1, addr2] = await ethers.getSigners();
    const Charity_Platform = await ethers.getContractFactory("charity_Platform");
    const charity_Platform = await Charity_Platform.deploy();
    await charity_Platform.registerUser(addr1.address);
    await charity_Platform.addCredits(addr1.address, 1000);
    await charity_Platform.createCampaign("Test Campaign", "Test Description", 100);
    await charity_Platform.connect(addr1).donate(1, 50);
    const campaign = await charity_Platform.getCampaignDetails(1);
    expect(campaign.raisedAmount).to.equal(50);
    expect(campaign.completed).to.equal(false);
});

it("should complete a campaign if goal is reached", async function () {
    const [owner, addr1, addr2] = await ethers.getSigners();
    const Charity_Platform = await ethers.getContractFactory("charity_Platform");
    const charity_Platform = await Charity_Platform.deploy();
    await charity_Platform.registerUser(addr1.address);
    await charity_Platform.addCredits(addr1.address, 1000);
    await charity_Platform.createCampaign("Test Campaign", "Test Description", 100);
    await charity_Platform.connect(addr1).donate(1, 100);
    const campaign = await charity_Platform.getCampaignDetails(1);
    expect(campaign.raisedAmount).to.equal(100);
    expect(campaign.completed).to.equal(true);
});

it("should withdraw funds from a completed campaign", async function () {
    const [owner, addr1, addr2] = await ethers.getSigners();
    const Charity_Platform = await ethers.getContractFactory("charity_Platform");
    const charity_Platform = await Charity_Platform.deploy();
    await charity_Platform.registerUser(addr1.address);
    await charity_Platform.addCredits(addr1.address, 1000);
    await charity_Platform.createCampaign("Test Campaign", "Test Description", 100);
    await charity_Platform.connect(addr1).donate(1, 100);
    await charity_Platform.withdrawFunds(1, addr1.address);
    const user = await charity_Platform.users(addr1.address);
    expect(user.credits).to.equal(2000);
});  
});