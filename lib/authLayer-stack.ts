import * as cdk from "aws-cdk-lib";
import * as lambda from "aws-cdk-lib/aws-lambda";
import * as ssm from "aws-cdk-lib/aws-ssm";
import { Construct } from "constructs";

export class AuthLayerStack extends cdk.Stack {
  constructor(scope: Construct, id: string, props?: cdk.StackProps) {
    super(scope, id, props);

    const authLayer = new lambda.LayerVersion(this, "AuthLayer", {
      layerVersionName: "AuthLayer",
      code: lambda.Code.fromAsset("lambda/auth/Layers/authLayer"),
      compatibleRuntimes: [lambda.Runtime.NODEJS_20_X],
      removalPolicy: cdk.RemovalPolicy.DESTROY,
    });

    new ssm.StringParameter(this, "AuthLayerVersionArn", {
      stringValue: authLayer.layerVersionArn,
      parameterName: "AuthLayerVersionArn",
    });
  }
}
