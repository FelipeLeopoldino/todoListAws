/**
 * Módulo responsável por processar eventos do SQS contendo mensagens do SNS e enviar emails via SES.
 *
 * O fluxo do processamento envolve:
 * 1. Receber um evento do SQS contendo registros.
 * 2. Para cada registro, extrair e decodificar a mensagem JSON aninhada (de SNS e conteúdo do envelope).
 * 3. Preparar os dados de email (destinatário, assunto, mensagem, etc) com base no conteúdo do evento.
 * 4. Enviar os emails utilizando o AWS SES.
 */

import { Context, SNSMessage, SQSEvent } from "aws-lambda";
import { SnsEvelope, TodoTaskEventDto } from "../events/layers/taskEventLayer/taskEvent";
import { AWSError, SES } from "aws-sdk";
import { PromiseResult } from "aws-sdk/lib/request";

// Instância do cliente SES para envio de emails.
const sesClient = new SES();

/**
 * Interface que define a estrutura do corpo do email.
 */
export interface MailBody {
  snsMessageId: string; // Identificador da mensagem SNS.
  subject: string; // Assunto do email.
  tasks: string; // Identificador da task ou tarefas associadas.
  to: string; // Endereço de email do destinatário.
  createdBy: string; // Email do criador da operação.
  message: string; // Corpo da mensagem do email.
}

/**
 * Função handler principal para processar eventos do SQS.
 *
 * Para cada registro no evento:
 *  1. Faz o parse do corpo da mensagem para obter os dados do SNS.
 *  2. Extraí o envelope e o conteúdo da mensagem.
 *  3. Monta o objeto MailBody com os detalhes necessários para o envio do email.
 *  4. Envia os emails em paralelo utilizando AWS SES.
 *
 * @param event - Evento do SQS que contém uma lista de registros.
 * @param context - Contexto de execução da função Lambda.
 * @returns Uma Promise que se resolve quando todos os emails foram enviados.
 */
export async function handler(event: SQSEvent, context: Context): Promise<void> {
  console.log(`RequestId: ${context.awsRequestId}`);
  console.log(`SQSEvent: ${JSON.stringify(event)}`);

  const mailBody: MailBody[] = [];

  // Processa cada registro recebido do evento SQS.
  event.Records.forEach((record) => {
    // Faz o parse do corpo da mensagem e extrai os dados aninhados.
    const body = JSON.parse(record.body) as SNSMessage;
    const envelope = JSON.parse(body.Message) as SnsEvelope;
    const content = JSON.parse(envelope.content) as TodoTaskEventDto;

    // Prepara os dados para envio do email.
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

  // Cria promessas para envio de cada email.
  const promises: Promise<PromiseResult<SES.SendEmailResponse, AWSError>>[] = [];
  mailBody.forEach((email) => {
    promises.push(sendEmail(email));
  });

  // Aguarda que todos os emails sejam enviados antes de retornar.
  await Promise.all(promises);
  return;
}

/**
 * Envia um email utilizando o AWS SES com os dados fornecidos.
 *
 * @param data - Objeto MailBody contendo as informações do email.
 * @returns Uma Promise contendo a resposta do SES ao enviar o email.
 */
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
