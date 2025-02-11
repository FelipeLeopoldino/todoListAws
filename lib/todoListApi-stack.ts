import * as cdk from "aws-cdk-lib";
import * as apiGateway from "aws-cdk-lib/aws-apigateway";
import * as cwlogs from "aws-cdk-lib/aws-logs";
import * as lambdaNodeJs from "aws-cdk-lib/aws-lambda-nodejs";
import * as cognito from "aws-cdk-lib/aws-cognito";
import { Construct } from "constructs";

export interface TodoListApiStackProps extends cdk.StackProps {
  lambdaTodoTaskApp: lambdaNodeJs.NodejsFunction;
  s3UploadUrlFunction: lambdaNodeJs.NodejsFunction;
}

export class TodoListApiStack extends cdk.Stack {
  private userBasicPool: cognito.UserPool;
  private adminPool: cognito.UserPool;
  private taskAuthorizer: apiGateway.CognitoUserPoolsAuthorizer;
  private adminTaskAuthorizer: apiGateway.CognitoUserPoolsAuthorizer;

  constructor(scope: Construct, id: string, props: TodoListApiStackProps) {
    super(scope, id, props);

    this.createCognitoAuth();

    const logGroup = new cwlogs.LogGroup(this, "TodoListApiLogs");
    const api = new apiGateway.RestApi(this, "TodoListApi", {
      restApiName: "TodoListApi",
      cloudWatchRole: true,
      deployOptions: {
        accessLogDestination: new apiGateway.LogGroupLogDestination(logGroup),
        accessLogFormat: apiGateway.AccessLogFormat.jsonWithStandardFields({
          ip: true,
          caller: true,
          httpMethod: true,
          protocol: true,
          requestTime: true,
          resourcePath: true,
          responseLength: true,
          status: true,
          user: true,
        }),
      },
    });

    const todoTaskAppIntegration = new apiGateway.LambdaIntegration(props.lambdaTodoTaskApp);
    const apiTaskResource = api.root.addResource("tasks");

    const taskAuthorizerOption = {
      authorizer: this.taskAuthorizer,
      authorizationType: apiGateway.AuthorizationType.COGNITO,
      authorizationScopes: ["user-basic/web", "user-basic/mobile", "admin/web"],
    };

    //GET /tasks
    //GET /tasks?email=email@gmail.com
    //GET /tasks?email=email@gmail.com&taskid=tid-123
    apiTaskResource.addMethod("GET", todoTaskAppIntegration, taskAuthorizerOption);

    //POST /tasks
    const taskResquestValidator = new apiGateway.RequestValidator(this, "TaskRequestValidator", {
      restApi: api,
      requestValidatorName: "Task Request Validator",
      validateRequestBody: true,
    });

    const taskModel = new apiGateway.Model(this, "TaskModel", {
      modelName: "TaskModel",
      restApi: api,
      schema: {
        type: apiGateway.JsonSchemaType.OBJECT,
        properties: {
          title: {
            type: apiGateway.JsonSchemaType.STRING,
            maxLength: 50,
            minLength: 5,
          },
          description: {
            type: apiGateway.JsonSchemaType.STRING,
            maxLength: 150,
            minLength: 10,
          },
          deadLine: {
            type: apiGateway.JsonSchemaType.STRING,
          },
          owner: {
            type: apiGateway.JsonSchemaType.OBJECT,
            properties: {
              name: {
                type: apiGateway.JsonSchemaType.STRING,
                minLength: 3,
                maxLength: 50,
              },
              email: {
                type: apiGateway.JsonSchemaType.STRING,
                minLength: 5,
                maxLength: 100,
                format: "email",
              },
            },
            required: ["name", "email"],
          },
          assignedBy: {
            type: apiGateway.JsonSchemaType.OBJECT,
            properties: {
              name: {
                type: apiGateway.JsonSchemaType.STRING,
                minLength: 3,
                maxLength: 50,
              },
              email: {
                type: apiGateway.JsonSchemaType.STRING,
                minLength: 5,
                maxLength: 100,
                pattern: "^[\\w-\\.]+@([\\w-]+\\.)+[\\w-]{2,4}$",
              },
            },
            required: ["name", "email"],
          },
        },
        required: ["title", "owner", "assignedBy"],
      },
    });

    apiTaskResource.addMethod("POST", todoTaskAppIntegration, {
      requestValidator: taskResquestValidator,
      requestModels: {
        "application/json": taskModel,
      },
      authorizer: taskAuthorizerOption.authorizer,
      authorizationType: taskAuthorizerOption.authorizationType,
      authorizationScopes: taskAuthorizerOption.authorizationScopes,
    });

    const apiTaskWithEmailAndId = apiTaskResource.addResource("{email}").addResource("{id}");

    //PUT /tasks/{email}/{id}
    const taskPutValidator = new apiGateway.RequestValidator(this, "TaskPutValidator", {
      restApi: api,
      requestValidatorName: "Task Put Validator",
      validateRequestBody: true,
    });

    const taskPutModel = new apiGateway.Model(this, "TaskPutModel", {
      modelName: "TaskPutModel",
      restApi: api,
      schema: {
        type: apiGateway.JsonSchemaType.OBJECT,
        properties: {
          newStatus: {
            type: apiGateway.JsonSchemaType.STRING,
            enum: ["PENDING", "ABANDONED", "COMPLETED"],
          },
        },
        required: ["newStatus"],
      },
    });

    apiTaskWithEmailAndId.addMethod("PUT", todoTaskAppIntegration, {
      requestValidator: taskPutValidator,
      requestModels: {
        "application/json": taskPutModel,
      },
      authorizer: taskAuthorizerOption.authorizer,
      authorizationType: taskAuthorizerOption.authorizationType,
      authorizationScopes: taskAuthorizerOption.authorizationScopes,
    });

    //DELETE /tasks/{email}/{id}
    apiTaskWithEmailAndId.addMethod("DELETE", todoTaskAppIntegration, taskAuthorizerOption);

    //GET /tasks/upload-file-url
    const lambdaUrlUploadFileIntegration = new apiGateway.LambdaIntegration(
      props.s3UploadUrlFunction
    );

    apiTaskResource
      .addResource("upload-file-url")
      .addMethod("GET", lambdaUrlUploadFileIntegration, {
        authorizer: this.adminTaskAuthorizer,
        authorizationType: apiGateway.AuthorizationType.COGNITO,
        authorizationScopes: ["admin/web"],
      });
  }

