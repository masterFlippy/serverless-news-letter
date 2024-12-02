import {
  BatchDetectKeyPhrasesCommand,
  ComprehendClient,
  LanguageCode,
} from "@aws-sdk/client-comprehend";
import { Article } from "../types";

export async function getKeyPhrases(
  client: ComprehendClient,
  articles: Article[]
): Promise<Article[]> {
  try {
    const keyPhrasedArticles: Article[] = [];
    const params = {
      TextList: articles.map((article) => article.text) as string[],
      LanguageCode: LanguageCode.EN,
    };

    const command = new BatchDetectKeyPhrasesCommand(params);
    const result = await client.send(command);

    if (result.ResultList) {
      for (const [index, phrases] of result.ResultList.entries()) {
        const article = articles[index];
        if (phrases.KeyPhrases) {
          keyPhrasedArticles.push({
            ...article,
            keyPhrases: phrases.KeyPhrases.map((phrase) => phrase.Text).join(
              ", "
            ),
          });
        }
      }
    }
    return keyPhrasedArticles;
  } catch (error) {
    console.error("Error getting key phrases:", error);
    throw new Error("Failed to get key phrases");
  }
}
