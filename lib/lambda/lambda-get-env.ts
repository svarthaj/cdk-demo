import * as AWS from 'aws-sdk';
import { APIGatewayProxyEventV2 } from 'aws-lambda';

const dynamo = new AWS.DynamoDB.DocumentClient();

export async function getEnv(event: APIGatewayProxyEventV2) {
  let body: string;
  let statusCode = 200;
  const headers = {
    'Content-Type': 'application/json'
  };

  const route = event.routeKey;

  try {
    if (route === 'GET /environments') {
      const result = await dynamo.scan({ TableName: 'environments' }).promise();
      body = JSON.stringify(result)
    } else if (route === 'GET /environments/{envName}') {
      const result = await dynamo
        .get({
          TableName: 'environments',
          Key: {
            envName: event?.pathParameters?.envName
          }
        })
        .promise()
      body = JSON.stringify(result);
    } else {
      throw new Error(`Unsupported route: "${route}"`)
    }
  } catch (error) {
    const { message } = error as Error; 
    body = JSON.stringify(message);
    statusCode = 400;
  }

  return {
    statusCode,
    body,
    headers
  }
}
