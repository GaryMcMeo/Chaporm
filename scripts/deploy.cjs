const path = require("path");

async function main() {
    // This is just a convenience check
    if (network.name === "hardhat") {
      console.warn(
        "You are trying to deploy a contract to the Hardhat Network, which" +
          "gets automatically created and destroyed every time. Use the Hardhat" +
          " option '--network localhost'"
      );
    }
  
    // ethers is available in the global scope
    const [deployer] = await ethers.getSigners();
    console.log(
      "Deploying the contracts with the account:",
      await deployer.getAddress()
    );
  
    const Charity_Platform = await ethers.getContractFactory("charity_Platform");
    const charity_Platform = await Charity_Platform.deploy();

    //console.log(JSON.stringify(charity_Platform));
    //console.log(charity_Platform.target);
  
    console.log("Charity_Platform smart contract address:", charity_Platform.target);
  
    // We also save the contract's artifacts and address in the frontend directory
    saveFrontendFiles(charity_Platform);
  }

  function saveFrontendFiles(charity_Platform) {
    const fs = require("fs");
    const contractsDir = path.join(__dirname, "..", "src", "contracts");
  
    if (!fs.existsSync(contractsDir)) {
      fs.mkdirSync(contractsDir);
    }
  
    fs.writeFileSync(
      path.join(contractsDir, "contract-address.json"),
      JSON.stringify({ Charity_Platform: charity_Platform.target }, undefined, 2)
    );
  
    const Charity_PlatformArtifact = artifacts.readArtifactSync("charity_Platform");
  
    fs.writeFileSync(
      path.join(contractsDir, "Charity_Platform.json"),
      JSON.stringify(Charity_PlatformArtifact, null, 2)
    );
  }
  
  main()
    .then(() => process.exit(0))
    .catch((error) => {
      console.error(error);
      process.exit(1);
    });