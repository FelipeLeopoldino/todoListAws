import * as cdk from "aws-cdk-lib";
import * as dynamodb from "aws-cdk-lib/aws-dynamodb";
import * as lambdaNodejs from "aws-cdk-lib/aws-lambda-nodejs";
import * as lambda from "aws-cdk-lib/aws-lambda";
import * as sns from "aws-cdk-lib/aws-sns";
import * as snsSubscriptions from "aws-cdk-lib/aws-sns-subscriptions";
import * as ssm from "aws-cdk-lib/aws-ssm";
import { Construct } from "constructs";

export class TodoListEventStack extends cdk.Stack {
  eventTopicSns: sns.Topic;

  constructor(scope: Construct, id: string, props?: cdk.StackProps) {
    super(scope, id, props);

    const taskEventLayerVersionArn = ssm.StringParameter.valueForStringParameter(
      this,
      "TaskEventLayerVersionArn"
    );
    const taskEventLayer = lambda.LayerVersion.fromLayerVersionArn(
      this,
      "TaskEventLayerVersionArn",
      taskEventLayerVersionArn
    );

    const taskEventModelLayerVersionArn = ssm.StringParameter.valueForStringParameter(
      this,
      "TaskEventModelLayerVersionArn"
    );
    const taskEventModelLayer = lambda.LayerVersion.fromLayerVersionArn(
      this,
      "TaskEventModelLayerVersionArn",
      taskEventModelLayerVersionArn
    );

    const eventDb = new dynamodb.Table(this, "EventDdb", {
      tableName: "events",
      partitionKey: {
        name: "pk",
        type: dynamodb.AttributeType.STRING,
      },
      sortKey: {
        name: "sk",
        type: dynamodb.AttributeType.STRING,
      },
      readCapacity: 1,
      writeCapacity: 1,
      timeToLiveAttribute: "ttl",
      removalPolicy: cdk.RemovalPolicy.DESTROY,
      billingMode: dynamodb.BillingMode.PROVISIONED,
    });

    const taskEventFunction = new lambdaNodejs.NodejsFunction(this, "TaskEventFunction", {
      functionName: "TaskEventFunction",
      entry: "lambda/events/taskEventHandlerFunction.ts",
      handler: "handler",
      runtime: lambda.Runtime.NODEJS_20_X,
      timeout: cdk.Duration.seconds(2),
      memorySize: 512,
      bundling: {
        minify: true,
        sourceMap: false,
      },
      environment: {
        EVENT_DDB: eventDb.tableName,
      },
      layers: [taskEventLayer, taskEventModelLayer],
      tracing: lambda.Tracing.ACTIVE,
      insightsVersion: lambda.LambdaInsightsVersion.VERSION_1_0_119_0,
    });

    eventDb.grantWriteData(taskEventFunction);

    this.eventTopicSns = new sns.Topic(this, "EventTopicSns", {
      topicName: "todo-events",
      displayName: "Todo List Events",
    });

    this.eventTopicSns.addSubscription(new snsSubscriptions.LambdaSubscription(taskEventFunction));
  }
}
