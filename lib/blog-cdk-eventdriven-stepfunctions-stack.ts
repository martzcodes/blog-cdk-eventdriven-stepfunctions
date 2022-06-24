import { RemovalPolicy, Stack, StackProps } from "aws-cdk-lib";
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
  sm: EventdrivenStepfunction;
  constructor(scope: Construct, id: string, props?: StackProps) {
    super(scope, id, props);

    this.bus = new Bus(this, `Bus`, {});

    const bucket = new Bucket(this, `Bucket`, {
      autoDeleteObjects: true,
      removalPolicy: RemovalPolicy.DESTROY,
      blockPublicAccess: BlockPublicAccess.BLOCK_ALL,
    });

    const getMultiple = this.addLambda({ name: `getMultiple`, detailType: DetailType.GET_MULTIPLE});
    const processSingle = this.addLambda({ name: `processSingle`, detailType: DetailType.PROCESS_SINGLE, bucket});
    const postProcessSingle = this.addLambda({ name: `postProcessSingle`, detailType: DetailType.PROCESS_SINGLE_POST, bucket});
    const postProcessAll = this.addLambda({ name: `postProcessAll`, detailType: DetailType.PROCESS_ALL, bucket});
    const sideEffect = this.addLambda({ name: `sideEffect`, detailType: DetailType.PROCESS_SINGLE_POST});

    const sm = new EventdrivenStepfunction(this, `SM`, { bus: this.bus });
  }

  addLambda({name, detailType, bucket}: { name: string, detailType: string, bucket?: Bucket}) {
    const fn = new NodejsFunction(this, `${name}Fn`, {
      logRetention: RetentionDays.ONE_DAY,
      runtime: Runtime.NODEJS_16_X,
      entry: `${__dirname}/lambda/${name}.ts`,
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
