import { ms } from "ms";
import { getBotPrefix } from "..";
import { createAdminBotCommand, createBotCommand } from "../botCommandWithKeywords";
import { manualLegendaryEventTask } from "@/fishing";
import { consumeRedeemable, grantRedeemable } from "@/common/redeemables";
import { boxMullerTransform } from "@/utils/misc";
import { Mutex } from "async-mutex";
import { isLegendaryEventActive } from "@/fishing/legendaryEvents";

const mutex = new Mutex();
export const startEventCommand = createAdminBotCommand(
    "startevent",
    async (params, ctx) => {
        const { say } = ctx;
        await mutex.runExclusive(async () => {
            const legendaryWeight = Number(params[0]);
            const durationMinutes = Number(params[1]);
            const customMsg = params.slice(2).join(" ");
            if (isNaN(legendaryWeight) || isNaN(durationMinutes) || legendaryWeight <= 0 || durationMinutes <= 0) {
                say(`Usage: ${getBotPrefix()}startEvent <legendaryWeight> <durationMinutes>`);
                return;
            }
            if (manualLegendaryEventTask(legendaryWeight, durationMinutes * 60 * 1000, customMsg.length > 0 ? customMsg : undefined)) {
                say(`Started Legendary Fishing Event with weight ${legendaryWeight} for ${ms(durationMinutes * 60 * 1000, { long: true })}.`);
            } else {
                say(`A Legendary Fishing Event is already active. Please wait until it ends.`);
            }
        });
    },
    { ignoreCase: true, aliases: ["se"] },
);


export const startLegendaryEventCommand = createBotCommand(
    "startlegendaryevent",
    async (params, ctx) => {
        const { say, userId, broadcasterId, userDisplayName } = ctx;
        await mutex.runExclusive(async () => {
            if (!isLegendaryEventActive()) {
                const redeem = await consumeRedeemable({ userId, channelProviderId: broadcasterId, redeemableCode: "legendary_event_ticket" });
                if (redeem) {
                    const legendaryWeight = Math.round(boxMullerTransform(25, 10, 20));
                    const msg = `@${userDisplayName} has started a Legendary Fishing Event!`
                    if (!manualLegendaryEventTask(legendaryWeight, 90 * 60 * 1000, msg)) {
                        await grantRedeemable({ userId, channelProviderId: broadcasterId, redeemableCode: "legendary_event_ticket" });
                        say(`@${userDisplayName}, A Legendary Fishing Event is already active. Please wait until it ends.`);
                    }
                } else {
                    say(`@${userDisplayName}, you dont have a ticket to start the legendary event.`);
                }
            }
        })
    },
    { ignoreCase: true, aliases: ["sle"] },
);
