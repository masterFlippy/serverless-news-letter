import { DynamoDBClient } from "@aws-sdk/client-dynamodb";
import { getArticles, insertArticles } from "../../util/dynamo";
import { ComprehendClient } from "@aws-sdk/client-comprehend";
import OpenAI from "openai";
import { summarizeArticles } from "../../util/scraper";
import { SecretsManagerClient } from "@aws-sdk/client-secrets-manager";
import { getSecret } from "../../util/secretsmanager";

interface Event {
  Payload: {
    status: string;
    ids: string[];
    processedAt: string;
  };
}

const region = process.env.AWS_REGION || "";
const dynamo = new DynamoDBClient({ region });
const secretsManager = new SecretsManagerClient({ region });
const comprehend = new ComprehendClient({ region: "eu-west-1" });
const articleTableName: string = process.env.ARTICLE_TABLE_NAME || "";

export async function handler(event: Event) {
  try {
    const articles = await getArticles(
      event.Payload.ids,
      dynamo,
      articleTableName
    );
    const secret = await getSecret(secretsManager, "newsletter-config");
    const openai = new OpenAI({
      apiKey: secret.apiKey,
    });

    const summarizedArticles = await summarizeArticles(
      comprehend,
      openai,
      articles
    );
    await insertArticles(summarizedArticles, dynamo, articleTableName);
    return {
      status: "success",
      ids: summarizedArticles.map((article) => article.id),
      shouldSendEmail: summarizedArticles.length > 0,
      processedAt: new Date().toISOString(),
    };
  } catch (error) {
    throw error;
  }
}
