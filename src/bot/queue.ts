import boss from "@/db/boss";
import logger from "@/logger";
import { sendActionToChannel } from "@/utils/misc";
import { ms } from "ms";
import { cancelRPSMatch } from "./rps";
import { processWarning } from "@/common/helpers/schedule";

export async function startPgBoss() {
    await boss.start();
    await initializeReminderQueue();
    await initializeRPS_CancelQueue();
    await initializeAdventureScheduleQueue();
}

async function initializeReminderQueue() {
    await boss.createQueue("reminder", { retentionSeconds: 3600 * 24 * 365 * 10 }); // Retain jobs for 10 years
    const stats = await boss.getQueueStats("reminder");
    logger.debug(stats, `Reminder queue stats`);
    boss.work("reminder", { includeMetadata: true, pollingIntervalSeconds: 1 }, async ([job]) => {
        logger.debug(job, "Processing reminder job");
        const { userId, userName, userDisplayName, channelId, channelName, message } = job.data as any;
        logger.info(`Sending reminder to ${userDisplayName} (${userName}) in channel ${channelName}: ${message}`);
        const elapsedTime = ms(Date.now() - job.createdOn.getTime());
        const formattedMessage = `@${userDisplayName} (${elapsedTime} ago): ${message}`;
        sendActionToChannel(channelName, formattedMessage);
    });
}
async function initializeRPS_CancelQueue() {
    await boss.createQueue("rps-cancel");
    const stats = await boss.getQueueStats("rps-cancel");
    logger.debug(stats, `rps-cancel queue stats`);
    boss.work("rps-cancel", async ([job]) => {
        logger.debug(job, "Processing rps-cancel job");
        const { matchId } = job.data as any;
        const res = await cancelRPSMatch(matchId);
        if (res.status === "error") {
            logger.error(`Failed to cancel RPS match ${matchId}: ${res.error}`);
        } else {
            logger.info(`Successfully canceled RPS match ${matchId}`);
        }
    });
}
async function initializeAdventureScheduleQueue() {
    await boss.createQueue("adv-schedule", { retentionSeconds: 3600 }); // Retain jobs for 1 hour
    const stats = await boss.getQueueStats("adv-schedule");
    logger.debug(stats, `adv-schedule queue stats`);
    boss.work<{ advId: number; message: string }>("adv-schedule", async ([job]) => {
        logger.debug(job, "Processing adv-schedule job");
        const { advId, message } = job.data;
        processWarning(advId, message);
    });
}