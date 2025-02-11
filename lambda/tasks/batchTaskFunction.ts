import { Context, S3Event, S3EventRecord } from "aws-lambda";
import {
  TaskStatusEnum,
  TodoTaskModelDb,
  TodoTaksRepository,
} from "./layers/todoTaskLayer/todoTaskLayerRepository";
import {
  ActionTypeEnum,
  EventTypeEnum,
  SnsEvelope,
  TodoTaskEventDto,
} from "../events/layers/taskEventLayer/taskEvent";
import { S3 } from "aws-sdk";
import { SNS } from "aws-sdk";
import { DocumentClient } from "aws-sdk/clients/dynamodb";

const tasksDdb = process.env.TASK_DDB!;
const snsTopicArn = process.env.SNS_TOPIC_ARN!;
const s3Client = new S3();
const snsClient = new SNS();
const documentClient = new DocumentClient();
const todoTaskRepoitory = new TodoTaksRepository(documentClient, tasksDdb);

export async function handler(event: S3Event, context: Context): Promise<void> {
  console.log(`RequestId: ${context.awsRequestId}`);
  console.log(`Event: ${JSON.stringify(event)}`);

  const promises: Promise<TodoTaskModelDb[]>[] = [];

  event.Records.forEach((record) => {
    promises.push(importBatchTasks(record));
  });

  const promisesResolved = await Promise.all(promises);

  const events: TodoTaskEventDto[] = [];

  promisesResolved.forEach((promise) => {
    promise.forEach((task) => {
      events.push({
        actionType: ActionTypeEnum.INSERT,
        eventType: EventTypeEnum.BATCH_TASK,
        taskId: task.pk,
        title: task.title,
        createdBy: {
          createdName: task.assingedBy.assignedByName,
          email: task.assingedBy.email,
        },
        owner: task.owner,
      });
    });
  });

  const consolidatedEvents: TodoTaskEventDto[] = [];

  events.map((record) => {
    const tasks = events.filter((e) => e.owner.email === record.owner.email);
    if (!consolidatedEvents.find((c) => c.taskId.includes(tasks[0].taskId))) {
      consolidatedEvents.push({
        ...record,
        title: tasks.map((t) => t.title).join(", "),
        taskId: tasks.map((t) => t.taskId).join(", "),
      });
    }
  });

  const snsPromises: Promise<any>[] = [];

  consolidatedEvents.forEach((event) => {
    snsPromises.push(
      publishToSns(
        event.actionType,
        event.eventType,
        event.createdBy.createdName,
        event.createdBy.email,
        event.taskId,
        event.owner.ownerName,
        event.owner.email,
        event.title,
        context.awsRequestId,
        context.awsRequestId,
        context.functionName
      )
    );
  });

  await Promise.all(snsPromises);
}

async function importBatchTasks(record: S3EventRecord): Promise<TodoTaskModelDb[]> {
  const BATCH_WRITE_LIMIT_DYNAMODB = 25;

  const object = await s3Client
    .getObject({
      Bucket: record.s3.bucket.name,
      Key: record.s3.object.key,
    })
    .promise();

  const objectData = object.Body?.toString("utf-8");

  if (!objectData) {
    throw new Error("No data found");
  }

  const tasks: TodoTaskModelDb[] = [];

  try {
    objectData
      .split("\n")
      .slice(1)
      .forEach((line) => {
        const cleanedLine = line.replace(/\r/g, "");
        const [title, description, ownerName, ownerEmail, assignedByName, assignedByEmail] =
          cleanedLine.split(",");

        const pk = generatUniqueId();
        const timestamp = Date.now();

        const task: TodoTaskModelDb = {
          pk: pk,
          sk: ownerEmail,
          createdAt: timestamp,
          description: description,
          title: title,
          email: ownerEmail,
          taskStatus: TaskStatusEnum.PENDING,
          archived: false,
          assingedBy: {
            assignedByName: assignedByName,
            email: assignedByEmail,
          },
          owner: {
            ownerName: ownerName,
            email: ownerEmail,
          },
        };

        console.log(`import task inProgress ${JSON.stringify(task)}`);
        tasks.push(task);
      });

    if (tasks.length > BATCH_WRITE_LIMIT_DYNAMODB) {
      throw new Error("Batch limit exceeded");
    }
    await todoTaskRepoitory.createBatchTask(tasks);
    console.log(`${tasks.length} tasks imported`);

    return tasks;
  } catch (error) {
    console.error(error);
    throw new Error("Error importing batch tasks");
  }
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
