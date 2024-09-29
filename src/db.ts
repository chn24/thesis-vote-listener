import { Collection, Db, MongoClient } from "mongodb";

export type Proposal = {
  index: number;
  content: string;
  isImportant: boolean;
  contractAddress: string;
};

export type Voting = {
  index: number;
  title: string;
  date: Date;
  contractAddress: string;
  createdAt: Date;
};

export async function getMongoClient() {
  if (!global.mongoClientPromise) {
    const client = new MongoClient(process.env.MONGO_URL || "");
    global.mongoClientPromise = client.connect();
  }
  return global.mongoClientPromise as MongoClient;
}

export async function getMongoDb(dbName = "thesis") {
  const mongoClient = await getMongoClient();
  return mongoClient.db(dbName);
}

export const insertVoting = async (votings: Voting[]) => {
  if (votings.length === 0) {
    return;
  }
  const db: Db = await getMongoDb();
  const votingsCollection: Collection = db.collection("votings");

  await votingsCollection.insertMany(votings);
};

export const insertProposals = async (proposals: Proposal[]) => {
  if (proposals.length === 0) {
    return;
  }
  const db: Db = await getMongoDb();
  const proposalsCollection: Collection = db.collection("proposals");

  await proposalsCollection.insertMany(proposals);
};
