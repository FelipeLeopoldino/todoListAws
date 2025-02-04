import { Context, SQSEvent } from "aws-lambda";

export async function handler(event: SQSEvent, context: Context): Promise<void> {
  console.log(`ReqiestId: ${context.awsRequestId}`);
  console.log(`SQSEvent: ${JSON.stringify(event)}`);

  
}
