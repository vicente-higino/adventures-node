import boss from "@/db/boss";
import logger from "@/logger";
import { sendActionToChannel } from "@/utils/misc";
import { ms } from "ms";

export async function initializeReminderQueue() {
    await boss
        .start()
        .then(async b => {
            logger.info("PgBoss started successfully");
        })
        .catch(err => {
            logger.error(err, "Failed to start PgBoss");
        });

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
