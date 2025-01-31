import * as cdk from "aws-cdk-lib";
import { Construct } from "constructs";
import * as apiGateway from "aws-cdk-lib/aws-apigateway";
import * as cwlogs from "aws-cdk-lib/aws-logs";
import * as lambdaNodejs from "aws-cdk-lib/aws-lambda-nodejs";
import { title } from "process";
import { kMaxLength } from "buffer";

export interface TodoListApiStackProps extends cdk.StackProps {
  lambdaTodoTaskApp: lambdaNodejs.NodejsFunction;
}

export class TodoListApiStack extends cdk.Stack {
  constructor(scope: Construct, id: string, props: TodoListApiStackProps) {
    super(scope, id, props);

    const logGroup = new cwlogs.LogGroup(this, "TodoListApiLogs");
    const api = new apiGateway.RestApi(this, "TodoListApi", {
      restApiName: "TodoListApi",
      cloudWatchRole: true,
      deployOptions: {
        accessLogDestination: new apiGateway.LogGroupLogDestination(logGroup),
        accessLogFormat: apiGateway.AccessLogFormat.jsonWithStandardFields({
          caller: true,
          ip: true,
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
    const apiTaskWithEmailAndId = apiTaskResource.addResource("{email}").addResource("{id}");

    //GET /tasks
    //GET /tasks?email=email@gamil.com
    //GET /tasks?email=email@gamil.com&tasks=tid-123
    apiTaskResource.addMethod("GET", todoTaskAppIntegration);

    //POST /tasks
    const taskRequestValidator = new apiGateway.RequestValidator(this, "TaskRequestValidator", {
      restApi: api,
      requestValidatorName: "TaskRequestValidator",
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
            maxLength: 250,
            minLength: 5,
          },
          deadLine: {
            type: apiGateway.JsonSchemaType.STRING,
          },
          owner: {
            type: apiGateway.JsonSchemaType.OBJECT,
            properties: {
              email: {
                type: apiGateway.JsonSchemaType.STRING,
                maxLength: 100,
                minLength: 10,
                pattern: "^[a-z0-9._%+-]+@[a-z0-9.-]+.[a-z]{2,4}$",
              },
              name: {
                type: apiGateway.JsonSchemaType.STRING,
                maxLength: 50,
                minLength: 3,
              },
            },
            required: ["email", "name"],
          },
          assignedBy: {
            type: apiGateway.JsonSchemaType.OBJECT,
            properties: {
              email: {
                type: apiGateway.JsonSchemaType.STRING,
                maxLength: 100,
                minLength: 10,
                pattern: "^[a-z0-9._%+-]+@[a-z0-9.-]+.[a-z]{2,4}$",
              },
              name: {
                type: apiGateway.JsonSchemaType.STRING,
                maxLength: 50,
                minLength: 3,
              },
            },
            required: ["email", "name"],
          },
        },
        required: ["title", "owner", "assignedBy"],
      },
    });

    apiTaskResource.addMethod("POST", todoTaskAppIntegration, {
      requestValidator: taskRequestValidator,
      requestModels: {
        "application/json": taskModel,
      },
    });

    //PUT /tasks/{email}/{id}

    const taskPutValidator = new apiGateway.RequestValidator(this, "TaskPutValidator", {
      restApi: api,
      requestValidatorName: "TaskPutValidator",
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
    });

    //DELETE /tasks/{email}/{id}
    apiTaskWithEmailAndId.addMethod("DELETE", todoTaskAppIntegration);
  }
}
