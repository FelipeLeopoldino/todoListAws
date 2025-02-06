import { Context, SNSMessage, SQSEvent } from "aws-lambda";
import { SnsEvelope, TodoTaskEventDto } from "../events/layers/taskEventLayer/taskEvent";
import { AWSError, SES } from "aws-sdk";
import { PromiseResult } from "aws-sdk/lib/request";

const sesClient = new SES();

export interface MailBody {
  snsMessageId: string;
  subject: string;
  tasks: string;
  to: string;
  createdBy: string;
  message: string;
}

export async function handler(event: SQSEvent, context: Context): Promise<void> {
  console.log(`RequestId: ${context.awsRequestId}`);
  console.log(`SQSEvent: ${JSON.stringify(event)}`);

  const mailBody: MailBody[] = [];

  event.Records.forEach((record) => {
    const body = JSON.parse(record.body) as SNSMessage;
    const envelope = JSON.parse(body.Message) as SnsEvelope;
    const content = JSON.parse(envelope.content) as TodoTaskEventDto;

    mailBody.push({
      snsMessageId: record.messageId,
      subject: `${content.eventType} - ${content.actionType}`,
      tasks: content.taskId,
      to: content.owner.email,
      createdBy: content.createdBy.email,
      message: `
            Operação: ${content.actionType}
            Suas tasks: ${content.taskId} - ${content.title}
            Criado por: ${content.createdBy.email}
            `,
    });
  });

  const promises: Promise<PromiseResult<SES.SendEmailResponse, AWSError>>[] = [];

  mailBody.forEach((email) => {
    promises.push(sendEmail(email));
  });

  await Promise.all(promises);
  return;
}

export async function sendEmail(data: MailBody) {
  return sesClient
    .sendEmail({
      Destination: {
        ToAddresses: [data.to],
      },
      Message: {
        Subject: {
          Charset: "UTF-8",
          Data: `Movimentação de Tasks ${data.subject}`,
        },
        Body: {
          Text: {
            Charset: "UTF-8",
            Data: data.message,
          },
        },
      },
      Source: "felipe_pim_89@hotmail.com",
      ReplyToAddresses: ["felipe_pim_89@hotmail.com"],
    })
    .promise();
}
