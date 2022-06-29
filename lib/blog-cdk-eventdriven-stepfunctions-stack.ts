import { Duration, RemovalPolicy, Stack, StackProps } from "aws-cdk-lib";
import { Runtime } from "aws-cdk-lib/aws-lambda";
import { NodejsFunction } from "aws-cdk-lib/aws-lambda-nodejs";
import { RetentionDays } from "aws-cdk-lib/aws-logs";
import { BlockPublicAccess, Bucket } from "aws-cdk-lib/aws-s3";
import { Construct } from "constructs";
import { Bus } from "./bus";
import { EventdrivenStepfunction } from "./eventdriven-stepfunction";
import { DetailType } from "./models/EventEnums";

export class BlogCdkEventdrivenStepfunctionsStack extends Stack {
  bus: Bus;
  constructor(scope: Construct, id: string, props?: StackProps) {
    super(scope, id, props);

    this.bus = new Bus(this, `Bus`, {});

    const bucket = new Bucket(this, `Bucket`, {
      autoDeleteObjects: true,
      removalPolicy: RemovalPolicy.DESTROY,
      blockPublicAccess: BlockPublicAccess.BLOCK_ALL,
    });

    this.addLambda({ name: `getMultiple`, detailType: DetailType.GET_MULTIPLE});
    this.addLambda({ name: `processSingle`, detailType: DetailType.PROCESS_SINGLE, bucket});
    this.addLambda({ name: `postProcessSingle`, detailType: DetailType.PROCESS_SINGLE_POST, bucket});
    this.addLambda({ name: `postProcessAll`, detailType: DetailType.PROCESS_ALL, bucket});
    this.addLambda({ name: `sideEffect`, detailType: DetailType.PROCESS_SINGLE_POST});

    new EventdrivenStepfunction(this, `SM`, { bus: this.bus });
  }

  addLambda({name, detailType, bucket}: { name: string, detailType: string, bucket?: Bucket}) {
    const fn = new NodejsFunction(this, `${name}Fn`, {
      functionName: `${name}Fn`, // only adding to make the o11y more readable
      logRetention: RetentionDays.ONE_DAY,
      runtime: Runtime.NODEJS_16_X,
      entry: `${__dirname}/lambda/${name}.ts`,
      timeout: Duration.minutes(1),
    });
    this.bus.addLambdaRule(`${name}Rule`, {
      lambda: fn,
      eventPattern: {
        detailType: [detailType],
      }
    });
    if (bucket) {
      bucket.grantReadWrite(fn);
      fn.addEnvironment("BUCKET", bucket.bucketName);
    }

    return fn;
  }
}
