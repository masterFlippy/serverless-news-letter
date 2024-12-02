import * as cdk from "aws-cdk-lib";
import { Construct } from "constructs";
import { NodejsFunction } from "aws-cdk-lib/aws-lambda-nodejs";
import { Runtime } from "aws-cdk-lib/aws-lambda";
import path = require("path");
import { LambdaInvoke } from "aws-cdk-lib/aws-stepfunctions-tasks";
import {
  Choice,
  Condition,
  Pass,
  StateMachine,
} from "aws-cdk-lib/aws-stepfunctions";
import { Rule, Schedule } from "aws-cdk-lib/aws-events";
import { SfnStateMachine } from "aws-cdk-lib/aws-events-targets";
import { AttributeType, Table } from "aws-cdk-lib/aws-dynamodb";
import { PolicyStatement } from "aws-cdk-lib/aws-iam";
import { Secret } from "aws-cdk-lib/aws-secretsmanager";

export class ServerlessNewsLetterStack extends cdk.Stack {
  constructor(scope: Construct, id: string, props?: cdk.StackProps) {
    super(scope, id, props);

    const articleTable = new Table(this, "article", {
      partitionKey: { name: "id", type: AttributeType.STRING },
    });

    const openaiSecret = new Secret(this, "openaiSecret", {
      secretName: "openaiSecret",
    });

    const newsScraperLambda = new NodejsFunction(this, "newsScraperLambda", {
      runtime: Runtime.NODEJS_18_X,
      handler: "index.handler",
      timeout: cdk.Duration.minutes(1),
      entry: path.join(__dirname, `/../lambdas/newsScraperLambda/index.ts`),
      environment: {
        ARTICLE_TABLE_NAME: articleTable.tableName,
      },
    });

    const newsAnalyzerLambda = new NodejsFunction(this, "newsAnalyzerLambda", {
      runtime: Runtime.NODEJS_18_X,
      handler: "index.handler",
      timeout: cdk.Duration.minutes(1),
      entry: path.join(__dirname, `/../lambdas/newsAnalyzerLambda/index.ts`),
      environment: {
        ARTICLE_TABLE_NAME: articleTable.tableName,
      },
    });
    openaiSecret.grantRead(newsAnalyzerLambda);

    newsAnalyzerLambda.addToRolePolicy(
      new PolicyStatement({
        actions: ["comprehend:BatchDetectKeyPhrases"],
        resources: ["*"],
      })
    );

    const sendNewsletterLambda = new NodejsFunction(
      this,
      "sendNewsletterLambda",
      {
        runtime: Runtime.NODEJS_18_X,
        handler: "index.handler",
        timeout: cdk.Duration.minutes(1),
        entry: path.join(
          __dirname,
          `/../lambdas/sendNewsletterLambda/index.ts`
        ),
        environment: {
          ARTICLE_TABLE_NAME: articleTable.tableName,
        },
      }
    );
    sendNewsletterLambda.addToRolePolicy(
      new PolicyStatement({
        actions: ["ses:SendEmail", "ses:SendRawEmail"],
        resources: ["*"],
      })
    );

    for (const lambda of [
      newsScraperLambda,
      newsAnalyzerLambda,
      sendNewsletterLambda,
    ]) {
      articleTable.grantReadWriteData(lambda);
    }

    const newsScraperLambdaTask = new LambdaInvoke(
      this,
      "Invoke newsScraperLambda",
      {
        lambdaFunction: newsScraperLambda,
      }
    );

    const newsAnalyzerLambdaTask = new LambdaInvoke(
      this,
      "Invoke newsAnalyzerLambda",
      {
        lambdaFunction: newsAnalyzerLambda,
      }
    );

    const sendNewsletterLambdaTask = new LambdaInvoke(
      this,
      "Invoke sendNewsletterLambda",
      {
        lambdaFunction: sendNewsletterLambda,
      }
    );

    const choiceState = new Choice(this, "Choice State");

    const definition = newsScraperLambdaTask
      .next(newsAnalyzerLambdaTask)
      .next(
        choiceState
          .when(
            Condition.booleanEquals("$.Payload.shouldSendEmail", true),
            sendNewsletterLambdaTask
          )
          .otherwise(new Pass(this, "NoEmailState", {}))
      );

    const stateMachine = new StateMachine(
      this,
      "ServerlessNewsLetterStateMachine",
      {
        definition,
        timeout: cdk.Duration.minutes(5),
      }
    );
    stateMachine.grantStartExecution(
      new cdk.aws_iam.ServicePrincipal("events.amazonaws.com")
    );

    new Rule(this, "DailyTrigger", {
      schedule: Schedule.cron({ minute: "0", hour: "16" }),
      targets: [new SfnStateMachine(stateMachine)],
    });
  }
}
