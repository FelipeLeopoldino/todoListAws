import * as cdk from "aws-cdk-lib";
import { Construct } from "constructs";
import * as apiGateway from "aws-cdk-lib/aws-apigateway";
import * as cwlogs from "aws-cdk-lib/aws-logs";
import * as lambdaNodejs from "aws-cdk-lib/aws-lambda-nodejs";

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
    apiTaskResource.addMethod("POST", todoTaskAppIntegration);

    //PUT /tasks/{email}/{id}
    apiTaskWithEmailAndId.addMethod("PUT", todoTaskAppIntegration);

    //DELETE /tasks/{email}/{id}
    apiTaskWithEmailAndId.addMethod("DELETE", todoTaskAppIntegration);
  }
}
