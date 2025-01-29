import * as cdk from "aws-cdk-lib";
import { Construct } from "constructs";
import * as lambda from "aws-cdk-lib/aws-lambda";
import * as lambdaNodejs from "aws-cdk-lib/aws-lambda-nodejs";

export class TodoTaskAppStack extends cdk.Stack {
  taskHandler: lambdaNodejs.NodejsFunction;

  constructor(scope: Construct, id: string, props?: cdk.StackProps) {
    super(scope, id, props);

    

    this.taskHandler = new lambdaNodejs.NodejsFunction(this, "TaskHandlerFunction", {
      functionName: "TaskHandlerFunction",
      entry: "lambda/tasks/taskHandlerFunction.ts",
      handler: "handler",
      runtime: lambda.Runtime.NODEJS_20_X,
      memorySize: 512,
      bundling: {
        minify: true,
        sourceMap: false,
      },
      tracing: lambda.Tracing.ACTIVE,
      insightsVersion: lambda.LambdaInsightsVersion.VERSION_1_0_119_0,
    });
  }
}
