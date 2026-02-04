import boss from "@/db/boss";
import { createBotCommand } from "../BotCommandWithKeywords";
import { parse, ms } from "ms";

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
        const time = parse(timeArg);
        if (!time || time < 1000 || time > ms("10y")) {
            say("Please provide a valid time between 1 second and 10 years.");
            return;
        }
        let message = params.join(" ");
        if (!message) {
            message = `This is your reminder!`;
        }
        boss.sendAfter(
            "reminder",
            { userId, userName, userDisplayName, channelId: broadcasterId, channelName: broadcasterName, message },
            null,
            time / 1000,
        );
        say(`@${userDisplayName}, I will remind you in ${ms(time, { long: true })}.`);
    },
    { aliases: ["rm"] },
);
