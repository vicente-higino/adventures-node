import { startLegendaryTasks } from "@/fishing";
import cron from "node-cron";
import { cancelExpiredDuels } from "./db";
import { prisma } from "./prisma";

export function startCron() {
    startLegendaryTasks();
    cron.schedule("0 * * * *", async () => {
        cancelExpiredDuels(prisma);
        console.log("Expired duels cancelled");
    });
    console.log("Cron jobs started");
}
