import { APIGatewayProxyEvent, APIGatewayProxyResult, Context } from "aws-lambda";
import { DocumentClient } from "aws-sdk/clients/dynamodb";
import { SNS } from "aws-sdk";
import {
  TodoTaksRepository,
  TaskStatusEnum,
  TodoTaskModelDb,
} from "../../lambda/tasks/layers/todoTaskLayer/todoTaskLayerRepository";
import {
  TodoTaskPostRequest,
  TodoTaskPutRequest,
} from "./layers/todoTaskDtoLayer/todoTaskDtoLayer";
import {
  ActionTypeEnum,
  EventTypeEnum,
  SnsEvelope,
  TodoTaskEventDto,
} from "../events/layers/taskEventLayer/taskEvent";

const taskDdbTableName = process.env.TASK_DDB!;
const snsTopicArn = process.env.SNS_TOPIC_ARN!;
const ddbClient = new DocumentClient();
const taskRepository = new TodoTaksRepository(ddbClient, taskDdbTableName);
const snsClient = new SNS();

export async function handler(
  event: APIGatewayProxyEvent,
  context: Context
): Promise<APIGatewayProxyResult> {
  const apiRequestId = event.requestContext.resourceId;
  const lambda = context.awsRequestId;
  const httpMethod = event.httpMethod;

  console.log(`API RequestId: ${apiRequestId} - Lambda RequestId: ${lambda}`);
  console.log(JSON.stringify(event));

  if (httpMethod === "GET") {
    const emailParameter = event.queryStringParameters?.email;
    const taskIdParameter = event.queryStringParameters?.taskid;

    if (emailParameter) {
      if (taskIdParameter) {
        try {
          const result = await taskRepository.getTaskByPkAndEmail(emailParameter, taskIdParameter);
          if (result) {
            return {
              statusCode: 200,
              body: JSON.stringify(result),
            };
          }
        } catch (err) {
          console.log((<Error>err).message);
          return {
            statusCode: 404,
            body: (<Error>err).message,
          };
        }
      }

      const result = await taskRepository.getTasksByEmail(emailParameter);
      return {
        statusCode: 200,
        body: JSON.stringify(result),
      };
    }

    const result = await taskRepository.getAllTasks();
    return {
      statusCode: 200,
      body: JSON.stringify({
        result,
      }),
    };
  }

  if (httpMethod === "POST") {
    try {
      const taskRequest = JSON.parse(event.body!) as TodoTaskPostRequest;
      const taskModel = buildTask(taskRequest);
      const result = await taskRepository.createTask(taskModel);

      await publishToSns(
        ActionTypeEnum.INSERT,
        EventTypeEnum.SINGLE_TASK,
        result.assingedBy.assignedByName,
        result.assingedBy.email,
        result.pk,
        result.owner.ownerName,
        result.owner.email,
        result.title,
        apiRequestId,
        lambda,
        context.functionName
      );

      return {
        statusCode: 201,
        body: JSON.stringify(result),
      };
    } catch (err) {
      console.log((<Error>err).message);
      return {
        statusCode: 400,
        body: (<Error>err).message,
      };
    }
  }

  if (event.resource === "/tasks/{email}/{id}") {
    const emailPathParameter = event.pathParameters!.email as string;
    const idPathParameter = event.pathParameters!.id as string;

    if (httpMethod === "PUT") {
      const statusRequest = JSON.parse(event.body!) as TodoTaskPutRequest;

      try {
        const newStatus = statusRequest.newStatus as TaskStatusEnum;
        const result = await taskRepository.updateTask(
          emailPathParameter,
          idPathParameter,
          newStatus
        );

        await publishToSns(
          ActionTypeEnum.UPDATE,
          EventTypeEnum.SINGLE_TASK,
          result.assingedBy.assignedByName,
          result.assingedBy.email,
          result.pk,
          result.owner.ownerName,
          result.owner.email,
          result.title,
          apiRequestId,
          lambda,
          context.functionName
        );

        return {
          statusCode: 204,
          body: JSON.stringify({
            message: `Updated task sucessful. Task ID ${idPathParameter}`,
            body: JSON.stringify(result),
          }),
        };
      } catch (err) {
        console.log((<Error>err).message);
        return {
          statusCode: 400,
          body: (<Error>err).message,
        };
      }
    }

    if (httpMethod === "DELETE") {
      try {
        const result = await taskRepository.deleteTask(emailPathParameter, idPathParameter);

        await publishToSns(
          ActionTypeEnum.DELETE,
          EventTypeEnum.SINGLE_TASK,
          result.assingedBy.assignedByName,
          result.assingedBy.email,
          result.pk,
          result.owner.ownerName,
          result.owner.email,
          result.title,
          apiRequestId,
          lambda,
          context.functionName
        );

        return {
          statusCode: 204,
          body: JSON.stringify(result),
        };
      } catch (err) {
        console.log((<Error>err).message);
        return {
          statusCode: 400,
          body: (<Error>err).message,
        };
      }
    }
  }

  return {
    statusCode: 200,
    body: JSON.stringify({
      message: "Hello from Lambda!",
    }),
  };
}

function buildTask(task: TodoTaskPostRequest): TodoTaskModelDb {
  const timestamp = Date.now();
  const pk = generatUniqueId();

  return {
    pk: pk,
    sk: task.owner.email,
    createdAt: timestamp,
    title: task.title,
    email: task.owner.email,
    description: task.description,
    taskStatus: TaskStatusEnum.PENDING,
    archived: false,
    assingedBy: {
      assignedByName: task.assignedBy.name,
      email: task.assignedBy.email,
    },
    owner: {
      ownerName: task.owner.name,
      email: task.owner.email,
    },
  };
}

function generatUniqueId() {
  return `TID-${Date.now()}-${Math.floor(Math.random() * 10000)}`;
}

async function publishToSns(
  actionType: ActionTypeEnum,
  eventType: EventTypeEnum,
  creatorName: string,
  creatorEmail: string,
  taskId: string,
  ownerName: string,
  ownerEmail: string,
  title: string,
  requestId: string,
  requestLambdaId: string,
  functionName: string
): Promise<any> {
  const todoTaskEventDto: TodoTaskEventDto = {
    actionType: actionType,
    eventType: eventType,
    createdBy: {
      createdName: creatorName,
      email: creatorEmail,
    },
    taskId: taskId,
    owner: {
      ownerName: ownerName,
      email: ownerEmail,
    },
    title: title,
  };

  const SnsEvelope: SnsEvelope = {
    requestId: requestId,
    requestLambdaId: requestLambdaId,
    origin: functionName,
    date: Date.now(),
    content: JSON.stringify(todoTaskEventDto),
  };

  return snsClient
    .publish({
      TopicArn: snsTopicArn,
      Message: JSON.stringify(SnsEvelope),
    })
    .promise();
}
