import type { EventBridgeEvent } from "aws-lambda";
import type { EventBridge } from "aws-sdk/clients/all";
import type { PutEventsRequestEntry } from "aws-sdk/clients/eventbridge";

export const eventMetadata = (
  event: EventBridgeEvent<string, any>,
  detailType: string
) => {
  const execution = event.detail.execution.split(":");
  return {
    ...event.detail,
    execution: event.detail.execution, // arn of the state machine job
    meta: {
      incoming: {
        account: event.account,
        source: event.source,
        detailType: event["detail-type"],
      },
      outgoing: {
        source: process.env.EVENT_SOURCE,
        detailType,
      },
      fn: process.env.AWS_LAMBDA_FUNCTION_NAME,
      stateMachine: execution[execution.length - 2], // 2nd to last is the state machine itself
      job: execution[execution.length - 1], // last is the job id
    },
  };
};

export const putEvent = async (
  ebClient: EventBridge,
  event: EventBridgeEvent<string, any>,
  entry: PutEventsRequestEntry
) => {
  const detail = JSON.parse(entry.Detail!);
  return await ebClient
    .putEvents({
      Entries: [
        {
          Source: process.env.EVENT_SOURCE,
          EventBusName: process.env.EVENT_BUS,
          Time: new Date(),
          ...entry,
          Detail: JSON.stringify({
            ...detail,
            ...eventMetadata(event, entry.DetailType!),
          }),
        },
      ],
    })
    .promise();
};
