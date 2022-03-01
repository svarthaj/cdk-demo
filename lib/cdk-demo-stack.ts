import { Stack, StackProps, RemovalPolicy, Duration, CfnOutput } from 'aws-cdk-lib';
import {AssetCode, Function, Runtime} from "aws-cdk-lib/aws-lambda";
import { AttributeType, Table } from 'aws-cdk-lib/aws-dynamodb';
import {Effect, PolicyStatement, Role, ServicePrincipal} from "aws-cdk-lib/aws-iam";
import { Vpc, SecurityGroup, SubnetSelection } from 'aws-cdk-lib/aws-ec2';
import { Construct } from 'constructs';
import { CfnApi, CfnDeployment, CfnIntegration, CfnRoute, CfnStage } from 'aws-cdk-lib/aws-apigatewayv2';

export class CdkDemoStack extends Stack {
  constructor(scope: Construct, id: string, props?: StackProps) {
    super(scope, id, props);
    
    /**
     * Create VPC
     */
     const vpc = new Vpc(this, 'VpcDemo', {
      cidr: '10.192.0.0/16',
      maxAzs: 2,
      natGateways: 1,
      enableDnsHostnames: true,
      enableDnsSupport: true
    });

    /**
     * Add SG
     */
     const securityGroup = new SecurityGroup(this, 'SecurityGroup', {
      vpc,
      description: 'Allow all ingress/egress',
      allowAllOutbound: true
    });

    /**
     * Initialise APIG
     */
     const name = id + '-api';
     const api = new CfnApi(this, name, {
       name: 'CdkDemoApi',
       protocolType: 'HTTP',
       corsConfiguration: {
         allowHeaders: [
           'Content-Type',
           'X-Amz-Date',
           'Authorization',
           'X-Api-Key',
         ],
         allowMethods: [
           'GET', 'PUT', 'DELETE'
         ]
       }
     });
    
     /**
     * Setup Dynamo Table
     */
    const dynamoTable = new Table(this, 'environments', {
      partitionKey: {
        name: 'envName',
        type: AttributeType.STRING
      },
      tableName: 'environments',
      removalPolicy: RemovalPolicy.DESTROY, // NOT recommended for production code
    });

    /**
     * Create Lambdas
     */
    const getFunc = new Function(this, 'cdk-demo-get-lambda', {
      code: new AssetCode('./lib/lambda'),
      handler: 'lambda-get-env.getEnv',
      runtime: Runtime.NODEJS_14_X,
      timeout: Duration.seconds(300),
      memorySize: 256,
      vpc: vpc,
      vpcSubnets: { subnets: vpc.privateSubnets } as SubnetSelection,
      securityGroups: [securityGroup]
    })

    dynamoTable.grantReadWriteData(getFunc);

    const putFunc = new Function(this, 'cdk-demo-put-lambda', {
      code: new AssetCode('./lib/lambda'),
      handler: 'lambda-put-env.putEnv',
      runtime: Runtime.NODEJS_14_X,
      timeout: Duration.seconds(300),
      memorySize: 256,
      vpc: vpc,
      vpcSubnets: { subnets: vpc.privateSubnets } as SubnetSelection,
      securityGroups: [securityGroup]
    })

    dynamoTable.grantReadWriteData(putFunc);

    const deleteFunc = new Function(this, 'cdk-demo-delete-lambda', {
      code: new AssetCode('./lib/lambda'),
      handler: 'lambda-delete-env.deleteEnv',
      runtime: Runtime.NODEJS_14_X,
      timeout: Duration.seconds(300),
      memorySize: 256,
      vpc: vpc,
      vpcSubnets: { subnets: vpc.privateSubnets } as SubnetSelection,
      securityGroups: [securityGroup]
    })

    dynamoTable.grantReadWriteData(deleteFunc);

    /**
     * Access role & policy from APIG
     */
    const policy = new PolicyStatement({
      effect: Effect.ALLOW,
      resources: [
          getFunc.functionArn,
          putFunc.functionArn,
          deleteFunc.functionArn
      ],
      actions: ["lambda:InvokeFunction"]
    });

    const role = new Role(this, `${name}-iam-role`, {
        assumedBy: new ServicePrincipal("apigateway.amazonaws.com")
    });
    role.addToPolicy(policy);
    
    /**
     * Create integrations
     */
    const getIntegration = new CfnIntegration(this, 'cdk-demo-get-lambda-integration', {
      apiId: api.ref,
      integrationType: 'AWS_PROXY',
      integrationUri: getFunc.functionArn,
      credentialsArn: role.roleArn,
      payloadFormatVersion: '2.0'
    })

    const putIntegration = new CfnIntegration(this, 'cdk-demo-put-lambda-integration', {
      apiId: api.ref,
      integrationType: 'AWS_PROXY',
      integrationUri: putFunc.functionArn,
      credentialsArn: role.roleArn,
      payloadFormatVersion: '2.0'
    })

    const deleteIntegration = new CfnIntegration(this, 'cdk-demo-delete-lambda-integration', {
      apiId: api.ref,
      integrationType: 'AWS_PROXY',
      integrationUri: deleteFunc.functionArn,
      credentialsArn: role.roleArn,
      payloadFormatVersion: '2.0'
    })

    /**
     * Create Routes
     */
    const putRoute = new CfnRoute(this, "put-route", {
      apiId: api.ref,
      routeKey: 'PUT /environments',
      authorizationType: 'AWS_IAM',
      target: `integrations/${putIntegration.ref}`,
    });

    const getAllRoute = new CfnRoute(this, "get-all-route", {
      apiId: api.ref,
      routeKey: 'GET /environments',
      authorizationType: 'AWS_IAM',
      target: `integrations/${getIntegration.ref}`,
    });

    const getRoute = new CfnRoute(this, 'get-route', {
      apiId: api.ref,
      routeKey: 'GET /environments/{envName}',
      authorizationType: 'AWS_IAM',
      target: `integrations/${getIntegration.ref}`,
    });

    const deleteRoute = new CfnRoute(this, "delete-route", {
      apiId: api.ref,
      routeKey: 'DELETE /environments/{envName}',
      authorizationType: 'AWS_IAM',
      target: `integrations/${deleteIntegration.ref}`,
    });

    /**
     * Setup deployment
     */
    const deployment = new CfnDeployment(this, `${name}-deployment`, {
      apiId: api.ref
    });

    /**
     * Setup stage
     */
    new CfnStage(this, `${name}-stage`, {
      apiId: api.ref,
      autoDeploy: true,
      deploymentId: deployment.ref,
      stageName: "dev"
    });

    deployment.node.addDependency(getAllRoute);
    deployment.node.addDependency(getRoute);
    deployment.node.addDependency(putRoute);
    deployment.node.addDependency(deleteRoute);
  }
}
