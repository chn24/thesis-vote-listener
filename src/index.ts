import Web3 from "web3";
import { AbiCoder, ethers, toBeHex } from "ethers";
import HDWalletProvider from "@truffle/hdwallet-provider";
import dotenv from "dotenv";
// @ts-ignore
import VotingManagerAbi from "../config_/VotingManagerABI.json";
// @ts-ignore
import VotingABI from "../config_/VotingABI.json";
import fs from "fs";
import { Collection, Db } from "mongodb";
import {
  Proposal,
  Voting,
  getMongoDb,
  insertProposals,
  insertVoting,
} from "./db";
import { EventData } from "web3-eth-contract/types";

dotenv.config();

const provider = new HDWalletProvider(
  [process.env.PRIVATE_KEY ?? ""],
  process.env.RPC_URL ?? ""
);
// @ts-ignore
const web3 = new Web3(provider);
const abi = new AbiCoder();

const VOTING_MANAGER_CONTRACT_ADDRESS =
  process.env.VOTING_MANAGER_CONTRACT_ADDRESS ?? "";

const votingManager = new web3.eth.Contract(
  VotingManagerAbi,
  VOTING_MANAGER_CONTRACT_ADDRESS
);

const handleAddProposalEvent = async (
  eventDatas: EventData[],
  votingAddress: string
) => {
  const proposals: Proposal[] = [];

  eventDatas.forEach((eventData) => {
    const contents: string[] = eventData.returnValues.contents;
    const isImportants: boolean[] = eventData.returnValues.isImportants;
    const startIndex = Number(eventData.returnValues.startIndex);

    contents.forEach((content, index) => {
      const decodedContent = abi.decode(["string"], content)[0];
      const proposal: Proposal = {
        content: decodedContent,
        index: startIndex + index + 1,
        isImportant: isImportants[index],
        contractAddress: votingAddress,
      };
      proposals.push(proposal);
    });
  });
  await insertProposals(proposals);
};

const handleAddVotingEvent = async (eventDatas: EventData[]) => {
  const votings: Voting[] = [];
  eventDatas.forEach((eventData) => {
    const index = eventData.returnValues.index;
    const contractAddress = eventData.returnValues.voting;
    const titleEncoded = eventData.returnValues.title;
    const startTime = eventData.returnValues.startTime;

    const title = abi.decode(["string"], titleEncoded);
    console.log("title: ", title);

    const voting: Voting = {
      index: Number(index),
      contractAddress,
      title: String(title),
      date: new Date(Number(startTime) * 1000 * 86400),
      createdAt: new Date(),
    };

    votings.push(voting);
  });

  await insertVoting(votings);
};

async function main() {
  try {
    let fromBlock = 80415900;
    const latestBlock = await web3.eth.getBlockNumber();
    let fromBlockDb;

    try {
      fromBlockDb = await fs.promises.readFile("./config_/fromBlock", "utf-8");
      fromBlockDb = Number(fromBlockDb);
    } catch (error) {
      fromBlockDb = fromBlock;
    }

    fromBlock = Math.max(fromBlockDb, fromBlock);
    fromBlock = Math.min(latestBlock, fromBlock);

    const toBlock = Math.min(fromBlock + 501, latestBlock);

    console.log(
      `${new Date().toLocaleString()}. Get event from ${fromBlock} to ${toBlock}`
    );

    const curVotingIndex = await votingManager.methods.totalVoting().call();
    if (curVotingIndex > 0) {
      const votingAddress = await votingManager.methods
        .votings(curVotingIndex)
        .call();

      const voting = new web3.eth.Contract(VotingABI, votingAddress);
      const createVotingEvent = await votingManager.getPastEvents("NewVoting", {
        fromBlock,
        toBlock,
      });
      const addProposalEvent = await voting.getPastEvents("AddProposal", {
        fromBlock,
        toBlock,
      });

      console.log(
        "Found ",
        createVotingEvent.length + addProposalEvent.length,
        " events"
      );

      await handleAddProposalEvent(addProposalEvent, votingAddress);
      await handleAddVotingEvent(createVotingEvent);
    }
    fs.writeFileSync("./config_/fromBlock", (toBlock - 1).toString());
    console.log("Done");
  } catch (error) {
    console.log(error);
  }
  setTimeout(() => {
    main();
  }, 10000);
}

main();
