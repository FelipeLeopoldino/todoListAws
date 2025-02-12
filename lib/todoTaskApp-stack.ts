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

/**
 * Stack de Aplicação de Tarefas Todo
 *
 * Esta classe representa a infraestrutura AWS CDK para uma aplicação de gerenciamento de tarefas.
 * Configura recursos como Lambda Functions, DynamoDB, S3, SNS e políticas de IAM.
 *
 * @class TodoTaskAppStack
 * @extends {cdk.Stack}
 */
export class TodoTaskAppStack extends cdk.Stack {
  // Propriedades para armazenar as funções Lambda principais
  taskHandler: lambdaNodeJs.NodejsFunction;
  s3UploadUrlFunction: lambdaNodeJs.NodejsFunction;

  /**
   * Construtor da stack de tarefas
   *
   * @param {Construct} scope - Escopo de construção do CDK
   * @param {string} id - Identificador único da stack
   * @param {TodoTaskAppStackProps} props - Propriedades da stack, incluindo tópico SNS
   */
  constructor(scope: Construct, id: string, props: TodoTaskAppStackProps) {
    super(scope, id, props);

    // Configuração de camadas Lambda para autenticação e manipulação de tarefas
    // Recupera ARNs de camadas a partir de parâmetros do Systems Manager (SSM)
    const authTaskHandler = ssm.StringParameter.valueForStringParameter(
      this,
      "AuthLayerVersionArn"
    );
    const authLayer = lambda.LayerVersion.fromLayerVersionArn(
      this,
      "AuthLayerVersionArn",
      authTaskHandler
    );

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

    // Criação da tabela DynamoDB para armazenamento de tarefas
    // Configurada com chave de partição (pk) e chave de ordenação (sk)
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

    // Função Lambda principal para manipulação de tarefas
    // Configurada com variáveis de ambiente, camadas e permissões de Cognito
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
      layers: [todoTaskLayer, todoTaskDtoLayer, authLayer],
      tracing: lambda.Tracing.ACTIVE,
      insightsVersion: lambda.LambdaInsightsVersion.VERSION_1_0_119_0,
    });

    const taskHandlerCognitoPolice = new iam.PolicyStatement({
      effect: iam.Effect.ALLOW,
      actions: ["cognito-idp:AdminGetUser"],
      resources: [
        "arn:aws:cognito-idp:us-east-1:160885296058:userpool/us-east-1_4Xbzoyyte",
        "arn:aws:cognito-idp:us-east-1:160885296058:userpool/us-east-1_BFM2UjTR0",
      ],
    });

    this.taskHandler.addToRolePolicy(taskHandlerCognitoPolice);

    taskTableDb.grantReadWriteData(this.taskHandler);
    props.snsTopic.grantPublish(this.taskHandler);

    // Criação de bucket S3 para importação em lote de tarefas
    // Nome do bucket gerado dinamicamente com base na conta e região AWS
    const s3Bucket = new s3.Bucket(this, "BatchTasksBucket", {
      bucketName: `batch-tasks-bucket-cf-${this.account}-${this.region}`,
      removalPolicy: cdk.RemovalPolicy.DESTROY,
    });

    // Função Lambda para geração de URLs de upload para S3
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

    // Função Lambda para processamento em lote de tarefas
    // Configurada como um evento de criação de objeto no bucket S3
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

    // Configuração de políticas de IAM para acesso a recursos AWS
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

/**
 * Interface de propriedades estendida para a stack de tarefas
 * Adiciona um tópico SNS obrigatório às propriedades padrão do CDK
 */
export interface TodoTaskAppStackProps extends cdk.StackProps {
  snsTopic: sns.Topic;
}
