import { SNSEvent, Context } from "aws-lambda";
import { EventRepository, EventModel } from "./layers/taskEventModelLayer/taskEventModel";
import { DocumentClient } from "aws-sdk/clients/dynamodb";
import { SnsEvelope, TodoTaskEventDto } from "./layers/taskEventLayer/taskEvent";

// Cria uma instância do cliente do DynamoDB
const ddbClient = new DocumentClient();

// Nome da tabela de eventos obtido das variáveis de ambiente
const eventDdb = process.env.EVENT_DDB!;

// Cria uma instância do repositório de eventos para interagir com o DynamoDB
const eventRepository = new EventRepository(ddbClient, eventDdb);

/**
 * Função handler para eventos SNS.
 *
 * Esta função é o ponto de entrada do Lambda. Ela processa cada registro recebido de um evento SNS,
 * converte a mensagem para um envelope e cria o evento correspondente no DynamoDB.
 *
 * @param event - Evento recebido do SNS contendo registros.
 * @param context - Contexto da execução do Lambda.
 * @returns Promise<void>
 */
export async function handler(event: SNSEvent, context: Context): Promise<void> {
  console.log(`LambdaRequestId: ${context.awsRequestId}`);
  console.log(`Event: ${JSON.stringify(event)}`);

  // Array de promessas para processar cada registro de forma assíncrona.
  const promises: Promise<void>[] = [];

  // Para cada registro do SNS, processa separadamente
  event.Records.forEach((record) => {
    // Converte a mensagem JSON do SNS para um objeto SnsEvelope
    const envelope = JSON.parse(record.Sns.Message) as SnsEvelope;
    // Adiciona a promise de criação do evento.
    promises.push(createEvent(envelope));
  });

  // Aguarda o processamento de todas as promessas.
  await Promise.all(promises);
}

/**
 * Cria um evento no DynamoDB com base no envelope recebido.
 *
 * Esta função extrai o conteúdo JSON do envelope, converte para o objeto TodoTaskEventDto,
 * e monta um objeto do tipo EventModel contendo informações adicionais como timestamp e TTL.
 *
 * @param envelope - Objeto que contém os dados do evento em formato string JSON.
 * @returns Promise<void>
 */
async function createEvent(envelope: SnsEvelope): Promise<void> {
  // Converte o conteúdo do envelope para um objeto TodoTaskEventDto
  const content = JSON.parse(envelope.content) as TodoTaskEventDto;
  // Obtém o timestamp atual
  const timestamp = Date.now();
  // Calcula o tempo de expiração (TTL), adicionando 5 minutos ao timestamp atual
  const ttl = timestamp + 60 * 5;

  // Monta o objeto que representa o modelo de evento para ser salvo no DynamoDB.
  // Os atributos pk e sk são utilizados para organizar e identificar o item na tabela.
  const eventModel: EventModel = {
    pk: `#EVENT_${timestamp}`,
    sk: `#${timestamp}_${content.createdBy.email}`,
    actionType: content.actionType,
    eventType: content.eventType,
    owner: content.owner,
    createdAt: timestamp,
    createdBy: content.createdBy,
    taskId: content.taskId,
    ttl: ttl,
  };

  // Chama o repositório para salvar o evento no DynamoDB.
  await eventRepository.createEvent(eventModel);
}
