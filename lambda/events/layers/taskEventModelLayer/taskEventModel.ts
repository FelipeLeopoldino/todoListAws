import { DocumentClient } from "aws-sdk/clients/dynamodb";

/**
 * Interface que define o modelo de evento.
 *
 * Propriedades:
 * - pk: Chave primária do evento.
 * - sk: Chave secundária do evento.
 * - eventType: Tipo do evento.
 * - actionType: Tipo de ação realizada.
 * - createdAt: Timestamp indicando quando o evento foi criado.
 * - taskId: Identificador da tarefa associada ao evento.
 * - ttl: Tempo de vida (Time To Live) do evento.
 * - owner: Objeto contendo informações do proprietário do evento.
 *   - ownerName: Nome do proprietário.
 *   - email: Email do proprietário.
 * - createdBy: Objeto contendo informações de quem criou o evento.
 *   - createdName: Nome de quem criou o evento.
 *   - email: Email de quem criou o evento.
 */
export interface EventModel {
  pk: string;
  sk: string;
  eventType: string;
  actionType: string;
  createdAt: number;
  taskId: string;
  ttl: number;
  owner: {
    ownerName: string;
    email: string;
  };
  createdBy: {
    createdName: string;
    email: string;
  };
}

/**
 * Repositório para gerenciar operações de eventos no DynamoDB.
 */
export class EventRepository {
  private ddbClient: DocumentClient;
  private eventDdb: string;

  /**
   * Construtor do repositório de eventos.
   *
   * @param ddbClient - Instância do DocumentClient do AWS SDK para interagir com o DynamoDB.
   * @param eventDdb - Nome da tabela do DynamoDB onde os eventos serão armazenados.
   */
  constructor(ddbClient: DocumentClient, eventDdb: string) {
    this.ddbClient = ddbClient;
    this.eventDdb = eventDdb;
  }

  /**
   * Cria um novo evento no DynamoDB.
   *
   * @param eventModel - Objeto que segue a interface EventModel contendo os dados do evento.
   * @returns Uma Promise que resolve para o modelo de evento fornecido.
   */
  async createEvent(eventModel: EventModel): Promise<EventModel> {
    await this.ddbClient
      .put({
        TableName: this.eventDdb,
        Item: eventModel,
      })
      .promise();
    return eventModel;
  }
}
