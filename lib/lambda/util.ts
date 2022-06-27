import type { EventBridgeEvent } from "aws-lambda";
import type { EventBridge } from "aws-sdk/clients/all";
import type { PutEventsRequestEntry } from "aws-sdk/clients/eventbridge";

export const putEvent = async (
  ebClient: EventBridge,
  entry: PutEventsRequestEntry
) => {
  return await ebClient
    .putEvents({
      Entries: [
        {
          Source: process.env.EVENT_SOURCE,
          EventBusName: process.env.EVENT_BUS,
          Time: new Date(),
          ...entry,
        },
      ],
    })
    .promise();
};

export const eventMetadata = (event: EventBridgeEvent<string, any>) => {
    const execution = event.detail.execution.split(':');
  return {
    ...event.detail,
    meta: {
      source: event.source,
      detailType: event["detail-type"],
      account: event.account,
      fn: process.env.AWS_LAMBDA_FUNCTION_NAME,
      execution: event.detail.execution, // arn of the state machine job
      stateMachine: execution[execution.length - 2], // 2nd to last is the state machine itself
      job: execution[execution.length - 1] // last is the job id
    },
  };
};
