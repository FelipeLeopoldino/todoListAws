import { APIGatewayEventDefaultAuthorizerContext } from "aws-lambda";
import { CognitoIdentityServiceProvider } from "aws-sdk";

/**
 * Serviço de autenticação que utiliza o Amazon Cognito para gerenciar usuários.
 */
export class AuthService {
  private cognitoIdentityServiceProvider: CognitoIdentityServiceProvider;

  /**
   * Cria uma instância do AuthService.
   *
   * @param cognitoIdentityServiceProvider Instância do CognitoIdentityServiceProvider.
   */
  constructor(cognitoIdentityServiceProvider: CognitoIdentityServiceProvider) {
    this.cognitoIdentityServiceProvider = cognitoIdentityServiceProvider;
  }

  /**
   * Obtém o e-mail do usuário a partir do contexto do autorizador.
   * 
   * Este método extrai o ID do pool de usuários e o nome de usuário a partir dos claims
   * presentes no contexto do autorizador, consulta o Amazon Cognito para buscar os atributos
   * do usuário e retorna o e-mail associado.
   *
   * @param authorizer Contexto do autorizador do API Gateway contendo os claims do usuário.
   * @returns Uma Promise que resolve para o e-mail do usuário.
   * @throws Erro se o e-mail não for encontrado nos atributos do usuário.
   */
  async getUserEmail(authorizer: APIGatewayEventDefaultAuthorizerContext) {
    const userPoolId = authorizer?.claims.iss.split("amazonaws.com/")[1];
    const username = authorizer?.claims.username;

    const user = await this.cognitoIdentityServiceProvider
      .adminGetUser({
        UserPoolId: userPoolId,
        Username: username,
      })
      .promise();

    const email = user.UserAttributes?.find((attr) => attr.Name === "email")?.Value;
    if (!email) {
      throw new Error("Email não encontrado");
    }
    return email;
  }

  /**
   * Verifica se o usuário possui privilégios administrativos.
   *
   * Este método determina se o usuário é administrador inspecionando o claim 'scope'.
   *
   * @param authorizer Contexto do autorizador do API Gateway contendo os claims do usuário.
   * @returns Verdadeiro se o escopo iniciar com "admin", caso contrário, falso.
   */
  isAdminUser(authorizer: APIGatewayEventDefaultAuthorizerContext) {
    return authorizer?.claims.scope.startsWith("admin");
  }
}
