import boss from "@/db/boss";
import logger from "@/logger";
import * as chrono from "chrono-node";
import dayjs from "dayjs";
import { format, ms } from "ms";
import { uuidv7 } from "uuidv7";
import { createBotCommand } from "../BotCommandWithKeywords";

export const remindMeCommand = createBotCommand(
    "remindme",
    async (params, ctx) => {
        const { broadcasterId, broadcasterName, say } = ctx;
        let { userDisplayName, userId, userName } = ctx;
        let message = params.join(" ");
        let timeArg = chrono.parse(message, { timezone: "UTC" });
        if (timeArg.length == 0) {
            say("Please specify a time for the reminder.");
            return;
        }
        logger.debug({ timeArg }, "Parsed time argument");
        const time = timeArg[0].date();
        message = message.replace(timeArg[0].text, "").trim();
        const reminderDuration = time.getTime() - Date.now();
        if (!reminderDuration || reminderDuration < 1000 || reminderDuration > ms("10y")) {
            say("Please provide a valid time between 1 second and 10 years.");
            return;
        }
        if (!message) {
            message = `This is your reminder!`;
        }
        const futureDate = dayjs().add(reminderDuration, "millisecond").toDate();
        const now = new Date();
        const diff = futureDate.getTime() - now.getTime();
        logger.debug({ reminderDuration, message, futureDate, now, diff }, "Scheduling reminder");
        const cancelId = uuidv7().slice(-5);
        boss.sendAfter(
            "reminder",
            { cancelId, userId, userName, userDisplayName, channelId: broadcasterId, channelName: broadcasterName, message },
            null,
            reminderDuration / 1000,
        );
        say(`@${userDisplayName}, reminder #${cancelId} is set in ${format(reminderDuration)}.`);
    },
    { aliases: ["rm"], offlineOnly: false },
);
