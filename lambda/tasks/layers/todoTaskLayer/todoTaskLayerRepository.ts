import { DocumentClient } from "aws-sdk/clients/dynamodb";

export enum TaskStatusEnum {
  PENDING = "PENDING",
  COMPLETED = "COMPLETED",
  ABANDONED = "ABANDONED",
}

export interface TodoTaskModelDb {
  pk: string;
  sk: string;
  email: string;
  createdAt: number;
  title: string;
  description: string;
  archived?: boolean;
  taskStatus: TaskStatusEnum;
  owner: {
    ownerName: string;
    email: string;
  };
  assingedBy: {
    assignedByName: string;
    email: string;
  };
}

export class TodoTaksRepository {
  private ddbClient: DocumentClient;
  private taskDdb: string;

  constructor(ddbClient: DocumentClient, taskDdb: string) {
    this.ddbClient = ddbClient;
    this.taskDdb = taskDdb;
  }

  async getAllTasks() {
    const data = await this.ddbClient
      .scan({
        TableName: this.taskDdb,
      })
      .promise();

    return data.Items as TodoTaskModelDb[];
  }

  async getTasksByEmail(email: string) {
    const data = await this.ddbClient
      .scan({
        TableName: this.taskDdb,
        FilterExpression: "email = :email",
        ExpressionAttributeValues: {
          ":email": email,
        },
      })
      .promise();

    return data.Items as TodoTaskModelDb[];
  }

  async getTaskByPkAndEmail(email: string, pk: string) {
    const data = await this.ddbClient
      .get({
        TableName: this.taskDdb,
        Key: {
          pk: pk,
          email: email,
        },
      })
      .promise();

    if (data.Item) return data.Item as TodoTaskModelDb;
    throw new Error("Task not found");
  }

  async createTask(taskModel: TodoTaskModelDb): Promise<TodoTaskModelDb> {
    await this.ddbClient
      .put({
        TableName: this.taskDdb,
        Item: taskModel,
      })
      .promise();
    return taskModel;
  }

  async updateTask(email: string, pk: string, taskStatus: TaskStatusEnum) {
    const data = await this.ddbClient
      .update({
        TableName: this.taskDdb,
        Key: {
          pk: pk,
          sk: email,
        },
        ConditionExpression: "attribute_exists(pk)",
        UpdateExpression: "SET taskStatus = :taskStatus, archived = :archived",
        ExpressionAttributeValues: {
          ":taskStatus": taskStatus,
          ":archived": true,
        },
        ReturnValues: "ALL_NEW",
      })
      .promise();

    if (data.Attributes) return data.Attributes as TodoTaskModelDb;
    throw new Error("Task not found");
  }

  async deleteTask(email: string, pk: string) {
    const data = await this.ddbClient
      .delete({
        TableName: this.taskDdb,
        Key: {
          pk: pk,
          sk: email,
        },
        ReturnValues: "ALL_OLD",
      })
      .promise();

    if (data.Attributes) return data.Attributes as TodoTaskModelDb;
    throw new Error("Task not found");
  }
}
