import * as cdk from "aws-cdk-lib";
import * as apiGateway from "aws-cdk-lib/aws-apigateway";
import * as cwlogs from "aws-cdk-lib/aws-logs";
import * as lambdaNodeJs from "aws-cdk-lib/aws-lambda-nodejs";
import { Construct } from "constructs";

export interface TodoListApiStackProps extends cdk.StackProps {
  lambdaTodoTaskApp: lambdaNodeJs.NodejsFunction;
  s3UploadUrlFunction: lambdaNodeJs.NodejsFunction;
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

    //GET /tasks
    //GET /tasks?email=email@gmail.com
    //GET /tasks?email=email@gmail.com&taskid=tid-123
    apiTaskResource.addMethod("GET", todoTaskAppIntegration);

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
    });

    //DELETE /tasks/{email}/{id}
    apiTaskWithEmailAndId.addMethod("DELETE", todoTaskAppIntegration);

    //GET /tasks/upload-file-url
    const lambdaUrlUploadFileIntegration = new apiGateway.LambdaIntegration(
      props.s3UploadUrlFunction
    );

    apiTaskResource.addResource("upload-file-url").addMethod("GET", lambdaUrlUploadFileIntegration);
  }
}
