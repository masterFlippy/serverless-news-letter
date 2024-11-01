import * as cdk from "aws-cdk-lib";
import { Construct } from "constructs";
import { NodejsFunction } from "aws-cdk-lib/aws-lambda-nodejs";
import { Runtime } from "aws-cdk-lib/aws-lambda";
import path = require("path");
import { LambdaInvoke } from "aws-cdk-lib/aws-stepfunctions-tasks";
import { Choice, Condition, StateMachine } from "aws-cdk-lib/aws-stepfunctions";
import { Rule, Schedule } from "aws-cdk-lib/aws-events";
import { SfnStateMachine } from "aws-cdk-lib/aws-events-targets";
import { AttributeType, Table } from "aws-cdk-lib/aws-dynamodb";

export class ServerlessNewsLetterStack extends cdk.Stack {
  constructor(scope: Construct, id: string, props?: cdk.StackProps) {
    super(scope, id, props);

    const articleTable = new Table(this, "article", {
      partitionKey: { name: "id", type: AttributeType.STRING },
    });

    const newsScraperLambda = new NodejsFunction(this, "newsScraperLambda", {
      runtime: Runtime.NODEJS_18_X,
      handler: "index.handler",
      entry: path.join(__dirname, `/../lambdas/newsScraperLambda/index.ts`),
      environment: {
        ARTICLE_TABLE_NAME: articleTable.tableName,
      },
    });

    const newsAnalyzerLambda = new NodejsFunction(this, "newsAnalyzerLambda", {
      runtime: Runtime.NODEJS_18_X,
      handler: "index.handler",
      entry: path.join(__dirname, `/../lambdas/newsAnalyzerLambda/index.ts`),
      environment: {
        ARTICLE_TABLE_NAME: articleTable.tableName,
      },
    });

    const newsSummarizerLambda = new NodejsFunction(
      this,
      "newsSummarizerLambda",
      {
        runtime: Runtime.NODEJS_18_X,
        handler: "index.handler",
        entry: path.join(
          __dirname,
          `/../lambdas/newsSummarizerLambda/index.ts`
        ),
        environment: {
          ARTICLE_TABLE_NAME: articleTable.tableName,
        },
      }
    );

    const newsCleanUpLambda = new NodejsFunction(this, "newsCleanUpLambda", {
      runtime: Runtime.NODEJS_18_X,
      handler: "index.handler",
      entry: path.join(__dirname, `/../lambdas/newsCleanUpLambda/index.ts`),
      environment: {
        ARTICLE_TABLE_NAME: articleTable.tableName,
      },
    });

    for (const lambda of [
      newsScraperLambda,
      newsAnalyzerLambda,
      newsSummarizerLambda,
      newsCleanUpLambda,
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

    const newsSummarizerLambdaTask = new LambdaInvoke(
      this,
      "Invoke newsSummarizerLambda",
      {
        lambdaFunction: newsSummarizerLambda,
      }
    );

    const newsCleanUpLambdaTask = new LambdaInvoke(
      this,
      "Invoke newsCleanUpLambda",
      {
        lambdaFunction: newsCleanUpLambda,
      }
    );

    const choiceState = new Choice(this, "Choice State");

    const definition = newsScraperLambdaTask
      .next(newsAnalyzerLambdaTask)
      .next(
        choiceState
          .when(
            Condition.booleanEquals("$.choiceCondition", true),
            newsSummarizerLambdaTask.next(newsCleanUpLambdaTask)
          )
          .otherwise(newsCleanUpLambdaTask)
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

    new Rule(this, "HourlyTrigger", {
      schedule: Schedule.cron({ minute: "0" }),
      targets: [new SfnStateMachine(stateMachine)],
    });
  }
}
