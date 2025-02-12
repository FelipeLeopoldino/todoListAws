import * as cdk from "aws-cdk-lib";
import { Construct } from "constructs";
import * as ssm from "aws-cdk-lib/aws-ssm";
import * as lambda from "aws-cdk-lib/aws-lambda";

/**
 * Pilha CloudFormation para camadas da lista de tarefas.
 * Esta pilha define duas camadas Lambda:
 * - TodoTaskLayer: Camada para a lógica de tarefas.
 * - TodoTaskDtoLayer: Camada para o DTO de tarefas.
 *
 * Também cria parâmetros SSM para armazenar os ARNs das versões das camadas,
 * permitindo que outras pilhas acessem essas informações.
 */
export class TodoListLayersStack extends cdk.Stack {
  constructor(scope: Construct, id: string, props?: cdk.StackProps) {
    super(scope, id, props);

    /**
     * Camada Lambda para a lógica de tarefas.
     * O código desta camada está localizado em 'lambda/tasks/layers/todoTaskLayer'.
     */
    const todoTaskLayer = new lambda.LayerVersion(this, "TodoTaskLayer", {
      layerVersionName: "TodoTaskLayer",
      code: lambda.Code.fromAsset("lambda/tasks/layers/todoTaskLayer"),
      compatibleRuntimes: [lambda.Runtime.NODEJS_20_X],
      removalPolicy: cdk.RemovalPolicy.DESTROY,
    });

    /**
     * Parâmetro SSM para armazenar o ARN da versão da camada TodoTaskLayer.
     * Isso permite que outras pilhas acessem o ARN da camada.
     */
    new ssm.StringParameter(this, "TodoTaskLayerVersionArn", {
      stringValue: todoTaskLayer.layerVersionArn,
      parameterName: "TodoTaskLayerVersionArn",
    });

    /**
     * Camada Lambda para o DTO de tarefas.
     * O código desta camada está localizado em 'lambda/tasks/layers/todoTaskDtoLayer'.
     */
    const todoTaskDtoLayer = new lambda.LayerVersion(this, "TodoTaskDtoLayer", {
      layerVersionName: "TodoTaskDtoLayer",
      code: lambda.Code.fromAsset("lambda/tasks/layers/todoTaskDtoLayer"),
      compatibleRuntimes: [lambda.Runtime.NODEJS_20_X],
      removalPolicy: cdk.RemovalPolicy.DESTROY,
    });

    /**
     * Parâmetro SSM para armazenar o ARN da versão da camada TodoTaskDtoLayer.
     * Isso permite que outras pilhas acessem o ARN da camada.
     */
    new ssm.StringParameter(this, "TodoTaskDtoLayerVersionArn", {
      stringValue: todoTaskDtoLayer.layerVersionArn,
      parameterName: "TodoTaskDtoLayerVersionArn",
    });
  }
}