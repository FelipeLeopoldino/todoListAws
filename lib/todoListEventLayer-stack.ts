import * as cdk from "aws-cdk-lib";
import * as ssm from "aws-cdk-lib/aws-ssm";
import * as lambda from "aws-cdk-lib/aws-lambda";
import { Construct } from "constructs";

export class TodoListEventLayerStack extends cdk.Stack {
  constructor(scope: Construct, id: string, props?: cdk.StackProps) {
    super(scope, id, props);

    const taskEventLayer = new lambda.LayerVersion(this, "TaskEventLayer", {
      layerVersionName: "TaskEventLayer",
      code: lambda.Code.fromAsset("lambda/events/layers/taskEventLayer"),
      compatibleRuntimes: [lambda.Runtime.NODEJS_20_X],
      removalPolicy: cdk.RemovalPolicy.DESTROY,
    });

    new ssm.StringParameter(this, "TaskEventLayerVersionArn", {
      parameterName: "TaskEventLayerVersionArn",
      stringValue: taskEventLayer.layerVersionArn,
    });

    const taskEventModelLayer = new lambda.LayerVersion(this, "TaskEventModelLayer", {
      layerVersionName: "TaskEventModelLayer",
      code: lambda.Code.fromAsset("lambda/events/layers/taskEventModelLayer"),
      compatibleRuntimes: [lambda.Runtime.NODEJS_20_X],
      removalPolicy: cdk.RemovalPolicy.DESTROY,
    });

    new ssm.StringParameter(this, "TaskEventModelLayerVersionArn", {
      parameterName: "TaskEventModelLayerVersionArn",
      stringValue: taskEventModelLayer.layerVersionArn,
    });
  }
}
