import * as cdk from "aws-cdk-lib";
import * as lambda from "aws-cdk-lib/aws-lambda";
import * as lambdaNodejs from "aws-cdk-lib/aws-lambda-nodejs";
import * as lambdaEventSources from "aws-cdk-lib/aws-lambda-event-sources";
import * as sqs from "aws-cdk-lib/aws-sqs";
import * as iam from "aws-cdk-lib/aws-iam";
import * as sns from "aws-cdk-lib/aws-sns";
import * as snsSubscriptions from "aws-cdk-lib/aws-sns-subscriptions";
import * as ssm from "aws-cdk-lib/aws-ssm";
import { Construct } from "constructs";

export interface TodoNotifyStackProps extends cdk.StackProps {
  snsTopic: sns.Topic;
}

export class TodoNotifyStack extends cdk.Stack {
  constructor(scope: Construct, id: string, props: TodoNotifyStackProps) {
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

    const notifyEventFunction = new lambdaNodejs.NodejsFunction(this, "NotifyEventFunction", {
      functionName: "notifyEventFunction",
      entry: "lambda/notify/notifyEventFunction.ts",
      handler: "handler",
      timeout: cdk.Duration.seconds(5),
      runtime: lambda.Runtime.NODEJS_20_X,
      memorySize: 512,
      bundling: {
        minify: true,
        sourceMap: false,
      },
      layers: [taskEventLayer],
      tracing: lambda.Tracing.ACTIVE,
      insightsVersion: lambda.LambdaInsightsVersion.VERSION_1_0_119_0,
    });

    const notifyQueueDlq = new sqs.Queue(this, "NotifyQueueDlq", {
      queueName: "notify-queue-dlq",
      retentionPeriod: cdk.Duration.days(14),
      removalPolicy: cdk.RemovalPolicy.DESTROY,
    });

    const notifyQueue = new sqs.Queue(this, "NotifyQueue", {
      queueName: "notify-queue",
      deadLetterQueue: {
        maxReceiveCount: 3,
        queue: notifyQueueDlq,
      },
      removalPolicy: cdk.RemovalPolicy.DESTROY,
    });
    props.snsTopic.addSubscription(new snsSubscriptions.SqsSubscription(notifyQueue));
    notifyQueue.grantConsumeMessages(notifyEventFunction);

    notifyEventFunction.addEventSource(new lambdaEventSources.SqsEventSource(notifyQueue, {
        batchSize: 8,
        enabled: true,
        maxBatchingWindow: cdk.Duration.seconds(60)
    }));

    const notifyEmailPolicy = new iam.PolicyStatement({
      effect: iam.Effect.ALLOW,
      actions: ["ses:SendEmail", "ses:SendRawEmail"],
      resources: ["*"],
    });

    notifyEventFunction.addToRolePolicy(notifyEmailPolicy);
  }
}
