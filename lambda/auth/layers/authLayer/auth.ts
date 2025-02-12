import { APIGatewayEventDefaultAuthorizerContext } from "aws-lambda";
import { CognitoIdentityServiceProvider } from "aws-sdk";

export class AuthService {
  private cognitoIdentityServiceProvider: CognitoIdentityServiceProvider;

  constructor(cognitoIdentityServiceProvider: CognitoIdentityServiceProvider) {
    this.cognitoIdentityServiceProvider = cognitoIdentityServiceProvider;
  }

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
      throw new Error("Email not found");
    }
    return email;
  }

  isAdminUser(authorizer: APIGatewayEventDefaultAuthorizerContext) {
    return authorizer?.claims.scope.startsWith("admin");
  }
}
