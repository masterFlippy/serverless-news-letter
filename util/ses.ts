import { Article } from "../types";
import { SESClient, SendEmailCommand } from "@aws-sdk/client-ses";

export async function sendEmail(client: SESClient, articles: Article[]) {
  try {
    const html = generateHTML(articles);

    const params = {
      Destination: {
        ToAddresses: ["jonathan.rengius@outlook.com"],
      },
      Message: {
        Body: {
          Html: { Data: html },
        },
        Subject: {
          Charset: "UTF-8",
          Data: "Latest BBC articles",
        },
      },
      Source: "jrengius@gmail.com",
    };
    const command = new SendEmailCommand(params);
    await client.send(command);
  } catch (error) {
    console.error("Error send email", error);
    throw new Error("Failed to send email");
  }
}

function generateHTML(articles: Article[]) {
  const articleHtml = articles
    .filter((article) => article.summary)
    .map(
      (article) => `
        <div style="margin-bottom: 20px;">
          <h2>${article.title}</h2>
          <p>${article.summary}</p>
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
