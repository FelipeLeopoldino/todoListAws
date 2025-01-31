import { SNSEvent, Context } from "aws-lambda";

export async function handler(event: SNSEvent, context: Context): Promise<void> {
    console.log(`LambdaRequestId: ${context.awsRequestId}`);
    console.log(`Event: ${JSON.stringify(event)}`);
}
