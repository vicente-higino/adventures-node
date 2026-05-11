import { startLegendaryTasks } from "@/fishing";
import cron from "node-cron";
import { cancelExpiredDuels, deleteOldCompletedDuels, deleteOldRPSMatches } from "./db";
import { prisma } from "./prisma";
import env from "@/env";
import logger from "@/logger";

export function startCron() {
    startLegendaryTasks();
    cron.schedule("0 0 * * *", () => {
        deleteOldCompletedDuels(prisma, 24);
        deleteOldRPSMatches(prisma, 24);
    });
    cron.schedule("0 * * * *", () => {
        cancelExpiredDuels(prisma);
    });

    logger.info("Cron jobs started");
}
