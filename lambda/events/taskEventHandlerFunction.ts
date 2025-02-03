import { SNSEvent, Context } from "aws-lambda";
import { EventRepository, EventModel } from "./layers/taskEventModelLayer/taskEventModel";
import { DocumentClient } from "aws-sdk/clients/dynamodb";
import { SnsEvelope, TodoTaskEventDto } from "./layers/taskEventLayer/taskEvent";

const ddbClient = new DocumentClient();
const eventDdb = process.env.EVENT_DDB!;
const eventRepository = new EventRepository(ddbClient, eventDdb);

export async function handler(event: SNSEvent, context: Context): Promise<void> {
  console.log(`LambdaRequestId: ${context.awsRequestId}`);
  console.log(`Event: ${JSON.stringify(event)}`);

  const promises: Promise<void>[] = [];

  event.Records.forEach((record) => {
    const envelope = JSON.parse(record.Sns.Message) as SnsEvelope;
    promises.push(createEvent(envelope));
  });

  await Promise.all(promises);
}

async function createEvent(envelope: SnsEvelope): Promise<void> {
  const content = JSON.parse(envelope.content) as TodoTaskEventDto;
  const timestamp = Date.now();
  const ttl = timestamp + 60 * 5;

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

  await eventRepository.createEvent(eventModel);
}
