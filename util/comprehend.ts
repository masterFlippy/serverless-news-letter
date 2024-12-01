import {
  BatchDetectSentimentCommand,
  ComprehendClient,
  LanguageCode,
} from "@aws-sdk/client-comprehend";
import { Article } from "../types";

export async function getSentiment(
  client: ComprehendClient,
  articles: Article[]
): Promise<Article[]> {
  try {
    const happyArticles: Article[] = [];
    const params = {
      TextList: articles.map((article) => article.text) as string[],
      LanguageCode: LanguageCode.EN,
    };

    const command = new BatchDetectSentimentCommand(params);
    const result = await client.send(command);

    if (result.ResultList) {
      for (const [index, sentiment] of result.ResultList.entries()) {
        const article = articles[index];
        article.mood = sentiment.Sentiment === "POSITIVE" ? "happy" : undefined;
        if (article.mood === "happy") {
          happyArticles.push(article);
        }
      }
    }
    return happyArticles;
  } catch (error) {
    console.error("Error analyzing sentiment:", error);
    throw new Error("Failed to analyze sentiment");
  }
}
