import * as cheerio from "cheerio";
import { Article } from "../types";
import { ComprehendClient } from "@aws-sdk/client-comprehend";
import OpenAI from "openai";
import { getKeyPhrases } from "./comprehend";
import { getSummary } from "./openai";

export async function summarizeArticles(
  comprehend: ComprehendClient,
  openai: OpenAI,
  articles: Article[]
): Promise<Article[]> {
  try {
    const fullBodyArticles: Article[] = [];
    for (const article of articles) {
      fullBodyArticles.push({
        ...article,
        fullBodyText: await getArticleBody(article.url),
      });
    }

    const keyPhrasedArticles = await getKeyPhrases(
      comprehend,
      fullBodyArticles
    );

    const summarizedArticlePromises = keyPhrasedArticles.map(
      async (article) => {
        const summary = await getSummary(openai, article);

        return {
          ...article,
          summary,
        };
      }
    );

    return await Promise.all(summarizedArticlePromises);
  } catch (error) {
    console.error("Error summarizing articles:", error);
    throw new Error("Failed to summarize articles");
  }
}

export async function getArticleBody(url: string): Promise<string> {
  try {
    const response = await fetch(url);

    if (!response.ok) {
      throw new Error(`Failed to fetch the URL: ${url}`);
    }

    const html = await response.text();
    const $ = cheerio.load(html);
    const textBlocks = $("article").find('div[data-component="text-block"]');
    let articleText = "";

    textBlocks.each((_, el) => {
      $(el)
        .find("p")
        .each((_, paragraph) => {
          articleText += $(paragraph).text().trim() + "\n";
        });
    });

    return articleText.trim();
  } catch (error) {
    console.error(`Error fetching article body from ${url}:`, error);
    throw new Error("Failed to fetch article body");
  }
}
