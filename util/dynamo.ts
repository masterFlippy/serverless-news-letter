import { marshall, unmarshall } from "@aws-sdk/util-dynamodb";
import { Article } from "../types";
import {
  BatchGetItemCommand,
  BatchWriteItemCommand,
  DynamoDBClient,
} from "@aws-sdk/client-dynamodb";

export function chunkArray(array: any[], chunkSize: number) {
  if (!Array.isArray(array)) {
    throw new TypeError("Expected an array as the first argument");
  }
  if (typeof chunkSize !== "number" || chunkSize <= 0) {
    throw new TypeError("Chunk size must be a positive number");
  }

  return function* () {
    for (let i = 0; i < array.length; i += chunkSize) {
      yield array.slice(i, i + chunkSize);
    }
  };
}

export async function deleteArticles(
  articleIds: string[],
  dynamo: DynamoDBClient,
  articleTableName: string
) {
  const chunks = chunkArray(articleIds, 25);
  for (const chunk of chunks()) {
    const deleteRequests = chunk.map((id) => ({
      DeleteRequest: {
        Key: {
          partitionKey: { S: id },
        },
      },
    }));

    const command = new BatchWriteItemCommand({
      RequestItems: {
        [articleTableName]: deleteRequests,
      },
    });

    await dynamo.send(command);
  }
}

export async function insertArticles(
  articles: Article[],
  dynamo: DynamoDBClient,
  articleTableName: string
) {
  const chunks = chunkArray(articles, 25);
  for (const chunk of chunks()) {
    const putRequests = chunk.map((article: Article) => ({
      PutRequest: {
        Item: marshall(article),
      },
    }));

    const command = new BatchWriteItemCommand({
      RequestItems: {
        [articleTableName]: putRequests,
      },
    });

    await dynamo.send(command);
  }
}

export async function getArticles(
  articleIds: string[],
  dynamo: DynamoDBClient,
  articleTableName: string
): Promise<Article[]> {
  let articles: Article[] = [];
  const chunks = chunkArray(articleIds, 100);
  for (const chunk of chunks()) {
    const keys = chunk.map((id) => marshall({ id }));
    const params = {
      RequestItems: {
        [articleTableName]: {
          Keys: keys,
        },
      },
    };

    const command = new BatchGetItemCommand(params);

    const response = await dynamo.send(command);
    if (response.Responses && response.Responses[articleTableName]) {
      articles.push(
        ...(response.Responses[articleTableName].map((item) =>
          unmarshall(item)
        ) as Article[])
      );
    }
  }
  return articles;
}
