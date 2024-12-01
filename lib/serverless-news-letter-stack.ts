import * as cdk from "aws-cdk-lib";
import { Construct } from "constructs";
import { NodejsFunction } from "aws-cdk-lib/aws-lambda-nodejs";
import { Runtime } from "aws-cdk-lib/aws-lambda";
import path = require("path");
import { LambdaInvoke } from "aws-cdk-lib/aws-stepfunctions-tasks";
import {
  Choice,
  Condition,
  Fail,
  StateMachine,
} from "aws-cdk-lib/aws-stepfunctions";
import { Rule, Schedule } from "aws-cdk-lib/aws-events";
import { SfnStateMachine } from "aws-cdk-lib/aws-events-targets";
import { AttributeType, Table } from "aws-cdk-lib/aws-dynamodb";
import { Topic } from "aws-cdk-lib/aws-sns";

export class ServerlessNewsLetterStack extends cdk.Stack {
  constructor(scope: Construct, id: string, props?: cdk.StackProps) {
    super(scope, id, props);

    const articleTable = new Table(this, "article", {
      partitionKey: { name: "id", type: AttributeType.STRING },
    });

    const snsTopic = new Topic(this, "MyTopic", {
      displayName: "SNS Topic",
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
          TOPIC_ARN: snsTopic.topicArn,
        },
      }
    );
    snsTopic.grantPublish(sendNewsletterLambda);

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

    const definition = newsScraperLambdaTask.next(newsAnalyzerLambdaTask).next(
      choiceState
        .when(
          Condition.booleanEquals("$.Payload.shouldSendEmail", true),
          sendNewsletterLambdaTask
        )
        .otherwise(
          new Fail(this, "EndState", {
            error: "NoEmailConditionMet",
            cause: "The condition to send email was not met",
          })
        )
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
