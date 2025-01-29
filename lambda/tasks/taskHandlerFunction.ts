import { APIGatewayProxyEvent, APIGatewayProxyResult, Context } from "aws-lambda";

export async function handler(
  event: APIGatewayProxyEvent,
  context: Context
): Promise<APIGatewayProxyResult> {
  const apiRequestId = event.requestContext.resourceId;
  const lambda = context.awsRequestId;
  const httpMethod = event.httpMethod;

  console.log(`API RequestId: ${apiRequestId} - Lambda RequestId: ${lambda}`);
  console.log(JSON.stringify(event));

  if (httpMethod === "GET") {
    return {
      statusCode: 200,
      body: JSON.stringify({
        message: "GET",
      }),
    };
  }

  if (httpMethod === "POST") {
    return {
      statusCode: 200,
      body: JSON.stringify({
        message: "POST",
      }),
    };
  }

  if (httpMethod === "PUT") {
    return {
      statusCode: 200,
      body: JSON.stringify({
        message: "PUT",
      }),
    };
  }

  if (httpMethod === "DELETE") {
    return {
      statusCode: 200,
      body: JSON.stringify({
        message: "DELETE",
      }),
    };
  }

  return {
    statusCode: 200,
    body: JSON.stringify({
      message: "Hello from Lambda!",
    }),
  };
}
