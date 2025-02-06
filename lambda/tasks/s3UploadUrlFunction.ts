import { Context, APIGatewayProxyEvent, APIGatewayProxyResult } from "aws-lambda";

export async function handler(
  event: APIGatewayProxyEvent,
  context: Context
): Promise<APIGatewayProxyResult> {
  console.log(`RequestId: ${context.awsRequestId}`);
  console.log(`Event: ${JSON.stringify(event)}`);

  return {
    statusCode: 200,
    body: JSON.stringify("OK!"),
  };
}
