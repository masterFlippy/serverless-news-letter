import { DynamoDBClient } from "@aws-sdk/client-dynamodb";
import { SESClient } from "@aws-sdk/client-ses";
import { getArticles } from "../../util/dynamo";
import { sendEmail } from "../../util/ses";

interface Event {
  Payload: {
    status: string;
    ids: string[];
    processedAt: string;
  };
}

const region = process.env.AWS_REGION || "";
const dynamo = new DynamoDBClient({ region });
const ses = new SESClient({ region });
const articleTableName: string = process.env.ARTICLE_TABLE_NAME || "";

export async function handler(event: Event) {
  try {
    const articles = await getArticles(
      event.Payload.ids,
      dynamo,
      articleTableName
    );

    await sendEmail(ses, articles);

    return {
      status: "success",
      processedAt: new Date().toISOString(),
    };
  } catch (error) {
    throw error;
  }
}
