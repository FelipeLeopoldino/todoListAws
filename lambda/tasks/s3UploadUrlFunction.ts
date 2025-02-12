import { Context, APIGatewayProxyEvent, APIGatewayProxyResult } from "aws-lambda";
import { S3 } from "aws-sdk";

// Cria uma instância do cliente do S3 da AWS
const s3Client = new S3();
// Obtém o nome do bucket a partir das variáveis de ambiente do processo
const bucketName = process.env.BUCKET_NAME! as string;

/**
 * Handler da função lambda que gera uma URL assinada para upload no S3.
 * 
 * Esta função é chamada quando um evento do API Gateway é disparado.
 * Ela realiza as seguintes operações:
 * - Registra informações relevantes no log, como o RequestId e o evento recebido.
 * - Gera uma chave única baseada no timestamp atual para identificar o objeto a ser inserido no S3.
 * - Gera uma URL assinada (PUT) usando o cliente S3, permitindo que o objeto seja inserido no bucket.
 * - Retorna a URL assinada em um objeto JSON com status HTTP 200.
 *
 * @param event - O evento recebido do API Gateway.
 * @param context - O contexto da execução da Lambda, contendo informações de tempo de execução e RequestId.
 * @returns Um objeto contendo o statusCode e o corpo da resposta, que inclui a URL assinada.
 */
export async function handler(
  event: APIGatewayProxyEvent,
  context: Context
): Promise<APIGatewayProxyResult> {
  // Registra o ID da requisição para rastreamento
  console.log(`RequestId: ${context.awsRequestId}`);
  // Registra o evento completo recebido
  console.log(`Event: ${JSON.stringify(event)}`);

  // Gera uma chave única para o objeto a ser armazenado no bucket (usando o timestamp atual)
  const key = Date.now().toString();
  
  // Gera uma URL assinada para o método PUT do objeto no bucket, válida por 300 segundos (5 minutos)
  const signedUrlPut = await s3Client.getSignedUrlPromise("putObject", {
    Bucket: bucketName,
    Key: key,
    Expires: 300,
  });

  // Retorna a URL assinada em um objeto JSON com status HTTP 200
  return {
    statusCode: 200,
    body: JSON.stringify({ url: signedUrlPut }),
  };
}