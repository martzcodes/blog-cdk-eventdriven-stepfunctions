import type { EventBridgeEvent } from "aws-lambda";
import { EventBridge } from "aws-sdk";
import { DetailType } from "../models/EventEnums";
import { putEvent } from "./util";
import fetch from "node-fetch";

let ebClient: EventBridge;
export const handler = async (
  event: EventBridgeEvent<string, any>
): Promise<void> => {
  const res = await fetch(event.detail.profile);
  const originalProfile: any = await res.json();

  // do some long running / eventually consistent process that isn't critical
  console.log(`Processed: ${originalProfile.name}`);

  const profile = {
    ...originalProfile,
  };

  if (!ebClient) {
    ebClient = new EventBridge();
  }
  await putEvent(ebClient, {
    DetailType: DetailType.SIDE_EFFECT_COMPLETE,
    Detail: JSON.stringify({ processed: profile.name }),
  });
};
