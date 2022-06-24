import { Duration } from "aws-cdk-lib";
import { IEventBus, Rule } from "aws-cdk-lib/aws-events";
import { SfnStateMachine } from "aws-cdk-lib/aws-events-targets";
import {
  CustomState,
  IntegrationPattern,
  JsonPath,
  StateMachine,
  Succeed,
  TaskInput,
  Map,
} from "aws-cdk-lib/aws-stepfunctions";
import { EventBridgePutEvents } from "aws-cdk-lib/aws-stepfunctions-tasks";
import { Construct } from "constructs";
import { Bus } from "./bus";
import { DetailType, SourceType } from "./models/EventEnums";

export interface EventdrivenStepfunctionProps {
  bus: Bus;
}

export class EventdrivenStepfunction extends Construct {
  stateMachine: StateMachine;
  constructor(
    scope: Construct,
    id: string,
    props: EventdrivenStepfunctionProps
  ) {
    super(scope, id);

    // 1st step - get multiple
    const multipleEvent = this.createEvent(`GetMultiple`, {
      details: {
        "execution.$": "$$.Execution.Id", // this is the arn for the state machine running
      },
      resultPath: "$.names",
      detailType: DetailType.GET_MULTIPLE,
      eventBus: props.bus.defaultBus,
    });

    // 2nd step - fan out: map -> process-single -> post-process-single
    // only emits the event to trigger process-single... process-single emits event to trigger post-process-single
    // post-process-single emits task finished event which closes out the step with the task token
    const processSingleEvent = this.createEvent(`ProcessSingle`, {
      details: {
        "name.$": "$.name",
        "execution.$": "$.execution", // this is the arn for the state machine running, provided via the map params
      },
      detailType: DetailType.PROCESS_SINGLE,
      eventBus: props.bus.defaultBus,
    });
    const mapToSingle = new Map(this, `ProcessMultiple`, {
      maxConcurrency: 2,
      itemsPath: "$.names.value", // due to the multi-state machine finisher the names end up in a value object
      parameters: {
        "name.$": "$$.Map.Item.Value", // this is an item in the list provided via the items path
        "execution.$": "$$.Execution.Id", // this is the arn for the state machine running
      },
      resultPath: JsonPath.DISCARD,
    });
    mapToSingle.iterator(processSingleEvent);

    // 3rd step - fan in: post-process-all
    const postProcessAll = this.createEvent(`PostProcessAll`, {
      details: {
        "names.$": "$.names.value", // matches the resultPath of the getMultiple step
        "execution.$": "$$.Execution.Id", // this is the arn for the state machine running
      },
      detailType: DetailType.PROCESS_ALL,
      eventBus: props.bus.defaultBus,
      resultPath: "$.totalCookiesConsumed"
    });

    // success
    const success = new Succeed(this, `Success`);

    const definition = multipleEvent
      .next(mapToSingle)
      .next(postProcessAll)
      .next(success);

    this.stateMachine = new StateMachine(this, `EventdrivenMachine`, {
      definition,
    });

    new Rule(this, `StartMachineRule`, {
        eventBus: props.bus.defaultBus,
        eventPattern: {
            detailType: [DetailType.START],
        },
        targets: [new SfnStateMachine(this.stateMachine)]
    });

    this.addTaskFinisher(props.bus);
  }

  private createEvent(
    id: string,
    {
      eventBus,
      detailType,
      details,
      resultPath,
    }: {
      eventBus: IEventBus;
      detailType: DetailType;
      details: Record<string, string>;
      resultPath?: string;
    }
  ): EventBridgePutEvents {
    return new EventBridgePutEvents(this, id, {
      entries: [
        {
          detail: TaskInput.fromObject({
            ...details,
            TaskToken: JsonPath.taskToken, // this is required for WAIT_FOR_TASK_TOKEN
          }),
          eventBus,
          detailType,
          source: SourceType.PROJECT,
        },
      ],
      ...(resultPath
        ? {
            resultSelector: TaskInput.fromJsonPathAt(resultPath),
            resultPath,
          }
        : { resultPath: JsonPath.DISCARD }),
      integrationPattern: IntegrationPattern.WAIT_FOR_TASK_TOKEN,
    });
  }

  private addTaskFinisher(bus: Bus) {
    // I'm using a step function here to send the task success messages... you could also use a lambda
    const taskSuccess = new CustomState(this, `TaskSuccess`, {
      stateJson: {
        Type: "Task",
        Resource: `arn:aws:states:::aws-sdk:sfn:sendTaskSuccess`,
        Parameters: {
          "Output.$": "$.detail",
          "TaskToken.$": "$.detail.TaskToken",
        },
      },
    });
    const finisherMachine = new StateMachine(this, `StepFinisher`, {
      definition: taskSuccess.next(new Succeed(this, `TaskSucceeded`)),
      timeout: Duration.minutes(5),
    });
    this.stateMachine.grantTaskResponse(finisherMachine);

    new Rule(this, `FinisherRule`, {
      eventBus: bus.defaultBus,
      eventPattern: {
        detailType: [DetailType.TASK_FINISHED],
      },
      targets: [new SfnStateMachine(finisherMachine)],
    });
  }
}
