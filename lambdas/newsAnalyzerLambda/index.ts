import { DynamoDBClient } from "@aws-sdk/client-dynamodb";
import { deleteArticles, getArticles } from "../../util/dynamo";
import { ComprehendClient } from "@aws-sdk/client-comprehend";
import { getSentiment } from "../../util/comprehend";

interface Event {
  Payload: {
    status: string;
    ids: string[];
    processedAt: string;
  };
}

const region = process.env.AWS_REGION || "";
const dynamo = new DynamoDBClient({ region });
const comprehend = new ComprehendClient({ region });

const articleTableName: string = process.env.ARTICLE_TABLE_NAME || "";

export async function handler(event: Event) {
  try {
    const articles = await getArticles(
      event.Payload.ids,
      dynamo,
      articleTableName
    );
    const happyArticles = await getSentiment(comprehend, articles);

    const articleIds = happyArticles.map((article) => article.id);
    const happyArticleIds = happyArticles.map((article) => article.id);
    const happyArticleIdsSet = new Set(happyArticleIds);

    const sadArticleIds: string[] = articleIds.filter(
      (id) => !happyArticleIdsSet.has(id)
    );

    await deleteArticles(sadArticleIds, dynamo, articleTableName);

    return {
      status: "success",
      ids: happyArticleIds,
      ShouldSendEmail: happyArticleIds.length > 0,
      processedAt: new Date().toISOString(),
    };
  } catch (error) {
    throw error;
  }
}
