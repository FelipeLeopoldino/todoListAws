import * as cdk from "aws-cdk-lib";
import * as dynamodb from "aws-cdk-lib/aws-dynamodb";
import * as lambdaNodejs from "aws-cdk-lib/aws-lambda-nodejs";
import * as lambda from "aws-cdk-lib/aws-lambda";
import * as sns from "aws-cdk-lib/aws-sns";
import * as snsSubscriptions from "aws-cdk-lib/aws-sns-subscriptions";
import * as ssm from "aws-cdk-lib/aws-ssm";
import { Construct } from "constructs";

/**
 * Pilha de Eventos para Lista de Tarefas
 * 
 * Esta classe representa uma infraestrutura de eventos para uma aplicação de lista de tarefas,
 * utilizando AWS CDK para configurar recursos como DynamoDB, Lambda e SNS.
 * 
 * @class TodoListEventStack
 * @extends {cdk.Stack}
 */
export class TodoListEventStack extends cdk.Stack {
  // Tópico SNS para publicação de eventos
  eventTopicSns: sns.Topic;

  /**
   * Construtor da pilha de eventos
   * 
   * Configura os seguintes recursos:
   * - Camadas Lambda para manipulação de eventos
   * - Tabela DynamoDB para armazenamento de eventos
   * - Função Lambda para processamento de eventos de tarefa
   * - Tópico SNS para publicação de eventos
   * 
   * @param Construct scope Escopo de construção do CDK
   * @param string id Identificador único da pilha
   * @param cdk.StackProps [props] Propriedades opcionais da pilha
   */
  constructor(scope: Construct, id: string, props?: cdk.StackProps) {
    super(scope, id, props);

    // Recupera ARNs de camadas Lambda a partir de parâmetros do SSM
    const taskEventLayerVersionArn = ssm.StringParameter.valueForStringParameter(
      this,
      "TaskEventLayerVersionArn"
    );
    const taskEventLayer = lambda.LayerVersion.fromLayerVersionArn(
      this,
      "TaskEventLayerVersionArn",
      taskEventLayerVersionArn
    );

    // Configuração da camada de modelo de eventos
    const taskEventModelLayerVersionArn = ssm.StringParameter.valueForStringParameter(
      this,
      "TaskEventModelLayerVersionArn"
    );
    const taskEventModelLayer = lambda.LayerVersion.fromLayerVersionArn(
      this,
      "TaskEventModelLayerVersionArn",
      taskEventModelLayerVersionArn
    );

    // Criação da tabela DynamoDB para armazenamento de eventos
    const eventDb = new dynamodb.Table(this, "EventDdb", {
      tableName: "events",
      partitionKey: { name: "pk", type: dynamodb.AttributeType.STRING },
      sortKey: { name: "sk", type: dynamodb.AttributeType.STRING },
      readCapacity: 1,
      writeCapacity: 1,
      timeToLiveAttribute: "ttl",
      removalPolicy: cdk.RemovalPolicy.DESTROY,
      billingMode: dynamodb.BillingMode.PROVISIONED,
    });

    // Configuração da função Lambda para manipulação de eventos de tarefa
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

    // Concede permissão de escrita para a função Lambda na tabela de eventos
    eventDb.grantWriteData(taskEventFunction);

    // Criação do tópico SNS para eventos da lista de tarefas
    this.eventTopicSns = new sns.Topic(this, "EventTopicSns", {
      topicName: "todo-events",
      displayName: "Todo List Events",
    });

    // Adiciona a função Lambda como assinante do tópico SNS
    this.eventTopicSns.addSubscription(new snsSubscriptions.LambdaSubscription(taskEventFunction));
  }
}