import {
  GetSecretValueCommand,
  SecretsManagerClient,
} from "@aws-sdk/client-secrets-manager";

export async function getSecret(
  client: SecretsManagerClient,
  secretName: string
): Promise<string> {
  try {
    const command = new GetSecretValueCommand({
      SecretId: secretName,
    });
    const response = await client.send(command);

    if (response.SecretString) {
      return response.SecretString;
    } else {
      throw new Error("Secret not found");
    }
  } catch (error) {
    console.error("Error getting secret:", error);
    throw new Error("Failed to get secret");
  }
}
