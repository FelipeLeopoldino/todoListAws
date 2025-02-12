import { DocumentClient } from "aws-sdk/clients/dynamodb";

/**
 * Enumeração dos status possíveis de uma tarefa.
 * PENDING: Tarefa pendente.
 * COMPLETED: Tarefa completada.
 * ABANDONED: Tarefa abandonada.
 */
export enum TaskStatusEnum {
  PENDING = "PENDING",
  COMPLETED = "COMPLETED",
  ABANDONED = "ABANDONED",
}

/**
 * Interface que define a estrutura de um modelo de tarefa no banco de dados.
 */
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

/**
 * Classe que representa o repositório para manipulação de tarefas.
 * Utiliza o DocumentClient da AWS para interagir com uma tabela do DynamoDB.
 */
export class TodoTaksRepository {
  private ddbClient: DocumentClient;
  private TasksDdb: string;

  /**
   * Construtor para inicializar o repositório.
   * @param ddbClient Cliente do DynamoDB para executar operações.
   * @param TasksDdb Nome da tabela no DynamoDB onde as tarefas estão armazenadas.
   */
  constructor(ddbClient: DocumentClient, TasksDdb: string) {
    this.ddbClient = ddbClient;
    this.TasksDdb = TasksDdb;
  }

  /**
   * Recupera todas as tarefas da tabela.
   * @returns Uma lista de tarefas.
   */
  async getAllTasks() {
    const data = await this.ddbClient
      .scan({
        TableName: this.TasksDdb,
      })
      .promise();

    return data.Items as TodoTaskModelDb[];
  }

  /**
   * Recupera todas as tarefas associadas a determinado email.
   * @param email Email do usuário associado às tarefas.
   * @returns Uma lista de tarefas filtradas pelo email.
   */
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

  /**
   * Recupera uma tarefa com base na chave primária (pk) e no email.
   * @param email Email do usuário associado à tarefa.
   * @param pk Chave primária da tarefa.
   * @returns A tarefa correspondente se encontrada.
   * @throws Erro se a tarefa não for encontrada.
   */
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

  /**
   * Cria uma nova tarefa na tabela.
   * @param taskModel Objeto que representa os dados da tarefa a ser criada.
   * @returns A tarefa criada.
   */
  async createTask(taskModel: TodoTaskModelDb): Promise<TodoTaskModelDb> {
    await this.ddbClient
      .put({
        TableName: this.TasksDdb,
        Item: taskModel,
      })
      .promise();
    return taskModel;
  }

  /**
   * Atualiza o status e o campo "archived" de uma tarefa existente.
   * @param email Email do usuário associado à tarefa.
   * @param pk Chave primária da tarefa.
   * @param taskStatus Novo status da tarefa.
   * @returns A tarefa atualizada.
   * @throws Erro se a tarefa não existir.
   */
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

  /**
   * Exclui uma tarefa da tabela.
   * @param email Email do usuário associado à tarefa.
   * @param pk Chave primária da tarefa.
   * @returns A tarefa excluída.
   * @throws Erro se a tarefa não for encontrada.
   */
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

  /**
   * Cria um lote de tarefas na tabela.
   * @param taskModel Array de objetos representando as tarefas a serem criadas.
   * @returns Array das tarefas criadas.
   */
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
