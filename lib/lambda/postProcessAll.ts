import type { EventBridgeEvent } from "aws-lambda";
import { EventBridge, S3 } from "aws-sdk";
import { GetObjectRequest, PutObjectRequest } from "aws-sdk/clients/s3";
import { DetailType } from "../models/EventEnums";
import { putEvent } from "./util";

let ebClient: EventBridge;
let s3: S3;
export const handler = async (
  event: EventBridgeEvent<string, any>
): Promise<void> => {
  if (!s3) {
    s3 = new S3();
  }
  const execution = event.detail.execution;
  const names = event.detail.names;
  const output = {
    names,
    numberOfPeople: names.length,
    totalCookiesConsumed: 0,
  };
  // combine some bit of information from all the previous things
  for (let j = 0; j < names.length; j++) {
    const res = await s3
      .getObject({
        Bucket: process.env.BUCKET,
        Key: `${execution}/final-${names[j]}.json`,
      } as GetObjectRequest)
      .promise();
    const profile = JSON.parse(res.Body?.toString() || "{}");
    output.totalCookiesConsumed += profile.numberOfCookiesConsumed;
  }
  await s3
    .putObject({
      Bucket: process.env.BUCKET,
      Key: `${execution}/0-cookies.json`, // 0- just to make it easier to see in the list
      ACL: "bucket-owner-full-control",
      Body: JSON.stringify(output, null, 2),
    } as PutObjectRequest)
    .promise();
  if (!s3) {
    s3 = new S3();
  }
  if (!ebClient) {
    ebClient = new EventBridge();
  }
  await putEvent(ebClient, event, {
    DetailType: DetailType.TASK_FINISHED,
    Detail: JSON.stringify({
      totalCookiesConsumed: output.totalCookiesConsumed,
    }),
  });
};
