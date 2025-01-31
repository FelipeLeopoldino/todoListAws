import { DocumentClient } from "aws-sdk/clients/dynamodb";

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

export class EventRepository {
  private ddbClient: DocumentClient;
  private eventDdb: string;

  constructor(ddbClient: DocumentClient, eventDdb: string) {
    this.ddbClient = ddbClient;
    this.eventDdb = eventDdb;
  }

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
