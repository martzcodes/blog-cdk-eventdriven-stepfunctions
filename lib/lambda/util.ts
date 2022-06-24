import type { EventBridge } from "aws-sdk/clients/all";
import type { PutEventsRequestEntry } from "aws-sdk/clients/eventbridge";

export const putEvent = async (ebClient: EventBridge, entry: PutEventsRequestEntry) => {
    return await ebClient.putEvents({
        Entries: [{
            Source: process.env.EVENT_SOURCE,
            EventBusName: process.env.EVENT_BUS,
            Time: new Date(),
            ...entry,
        }]
    }).promise();
};
