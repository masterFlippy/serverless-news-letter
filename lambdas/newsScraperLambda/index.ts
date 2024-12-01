import { DynamoDBClient } from "@aws-sdk/client-dynamodb";
import { parseStringPromise } from "xml2js";
import { v4 as uuid } from "uuid";
import { Article } from "../../types";
import { insertArticles } from "../../util/dynamo";

const region = process.env.AWS_REGION || "eu-north-1";
const dynamo = new DynamoDBClient({ region });
const articleTableName: string = process.env.ARTICLE_TABLE_NAME || "";

export async function handler(event: any) {
  try {
    const rssUrl = "https://feeds.bbci.co.uk/news/world/rss.xml";

    const response = await fetch(rssUrl);
    if (!response.ok) {
      throw new Error(`Failed to fetch RSS feed: ${response.statusText}`);
    }

    const rssXml = await response.text();
    const rssJson = await parseStringPromise(rssXml);
    const items = rssJson.rss.channel[0].item;
    const articles: Article[] = items
      .filter(
        (item: any) =>
          new Date(item.pubDate[0]).setHours(0, 0, 0, 0) ===
          new Date().setHours(0, 0, 0, 0)
      )
      .map(
        (item: {
          title: any[];
          description: any[];
          link: any[];
          pubDate: any[];
        }) => ({
          id: uuid(),
          title: item.title[0],
          text: item.description[0],
          url: item.link[0],
          timestamp: new Date(item.pubDate[0]).getTime(),
        })
      );

    await insertArticles(articles, dynamo, articleTableName);

    return {
      status: "success",
      ids: articles.map((article) => article.id),
      processedAt: new Date().toISOString(),
    };
  } catch (error) {
    throw error;
  }
}
