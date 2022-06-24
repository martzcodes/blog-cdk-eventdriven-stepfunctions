import {
  EventBus,
  EventPattern,
  IEventBus,
  Rule,
} from "aws-cdk-lib/aws-events";
import { LambdaFunction } from "aws-cdk-lib/aws-events-targets";
import { NodejsFunction } from "aws-cdk-lib/aws-lambda-nodejs";
import { Construct } from "constructs";
import { SourceType } from "./models/EventEnums";

export interface BusConstruct {}

export class Bus extends Construct {
  defaultBus: IEventBus;
  constructor(scope: Construct, id: string, props: BusConstruct) {
    super(scope, id);
    this.defaultBus = EventBus.fromEventBusName(this, `defaultBus`, "default");
  }

  addLambdaRule(
    id: string,
    props: {
      lambda: NodejsFunction;
      eventPattern: EventPattern;
    }
  ) {
    new Rule(this, id, {
      description: id,
      eventBus: this.defaultBus,
      targets: [new LambdaFunction(props.lambda)],
      eventPattern: props.eventPattern,
    });
    this.defaultBus.grantPutEventsTo(props.lambda);
    props.lambda.addEnvironment("EVENT_BUS", this.defaultBus.eventBusName);
    props.lambda.addEnvironment("EVENT_SOURCE", SourceType.PROJECT);
  }
}
