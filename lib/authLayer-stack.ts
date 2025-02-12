import * as cdk from "aws-cdk-lib";
import * as lambda from "aws-cdk-lib/aws-lambda";
import * as ssm from "aws-cdk-lib/aws-ssm";
import { Construct } from "constructs";

/**
 * Pilha CloudFormation para a camada de autenticação.
 * Esta pilha cria uma camada Lambda que contém código de autenticação
 * e armazena o ARN da versão da camada em um parâmetro SSM.
 */
export class AuthLayerStack extends cdk.Stack {
  /**
   * Construtor da pilha AuthLayerStack.
   * @param scope O escopo em que a pilha é definida.
   * @param id O ID da pilha.
   * @param props Propriedades opcionais da pilha.
   */
  constructor(scope: Construct, id: string, props?: cdk.StackProps) {
    super(scope, id, props);

    /**
     * Camada Lambda para autenticação.
     * O código da camada está localizado em 'lambda/auth/Layers/authLayer'.
     * Compatível com o runtime Node.js 20.x.
     * A política de remoção é DESTROY, o que significa que a camada será excluída
     * quando a pilha for excluída.
     */
    const authLayer = new lambda.LayerVersion(this, "AuthLayer", {
      layerVersionName: "AuthLayer",
      code: lambda.Code.fromAsset("lambda/auth/Layers/authLayer"),
      compatibleRuntimes: [lambda.Runtime.NODEJS_20_X],
      removalPolicy: cdk.RemovalPolicy.DESTROY,
    });

    /**
     * Parâmetro SSM que armazena o ARN da versão da camada de autenticação.
     * O nome do parâmetro é 'AuthLayerVersionArn'.
     * Isso permite que outras pilhas acessem o ARN da camada.
     */
    new ssm.StringParameter(this, "AuthLayerVersionArn", {
      stringValue: authLayer.layerVersionArn,
      parameterName: "AuthLayerVersionArn",
    });
  }
}
