import { startLegendaryTasks } from "@/fishing";
import cron from "node-cron";
import { cancelExpiredDuels, deleteOldCompletedDuels, deleteOldRPSMatches } from "./db";
import { prisma } from "./prisma";
import env from "@/env";
import logger from "@/logger";
import { reconcileAdventureWarnings } from "@/common/helpers/schedule";

export function startCron() {
    startLegendaryTasks();
    cron.schedule("0 0 * * *", async () => {
        await Promise.all([
            deleteOldCompletedDuels(prisma, 24),
            deleteOldRPSMatches(prisma, 24),
            prisma.adventureJoinRequest.deleteMany({ where: { createdAt: { lt: new Date(Date.now() - 7 * 24 * 60 * 60 * 1000) } } }),
        ]).catch(error => logger.error({ error }, "Failed to clean up expired records"));
    });
    cron.schedule("0 * * * *", () => {
        cancelExpiredDuels(prisma);
    });
    cron.schedule("* * * * *", async () => {
        await reconcileAdventureWarnings().catch(error => logger.error({ error }, "Failed to reconcile adventure warning schedules"));
    });

    logger.info("Cron jobs started");
}
