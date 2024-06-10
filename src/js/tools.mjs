import { ethers, JsonRpcProvider } from 'ethers';
import CharityArtifact from "../contracts/Charity_Platform.json" with { type: "json" };
import contractAddress from "../contracts/contract-address.json" with { type: "json" };

const provider = new JsonRpcProvider("http://localhost:8545");

// Function to construct smart contract
export async function constructSmartContract() {
    return (new ethers.Contract(ethers.getAddress(contractAddress.Charity_Platform), CharityArtifact.abi, await provider.getSigner(0)));
}