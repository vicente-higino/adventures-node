import { startLegendaryTasks } from "@/fishing";
import cron from "node-cron";
import { cancelExpiredDuels, deleteOldCompletedDuels } from "./db";
import { prisma } from "./prisma";
import env from "@/env";
import logger from "@/logger";

export function startCron() {
    startLegendaryTasks();
    cron.schedule("0 * * * *", () => {
        cancelExpiredDuels(prisma);
        deleteOldCompletedDuels(prisma, env.COOLDOWN_DUEL_IN_HOURS);
    });

    logger.info("Cron jobs started");
}
