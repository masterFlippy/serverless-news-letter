import OpenAI from "openai";
import { Article } from "../types";

export async function getSummary(
  openai: OpenAI,
  article: Article
): Promise<string | undefined> {
  if (!article.keyPhrases) {
    throw new Error("Article does not have key phrases");
  }
  const completion = await openai.chat.completions.create({
    model: "gpt-4o-mini",
    messages: [
      {
        role: "system",
        content:
          "You are helpful assistant with the sole purpose of creating a summary from key phrases. You will create a summary for the following key phrases and only return the summary.",
      },
      {
        role: "user",
        content: article.keyPhrases,
      },
    ],
  });
  return completion.choices[0].message.content ?? undefined;
}
