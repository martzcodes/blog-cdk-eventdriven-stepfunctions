import type { EventBridgeEvent } from "aws-lambda";
import { EventBridge, S3 } from "aws-sdk";
import { DetailType } from "../models/EventEnums";
import { putEvent } from "./util";
import { faker } from "@faker-js/faker";
import type { PutObjectRequest } from "aws-sdk/clients/s3";

let ebClient: EventBridge;
let s3: S3;
export const handler = async (
  event: EventBridgeEvent<string, any>
): Promise<void> => {
  if (!s3) {
    s3 = new S3();
  }
  const name = event.detail.name;

  // here we're looking up the person's profile
  // maybe this hits a 3rd party API? maybe it's querying a legacy database?
  const profile = {
    name,
    company: faker.company.companyName(),
    city: faker.address.cityName(),
  };
  const s3Params = {
    Bucket: process.env.BUCKET,
    Key: `${event.detail.execution}/basic-${name}.json`,
  };
  await s3
    .putObject({
      ...s3Params,
      ACL: "bucket-owner-full-control",
      Body: JSON.stringify(profile, null, 2),
    } as PutObjectRequest)
    .promise();
  const presigned = await s3.getSignedUrlPromise("getObject", {
    ...s3Params,
    Expires: 15 * 60,
  });

  if (!ebClient) {
    ebClient = new EventBridge();
  }
  await putEvent(ebClient, event, {
    DetailType: DetailType.PROCESS_SINGLE_POST,
    Detail: JSON.stringify({ profile: presigned }),
  });
};
