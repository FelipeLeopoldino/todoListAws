import * as cdk from "aws-cdk-lib";
import { Construct } from "constructs";
import * as ssm from "aws-cdk-lib/aws-ssm";
import * as lambda from "aws-cdk-lib/aws-lambda";

export class TodoListLayersStack extends cdk.Stack {
  constructor(scope: Construct, id: string, props?: cdk.StackProps) {
    super(scope, id, props);

    const todoTaskLayer = new lambda.LayerVersion(this, "TodoTaskLayer", {
      layerVersionName: "TodoTaskLayer",
      code: lambda.Code.fromAsset("lambda/tasks/layers/todoTaskLayer"),
      compatibleRuntimes: [lambda.Runtime.NODEJS_20_X],
      removalPolicy: cdk.RemovalPolicy.DESTROY,
    });

    new ssm.StringParameter(this, "TodoTaskLayerVersionArn", {
      stringValue: todoTaskLayer.layerVersionArn,
      parameterName: "TodoTaskLayerVersionArn",
    });

    const todoTaskDtoLayer = new lambda.LayerVersion(this, "TodoTaskDtoLayer", {
      layerVersionName: "TodoTaskDtoLayer",
      code: lambda.Code.fromAsset("lambda/tasks/layers/todoTaskDtoLayer"),
      compatibleRuntimes: [lambda.Runtime.NODEJS_20_X],
      removalPolicy: cdk.RemovalPolicy.DESTROY,
    });

    new ssm.StringParameter(this, "TodoTaskDtoLayerVersionArn", {
      stringValue: todoTaskDtoLayer.layerVersionArn,
      parameterName: "TodoTaskDtoLayerVersionArn",
    });
  }
}
