#!/usr/bin/env node
import "source-map-support/register";
import * as cdk from "aws-cdk-lib";
import { ServerlessNewsLetterStack } from "../lib/serverless-news-letter-stack";

const app = new cdk.App();
new ServerlessNewsLetterStack(app, "ServerlessNewsLetterStack", {
  env: { account: "123456789012", region: "us-east-1" },
});
