import { Context, S3Event } from "aws-lambda";

export async function handler(event: S3Event, context: Context): Promise<void> {
  console.log(`RequestId: ${context.awsRequestId}`);
  console.log(`Event: ${JSON.stringify(event)}`);
}
