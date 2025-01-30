import * as cdk from "aws-cdk-lib";
import { Construct } from "constructs";
import * as lambda from "aws-cdk-lib/aws-lambda";
import * as lambdaNodejs from "aws-cdk-lib/aws-lambda-nodejs";
import * as dynamodb from "aws-cdk-lib/aws-dynamodb";
import * as ssm from "aws-cdk-lib/aws-ssm";

export class TodoTaskAppStack extends cdk.Stack {
  taskHandler: lambdaNodejs.NodejsFunction;

  constructor(scope: Construct, id: string, props?: cdk.StackProps) {
    super(scope, id, props);

    const todoTaskLayerVersionArn = ssm.StringParameter.valueForStringParameter(
      this,
      "TodoTaskLayerVersionArn"
    );
    const todoTaskLayer = lambda.LayerVersion.fromLayerVersionArn(
      this,
      "TodoTaskLayerVersionArn",
      todoTaskLayerVersionArn
    );

    const todoTaskDtoLayerVersionArn = ssm.StringParameter.valueForStringParameter(
      this,
      "TodoTaskDtoLayerVersionArn"
    );
    const todoTaskDtoLayer = lambda.LayerVersion.fromLayerVersionArn(
      this,
      "TodoTaskDtoLayerVersionArn",
      todoTaskDtoLayerVersionArn
    );

    const taskTableDb = new dynamodb.Table(this, "TaskDdb", {
      tableName: "tasks",
      partitionKey: {
        name: "pk",
        type: dynamodb.AttributeType.STRING,
      },
      sortKey: {
        name: "sk",
        type: dynamodb.AttributeType.STRING,
      },
      billingMode: dynamodb.BillingMode.PROVISIONED,
      readCapacity: 1,
      writeCapacity: 1,
      removalPolicy: cdk.RemovalPolicy.DESTROY,
    });

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
      environment: {
        TASK_DDB: taskTableDb.tableName,
      },
      layers: [todoTaskLayer, todoTaskDtoLayer],
      tracing: lambda.Tracing.ACTIVE,
      insightsVersion: lambda.LambdaInsightsVersion.VERSION_1_0_119_0,
    });

    taskTableDb.grantReadWriteData(this.taskHandler);
  }
}
