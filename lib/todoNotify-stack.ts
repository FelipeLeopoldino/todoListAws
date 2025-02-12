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

/**
 * Pilha de Notificação de Tarefas (TodoNotifyStack)
 * 
 * Esta classe representa uma infraestrutura de notificação baseada em AWS CDK para processamento de eventos de tarefas.
 * 
 * Principais componentes:
 * - Função Lambda para processamento de eventos de notificação
 * - Fila SQS para gerenciamento de eventos
 * - Fila de Dead Letter (DLQ) para tratamento de eventos com falha
 * - Integração com SNS para recebimento de eventos
 * - Permissões para envio de e-mails via Amazon SES
 * 
 * @class TodoNotifyStack
 * @extends {cdk.Stack}
 */
export class TodoNotifyStack extends cdk.Stack {
  constructor(scope: Construct, id: string, props: TodoNotifyStackProps) {
    super(scope, id, props);

    // Recupera a versão da camada de eventos de tarefa a partir de um parâmetro SSM
    const taskEventLayerVersionArn = ssm.StringParameter.valueForStringParameter(
      this,
      "TaskEventLayerVersionArn"
    );

    // Cria uma camada Lambda reutilizável para eventos de tarefa
    const taskEventLayer = lambda.LayerVersion.fromLayerVersionArn(
      this,
      "TaskEventLayerVersionArn",
      taskEventLayerVersionArn
    );

    // Configura a função Lambda para processamento de eventos de notificação
    const notifyEventFunction = new lambdaNodejs.NodejsFunction(this, "NotifyEventFunction", {
      // Configurações detalhadas da função Lambda
      functionName: "notifyEventFunction",
      entry: "lambda/notify/notifyEventFunction.ts",
      handler: "handler",
      timeout: cdk.Duration.seconds(5),
      runtime: lambda.Runtime.NODEJS_20_X,
      memorySize: 512,
      // Opções de empacotamento para otimização
      bundling: {
        minify: true,
        sourceMap: false,
      },
      layers: [taskEventLayer],
      // Habilita rastreamento e insights para monitoramento
      tracing: lambda.Tracing.ACTIVE,
      insightsVersion: lambda.LambdaInsightsVersion.VERSION_1_0_119_0,
    });

    // Cria uma fila de Dead Letter para eventos que falharem repetidamente
    const notifyQueueDlq = new sqs.Queue(this, "NotifyQueueDlq", {
      queueName: "notify-queue-dlq",
      retentionPeriod: cdk.Duration.days(14),
      removalPolicy: cdk.RemovalPolicy.DESTROY,
    });

    // Cria a fila principal de notificações com configuração de Dead Letter
    const notifyQueue = new sqs.Queue(this, "NotifyQueue", {
      queueName: "notify-queue",
      deadLetterQueue: {
        maxReceiveCount: 3,
        queue: notifyQueueDlq,
      },
      removalPolicy: cdk.RemovalPolicy.DESTROY,
    });

    // Adiciona a fila como assinante do tópico SNS
    props.snsTopic.addSubscription(new snsSubscriptions.SqsSubscription(notifyQueue));
    
    // Concede permissão para a função Lambda consumir mensagens da fila
    notifyQueue.grantConsumeMessages(notifyEventFunction);

    // Configura a fonte de eventos SQS para a função Lambda
    notifyEventFunction.addEventSource(new lambdaEventSources.SqsEventSource(notifyQueue, {
        batchSize: 8,
        enabled: true,
        maxBatchingWindow: cdk.Duration.seconds(60)
    }));

    // Cria uma política IAM para permitir o envio de e-mails via Amazon SES
    const notifyEmailPolicy = new iam.PolicyStatement({
      effect: iam.Effect.ALLOW,
      actions: ["ses:SendEmail", "ses:SendRawEmail"],
      resources: ["*"],
    });

    // Adiciona a política de e-mail à função Lambda
    notifyEventFunction.addToRolePolicy(notifyEmailPolicy);
  }
}