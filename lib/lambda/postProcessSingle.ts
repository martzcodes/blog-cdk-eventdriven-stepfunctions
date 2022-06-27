import type { EventBridgeEvent } from "aws-lambda";
import { EventBridge, S3 } from "aws-sdk";
import { DetailType } from "../models/EventEnums";
import { putEvent } from "./util";
import fetch from "node-fetch";
import type { PutObjectRequest } from "aws-sdk/clients/s3";

let ebClient: EventBridge;
let s3: S3;
export const handler = async (
  event: EventBridgeEvent<string, any>
): Promise<void> => {
  if (!s3) {
    s3 = new S3();
  }
  const res = await fetch(event.detail.profile);
  const originalProfile: any = await res.json();

  // we have their profile from the last step... but maybe we need to query yet another source of information
  // here we're just mocking "numberOfCookiesConsumed"
  const profile = {
    ...originalProfile,
    numberOfCookiesConsumed: Math.floor(Math.random() * 10),
  };
  const s3Params = {
    Bucket: process.env.BUCKET,
    Key: `${event.detail.execution}/final-${profile.name}.json`,
  };
  await s3
    .putObject({
      ...s3Params,
      ACL: "bucket-owner-full-control",
      Body: JSON.stringify(profile, null, 2),
    } as PutObjectRequest)
    .promise();

  if (!ebClient) {
    ebClient = new EventBridge();
  }
  await putEvent(ebClient, event, {
    DetailType: DetailType.TASK_FINISHED,
    Detail: JSON.stringify({ processed: profile.name }),
  });
};
