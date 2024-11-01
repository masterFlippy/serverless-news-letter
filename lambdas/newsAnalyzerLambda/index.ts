import { DynamoDBClient } from "@aws-sdk/client-dynamodb";

interface Event {
  status: string;
  ids: string[];
  processedAt: string;
}

const region = process.env.AWS_REGION || "";
const dynamo = new DynamoDBClient({ region });
const articleTableName: string = process.env.ARTICLE_TABLE_NAME || "";

export async function handler(event: Event) {
  try {
    console.log("event", event);
    const tempArray = ["1", "2", "3", "4", "5"];

    return {
      status: "success",
      ids: tempArray,
      processedAt: new Date().toISOString(),
    };
  } catch (error) {
    throw error;
  }
}
