import boss from "@/db/boss";
import { createBotCommand } from "../BotCommandWithKeywords";
import logger from "@/logger";

export const cancelRemindMeCommand = createBotCommand(
    "cancelremindme",
    async (params, ctx) => {
        const { broadcasterId, say } = ctx;
        let { userDisplayName, userId } = ctx;
        let cancelId = params.shift();
        if (!cancelId) {
            say("Please specify the cancel ID for the reminder you want to cancel.");
            return;
        }
        cancelId = cancelId.replace("#", "");
        const job = await boss.findJobs("reminder", { data: { cancelId, userId, channelId: broadcasterId }, queued: true });
        logger.debug({ job }, "Found jobs for cancellation");
        if (job.length === 0) {
            say(`@${userDisplayName}, no active reminder found with ID #${cancelId}. Please check the ID and try again.`);
            return;
        }
        await boss.cancel("reminder", job[0].id);
        say(`@${userDisplayName}, reminder with ID #${cancelId} has been cancelled.`);
    },
    { aliases: ["crm"], offlineOnly: false },
);