  private createCognitoAuth() {
    //UserPool
    this.userBasicPool = new cognito.UserPool(this, "UserBasicPool", {
      userPoolName: "UserBasicPool",
      removalPolicy: cdk.RemovalPolicy.DESTROY,
      selfSignUpEnabled: true,
      signInAliases: {
        email: true,
        username: false,
      },
      autoVerify: {
        email: true,
        phone: false,
      },
      userVerification: {
        emailSubject: "Verify your email for our awesome app!",
        emailBody: "Your verification code is {####}",
        emailStyle: cognito.VerificationEmailStyle.CODE,
      },
      standardAttributes: {
        email: {
          required: true,
          mutable: false,
        },
        fullname: {
          required: true,
          mutable: true,
        },
      },
      passwordPolicy: {
        minLength: 8,
        requireLowercase: true,
        requireSymbols: false,
        requireDigits: true,
        requireUppercase: true,
        tempPasswordValidity: cdk.Duration.days(3),
      },
      accountRecovery: cognito.AccountRecovery.EMAIL_ONLY,
    });

    this.userBasicPool.addDomain("UserBasicDomain", {
      cognitoDomain: {
        domainPrefix: "aj-user-service",
      },
    });

    const userBasicWebScope = new cognito.ResourceServerScope({
      scopeName: "web",
      scopeDescription: "Access to user web resource",
    });

    const userBasicMobileScope = new cognito.ResourceServerScope({
      scopeName: "mobile",
      scopeDescription: "Access to user mobile resources",
    });

    const userBasicResourceServer = this.userBasicPool.addResourceServer(
      "UserBasicResourceServer",
      {
        identifier: "user-basic",
        userPoolResourceServerName: "UserBasicResourceServer",
        scopes: [userBasicWebScope, userBasicMobileScope],
      }
    );

    this.userBasicPool.addClient("user-basic-web-client", {
      userPoolClientName: "userBasicWebClient",
      authFlows: {
        userPassword: true,
      },
      accessTokenValidity: cdk.Duration.minutes(120),
      refreshTokenValidity: cdk.Duration.days(7),
      oAuth: {
        scopes: [cognito.OAuthScope.resourceServer(userBasicResourceServer, userBasicWebScope)],
      },
    });

    this.userBasicPool.addClient("user-basic-mobile-client", {
      userPoolClientName: "userBasicMobileClient",
      authFlows: {
        userPassword: true,
      },
      accessTokenValidity: cdk.Duration.minutes(120),
      refreshTokenValidity: cdk.Duration.days(7),
      oAuth: {
        scopes: [cognito.OAuthScope.resourceServer(userBasicResourceServer, userBasicMobileScope)],
      },
    });

    //AdminPool
    this.adminPool = new cognito.UserPool(this, "AdminPool", {
      userPoolName: "AdminPool",
      removalPolicy: cdk.RemovalPolicy.DESTROY,
      selfSignUpEnabled: false,
      signInAliases: {
        email: true,
        username: false,
      },
      autoVerify: {
        email: true,
        phone: false,
      },
      userVerification: {
        emailSubject: "Verify your email for our awesome app!",
        emailBody: "Your verification code is {####}",
        emailStyle: cognito.VerificationEmailStyle.CODE,
      },
      standardAttributes: {
        email: {
          required: true,
          mutable: false,
        },
        fullname: {
          required: true,
          mutable: true,
        },
      },
      passwordPolicy: {
        minLength: 8,
        requireLowercase: true,
        requireSymbols: false,
        requireDigits: true,
        requireUppercase: true,
        tempPasswordValidity: cdk.Duration.days(3),
      },
      accountRecovery: cognito.AccountRecovery.EMAIL_ONLY,
    });

    this.adminPool.addDomain("AdminDomain", {
      cognitoDomain: {
        domainPrefix: "aj-admin-domain",
      },
    });

    const adminWebScope = new cognito.ResourceServerScope({
      scopeName: "web",
      scopeDescription: "Access to admin web resources",
    });

    const adminResourceServer = this.adminPool.addResourceServer("AdminResourceServer", {
      identifier: "admin",
      userPoolResourceServerName: "AdminResourceServer",
      scopes: [adminWebScope],
    });

    this.adminPool.addClient("admin-web-client", {
      userPoolClientName: "adminWebClient",
      authFlows: {
        userPassword: true,
      },
      accessTokenValidity: cdk.Duration.minutes(120),
      refreshTokenValidity: cdk.Duration.days(7),
      oAuth: {
        scopes: [cognito.OAuthScope.resourceServer(adminResourceServer, adminWebScope)],
      },
    });

    //Authorizer
    this.taskAuthorizer = new apiGateway.CognitoUserPoolsAuthorizer(this, "TaskAuthorizer", {
      authorizerName: "TaskAuthorizer",
      cognitoUserPools: [this.userBasicPool, this.adminPool],
    });

    this.adminTaskAuthorizer = new apiGateway.CognitoUserPoolsAuthorizer(
      this,
      "AdminTaskAuthorizer",
      {
        authorizerName: "AdminTaskAuthorizer",
        cognitoUserPools: [this.adminPool],
      }
    );
  }
}
