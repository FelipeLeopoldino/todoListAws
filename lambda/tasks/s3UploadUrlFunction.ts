import { Context, APIGatewayProxyEvent, APIGatewayProxyResult } from "aws-lambda";
import { S3 } from "aws-sdk";

const s3Client = new S3();
const bucketName = process.env.BUCKET_NAME! as string;

export async function handler(
  event: APIGatewayProxyEvent,
  context: Context
): Promise<APIGatewayProxyResult> {
  console.log(`RequestId: ${context.awsRequestId}`);
  console.log(`Event: ${JSON.stringify(event)}`);

  const key = Date.now().toString();
  const signedUrlPut = await s3Client.getSignedUrlPromise("putObject", {
    Bucket: bucketName,
    Key: key,
    Expires: 300,
  });

  return {
    statusCode: 200,
    body: JSON.stringify({ url: signedUrlPut }),
  };
}
