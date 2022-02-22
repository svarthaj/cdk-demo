import * as AWS from 'aws-sdk';
import { APIGatewayEvent } from 'aws-lambda';

const dynamo = new AWS.DynamoDB.DocumentClient();

export async function deleteEnv(event: APIGatewayEvent) {
  let body: string;
  let statusCode = 200;
  const headers = {
    'Content-Type': 'application/json'
  };

  try {
    await dynamo
      .delete({
        TableName: 'environments',
        Key: {
          envName: event?.pathParameters?.envName 
        }
      })
      .promise()
      
      body = JSON.stringify(`Deleted env ${event?.pathParameters?.envName}`);
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
