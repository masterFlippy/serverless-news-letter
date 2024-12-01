import { PublishCommand, SNSClient } from "@aws-sdk/client-sns";
import { Article } from "../types";

export async function sendEmail(
  client: SNSClient,
  articles: Article[],
  snsTopic: string
) {
  try {
    const html = generateHTML(articles);
    const subject = "Happy News Today!";
    const bodyText = "Latest Happy Articles From Today";

    const message = {
      Subject: subject,
      Message: JSON.stringify({
        default: bodyText,
        email: html,
      }),
      MessageStructure: "json",
      TopicArn: snsTopic,
    };
    const command = new PublishCommand(message);
    await client.send(command);
  } catch (error) {
    console.error("Error publishing email", error);
    throw new Error("Failed to publish email");
  }
}

function generateHTML(articles: Article[]) {
  const articleHtml = articles
    .map(
      (article) => `
        <div style="margin-bottom: 20px;">
          <h2>${article.title}</h2>
          <p>${article.text}</p>
          <a href="${article.url}" target="_blank">Read more</a>
          <p style="font-size: small; color: gray;">${new Date(
            article.timestamp
          ).toLocaleString()}</p>
        </div>
      `
    )
    .join("");

  return `
    <html>
      <body>
        <h1>Latest Articles</h1>
        ${articleHtml}
      </body>
    </html>
  `;
}
