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
  private TasksDdb: string;

  constructor(ddbClient: DocumentClient, TasksDdb: string) {
    this.ddbClient = ddbClient;
    this.TasksDdb = TasksDdb;
  }

  async getAllTasks() {
    const data = await this.ddbClient
      .scan({
        TableName: this.TasksDdb,
      })
      .promise();

    return data.Items as TodoTaskModelDb[];
  }

  async getTasksByEmail(email: string) {
    const data = await this.ddbClient
      .scan({
        TableName: this.TasksDdb,
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
        TableName: this.TasksDdb,
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
        TableName: this.TasksDdb,
        Item: taskModel,
      })
      .promise();
    return taskModel;
  }

  async updateTask(email: string, pk: string, taskStatus: TaskStatusEnum) {
    const data = await this.ddbClient
      .update({
        TableName: this.TasksDdb,
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
        TableName: this.TasksDdb,
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

  async createBatchTask(taskModel: TodoTaskModelDb[]): Promise<TodoTaskModelDb[]> {
    const putRequest = taskModel.map((task) => {
      return {
        PutRequest: {
          Item: task,
        },
      };
    });

    const params = {
      RequestItems: {
        [this.TasksDdb]: putRequest,
      },
    };

    await this.ddbClient.batchWrite(params).promise();
    return taskModel;
  }
}
