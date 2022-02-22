import * as AWS from 'aws-sdk';
import { APIGatewayEvent } from 'aws-lambda';

const dynamo = new AWS.DynamoDB.DocumentClient();

export async function putEnv(event: APIGatewayEvent) {
  let body: string;
  let statusCode = 200;
  const headers = {
    'Content-Type': 'application/json'
  };

  try {
    let request = JSON.parse(event.body as string);

    await dynamo
      .put({
        TableName: 'environments',
        Item: request
      })
      .promise()
      
      body = JSON.stringify(`Put env ${request.envName}`);
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
