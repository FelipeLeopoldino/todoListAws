import * as cdk from "aws-cdk-lib";
import { Construct } from "constructs";
import * as lambda from "aws-cdk-lib/aws-lambda";
import * as lambdaNodeJs from "aws-cdk-lib/aws-lambda-nodejs";
import * as lambdaEventSource from "aws-cdk-lib/aws-lambda-event-sources";
import * as dynamodb from "aws-cdk-lib/aws-dynamodb";
import * as ssm from "aws-cdk-lib/aws-ssm";
import * as sns from "aws-cdk-lib/aws-sns";
import * as s3 from "aws-cdk-lib/aws-s3";
import * as iam from "aws-cdk-lib/aws-iam";

export interface TodoTaskAppStackProps extends cdk.StackProps {
  snsTopic: sns.Topic;
}

export class TodoTaskAppStack extends cdk.Stack {
  taskHandler: lambdaNodeJs.NodejsFunction;
  s3UploadUrlFunction: lambdaNodeJs.NodejsFunction;

  constructor(scope: Construct, id: string, props: TodoTaskAppStackProps) {
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

    const taskTableDb = new dynamodb.Table(this, "TasksDdb", {
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

    this.taskHandler = new lambdaNodeJs.NodejsFunction(this, "TaskHandlerFunction", {
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
        SNS_TOPIC_ARN: props.snsTopic.topicArn,
      },
      layers: [todoTaskLayer, todoTaskDtoLayer],
      tracing: lambda.Tracing.ACTIVE,
      insightsVersion: lambda.LambdaInsightsVersion.VERSION_1_0_119_0,
    });

    taskTableDb.grantReadWriteData(this.taskHandler);
    props.snsTopic.grantPublish(this.taskHandler);

    //Recursos importação de lote de tasks

    const s3Bucket = new s3.Bucket(this, "BatchTasksBucket", {
      bucketName: "batch-tasks-bucket",
      removalPolicy: cdk.RemovalPolicy.DESTROY,
    });

    this.s3UploadUrlFunction = new lambdaNodeJs.NodejsFunction(this, "S3UploadUrlFunction", {
      functionName: "S3UploadUrlFunction",
      entry: "lambda/tasks/s3UploadUrlFunction.ts",
      handler: "handler",
      memorySize: 512,
      runtime: lambda.Runtime.NODEJS_20_X,
      bundling: {
        minify: true,
        sourceMap: false,
      },
      environment: {
        BUCKET_NAME: s3Bucket.bucketName,
      },
      tracing: lambda.Tracing.ACTIVE,
      insightsVersion: lambda.LambdaInsightsVersion.VERSION_1_0_119_0,
    });

    const s3UploadFuncitonPutPolicy = new iam.PolicyStatement({
      effect: iam.Effect.ALLOW,
      actions: ["s3:PutObject"],
      resources: [`${s3Bucket.bucketArn}/*`],
    });

    this.s3UploadUrlFunction.addToRolePolicy(s3UploadFuncitonPutPolicy);

    const batchTaskFunction = new lambdaNodeJs.NodejsFunction(this, "BatchTaskFunction", {
      functionName: "BatchTaskFunction",
      entry: "lambda/tasks/batchTaskFunction.ts",
      handler: "handler",
      memorySize: 512,
      runtime: lambda.Runtime.NODEJS_20_X,
      bundling: {
        minify: true,
        sourceMap: false,
      },
      environment: {
        TASK_DDB: taskTableDb.tableName,
        SNS_TOPIC_ARN: props.snsTopic.topicArn,
      },
      tracing: lambda.Tracing.ACTIVE,
      insightsVersion: lambda.LambdaInsightsVersion.VERSION_1_0_119_0,
    });

    batchTaskFunction.addEventSource(
      new lambdaEventSource.S3EventSource(s3Bucket, {
        events: [s3.EventType.OBJECT_CREATED],
      })
    );

    const batchTaskFunctionDeleteGetPolicy = new iam.PolicyStatement({
      effect: iam.Effect.ALLOW,
      actions: ["s3:DeleteObject", "s3:GetObject"],
      resources: [`${s3Bucket.bucketArn}/*`],
    });

    batchTaskFunction.addToRolePolicy(batchTaskFunctionDeleteGetPolicy);
    taskTableDb.grantWriteData(batchTaskFunction);
    props.snsTopic.grantPublish(batchTaskFunction);
  }
}
