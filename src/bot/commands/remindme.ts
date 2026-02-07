import boss from "@/db/boss";
import { createBotCommand } from "../BotCommandWithKeywords";
import { parse, ms } from "ms";
import dayjs from "dayjs";
import { getBotConfig } from "@/bot";
import { uuidv7 } from "uuidv7";
import logger from "@/logger";

export const remindMeCommand = createBotCommand(
    "remindme",
    async (params, ctx) => {
        const { broadcasterId, broadcasterName, say } = ctx;
        let { userDisplayName, userId, userName } = ctx;
        let timeArg = params.shift();
        if (!timeArg) {
            say("Please specify a time for the reminder.");
            return;
        }
        const reminderDuration = parse(timeArg);
        if (!reminderDuration || reminderDuration < 1000 || reminderDuration > ms("10y")) {
            say("Please provide a valid time between 1 second and 10 years.");
            return;
        }
        let message = params.join(" ");
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
        say(`@${userDisplayName}, reminder set for ${timeArg} from now. 
                ${getBotConfig().prefix}cancelremindme #${cancelId} to cancel this reminder.`);
    },
    { aliases: ["rm"], offlineOnly: false },
);
