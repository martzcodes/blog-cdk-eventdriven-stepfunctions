import type { EventBridgeEvent } from "aws-lambda";
import { EventBridge } from "aws-sdk";
import { DetailType } from "../models/EventEnums";
import { putEvent } from "./util";
import { faker } from "@faker-js/faker";

let ebClient: EventBridge;
export const handler = async (
  event: EventBridgeEvent<string, any>
): Promise<void> => {
  if (!ebClient) {
    ebClient = new EventBridge();
  }
  // generate a random number of fake names from a "database"
  await putEvent(ebClient, event, {
    DetailType: DetailType.TASK_FINISHED,
    Detail: JSON.stringify({
      names: Array.from({ length: Math.floor(Math.random() * 20) }, () =>
        faker.name.findName()
      ),
    }),
  });
};
