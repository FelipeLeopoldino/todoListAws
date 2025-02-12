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

// Leitura das variáveis de ambiente necessárias
const tasksDdb = process.env.TASK_DDB!;
const snsTopicArn = process.env.SNS_TOPIC_ARN!;

// Inicialização dos clientes S3, SNS e DynamoDB Document Client
const s3Client = new S3();
const snsClient = new SNS();
const documentClient = new DocumentClient();

// Instancia o repositório para as tarefas
const todoTaskRepoitory = new TodoTaksRepository(documentClient, tasksDdb);

/**
 * Função handler principal do Lambda.
 * 
 * Esta função é disparada por eventos do S3 e realiza as seguintes operações:
 *   - Itera sobre cada registro do evento.
 *   - Importa em lote as tarefas utilizando o arquivo obtido do S3.
 *   - Agrega e consolida os eventos das tarefas importadas.
 *   - Publica os eventos consolidados no SNS.
 *
 * @param event Evento do S3 contendo os registros.
 * @param context Contexto do Lambda.
 */
export async function handler(event: S3Event, context: Context): Promise<void> {
  console.log(`RequestId: ${context.awsRequestId}`);
  console.log(`Event: ${JSON.stringify(event)}`);

  // Armazena as promessas de importação de tarefas de cada registro
  const promises: Promise<TodoTaskModelDb[]>[] = [];

  // Processa cada registro de evento do S3
  event.Records.forEach((record) => {
    promises.push(importBatchTasks(record));
  });

  // Aguarda a conclusão de todas as promessas de importação
  const promisesResolved = await Promise.all(promises);

  // Array para armazenar os eventos de tarefas
  const events: TodoTaskEventDto[] = [];

  // Converte as tarefas importadas em eventos
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

  // Consolida eventos para agrupar tarefas por proprietário
  const consolidatedEvents: TodoTaskEventDto[] = [];

  events.map((record) => {
    // Filtra todas tarefas do mesmo proprietário
    const tasks = events.filter((e) => e.owner.email === record.owner.email);
    // Checa se já existe um evento consolidado para o dono
    if (!consolidatedEvents.find((c) => c.taskId.includes(tasks[0].taskId))) {
      consolidatedEvents.push({
        ...record,
        // Junta os títulos e os ids das tarefas em uma string separada por vírgula
        title: tasks.map((t) => t.title).join(", "),
        taskId: tasks.map((t) => t.taskId).join(", "),
      });
    }
  });

  // Array para armazenar as promessas de publicação no SNS
  const snsPromises: Promise<any>[] = [];

  // Publica cada evento consolidado no SNS
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
        context.awsRequestId, // Aqui estamos reutilizando o awsRequestId para requestLambdaId
        context.functionName
      )
    );
  });

  // Aguarda a publicação de todos os eventos no SNS
  await Promise.all(snsPromises);
}

/**
 * Função para importar tarefas em lote a partir de um registro do evento S3.
 * 
 * Esta função realiza as seguintes etapas:
 *   - Obtém o conteúdo do objeto no S3.
 *   - Processa o conteúdo dividindo por linha para extrair os dados das tarefas.
 *   - Para cada linha, cria um objeto de tarefa com os dados extraídos e um ID único.
 *   - Limita o número de tarefas a gravar simultaneamente no DynamoDB.
 *   - Chama o método de criação em lote no repositório de tarefas.
 *
 * @param record Registro individual do evento S3.
 * @returns Uma promessa que resolve um array de tarefas importadas (TodoTaskModelDb[]).
 */
async function importBatchTasks(record: S3EventRecord): Promise<TodoTaskModelDb[]> {
  // Limite máximo para escrita em lote no DynamoDB
  const BATCH_WRITE_LIMIT_DYNAMODB = 25;

  // Obtém o objeto do S3 usando o bucket e a key informados no registro
  const object = await s3Client
    .getObject({
      Bucket: record.s3.bucket.name,
      Key: record.s3.object.key,
    })
    .promise();

  // Converte o corpo do objeto para string
  const objectData = object.Body?.toString("utf-8");

  if (!objectData) {
    throw new Error("No data found");
  }

  const tasks: TodoTaskModelDb[] = [];

  try {
    // Processa cada linha do arquivo
    objectData.split("\n").forEach((line) => {
      const cleanedLine = line.replace(/\r/g, "");
      // Divide a linha pelas vírgulas para extrair os campos
      const [title, description, ownerName, ownerEmail, assignedByName, assignedByEmail] =
        cleanedLine.split(",");

      // Gera um ID único para a tarefa e registra o timestamp atual
      const pk = generatUniqueId();
      const timestamp = Date.now();

      // Cria o objeto de tarefa com os dados extraídos
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

    // Verifica se o número de tarefas excede o limite permitido
    if (tasks.length > BATCH_WRITE_LIMIT_DYNAMODB) {
      throw new Error("Batch limit exceeded");
    }
    // Insere as tarefas em lote no DynamoDB
    await todoTaskRepoitory.createBatchTask(tasks);
    console.log(`${tasks.length} tasks imported`);

    return tasks;
  } catch (error) {
    console.error(error);
    throw new Error("Error importing batch tasks");
  }
}

/**
 * Função para gerar um ID único para cada tarefa.
 * 
 * O ID é composto pelo prefixo "TID-", seguido do timestamp atual e um número aleatório.
 * 
 * @returns Uma string representando o ID único da tarefa.
 */
function generatUniqueId() {
  return `TID-${Date.now()}-${Math.floor(Math.random() * 10000)}`;
}

/**
 * Função para publicar uma mensagem no SNS.
 * 
 * Essa função cria uma mensagem que encapsula os detalhes do evento de tarefa e
 * a publica no tópico SNS configurado.
 *
 * @param actionType Tipo da ação (ex: INSERT).
 * @param eventType Tipo do evento (ex: BATCH_TASK).
 * @param creatorName Nome do criador da tarefa.
 * @param creatorEmail Email do criador da tarefa.
 * @param taskId ID da tarefa (ou tarefas consolidadas).
 * @param ownerName Nome do proprietário da tarefa.
 * @param ownerEmail Email do proprietário da tarefa.
 * @param title Título da tarefa (ou títulos concatenados).
 * @param requestId ID da solicitação.
 * @param requestLambdaId ID da solicitação Lambda.
 * @param functionName Nome da função Lambda.
 * @returns Uma promessa com o resultado da publicação no SNS.
 */
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
  // Cria o DTO do evento de tarefa
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

  // Cria o envelope SNS contendo os detalhes da requisição e do evento
  const SnsEvelope: SnsEvelope = {
    requestId: requestId,
    requestLambdaId: requestLambdaId,
    origin: functionName,
    date: Date.now(),
    content: JSON.stringify(todoTaskEventDto),
  };

  // Publica a mensagem formatada no tópico SNS
  return snsClient
    .publish({
      TopicArn: snsTopicArn,
      Message: JSON.stringify(SnsEvelope),
    })
    .promise();
}