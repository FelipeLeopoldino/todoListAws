import * as cdk from "aws-cdk-lib";
import * as ssm from "aws-cdk-lib/aws-ssm";
import * as lambda from "aws-cdk-lib/aws-lambda";
import { Construct } from "constructs";

/**
 * Pilha CloudFormation para camadas de eventos de tarefas.
 * Esta pilha define duas camadas Lambda: `TaskEventLayer` e `TaskEventModelLayer`.
 * Também cria parâmetros SSM para armazenar os ARNs de versão da camada.
 */
export class TodoListEventLayerStack extends cdk.Stack {
  /**
   * Construtor da pilha.
   * @param scope O escopo construtor.
   * @param id O ID da pilha.
   * @param props Propriedades opcionais da pilha.
   */
  constructor(scope: Construct, id: string, props?: cdk.StackProps) {
    super(scope, id, props);

    /**
     * Camada Lambda para eventos de tarefas.
     * Contém código relacionado a eventos de tarefas.
     */
    const taskEventLayer = new lambda.LayerVersion(this, "TaskEventLayer", {
      layerVersionName: "TaskEventLayer",
      code: lambda.Code.fromAsset("lambda/events/layers/taskEventLayer"),
      compatibleRuntimes: [lambda.Runtime.NODEJS_20_X],
      removalPolicy: cdk.RemovalPolicy.DESTROY,
    });

    /**
     * Parâmetro SSM para o ARN da versão da camada TaskEventLayer.
     * Permite que outras pilhas acessem o ARN da camada.
     */
    new ssm.StringParameter(this, "TaskEventLayerVersionArn", {
      parameterName: "TaskEventLayerVersionArn",
      stringValue: taskEventLayer.layerVersionArn,
    });

    /**
     * Camada Lambda para o modelo de eventos de tarefas.
     * Contém o modelo de dados para eventos de tarefas.
     */
    const taskEventModelLayer = new lambda.LayerVersion(this, "TaskEventModelLayer", {
      layerVersionName: "TaskEventModelLayer",
      code: lambda.Code.fromAsset("lambda/events/layers/taskEventModelLayer"),
      compatibleRuntimes: [lambda.Runtime.NODEJS_20_X],
      removalPolicy: cdk.RemovalPolicy.DESTROY,
    });

    /**
     * Parâmetro SSM para o ARN da versão da camada TaskEventModelLayer.
     * Permite que outras pilhas acessem o ARN da camada.
     */
    new ssm.StringParameter(this, "TaskEventModelLayerVersionArn", {
      parameterName: "TaskEventModelLayerVersionArn",
      stringValue: taskEventModelLayer.layerVersionArn,
    });
  }
}