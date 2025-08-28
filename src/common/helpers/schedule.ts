import { isChannelLive } from "@/bot";
import { prisma } from "@/prisma";
import { delay, sendActionToChannel } from "@/utils/misc";
import { PrismaClient } from "@prisma/client";

export interface AdventureWarning {
    delay: number; // milliseconds
    message: string;
}

const DEFAULT_WARNINGS: AdventureWarning[] = [
    {
        delay: 30 * 60 * 1000,
        message: `Ending the adventure in 15 minutes! Join now or update your silver with !adventure|adv to participate! GAMBA`,
    },
    {
        delay: 40 * 60 * 1000,
        message: `Alarm Ending the adventure in 5 minutes! Join now or update your silver with !adventure|adv to participate! dinkDonk`,
    },
    {
        delay: 43 * 60 * 1000,
        message: `Alarm Ending the adventure in 2 minutes! Join now or update your silver with !adventure|adv to participate! dinkDonk`,
    },
    { delay: 45 * 60 * 1000, message: `!adventureend` },
];
export const RESTART_WARNINGS: AdventureWarning[] = [
    { delay: 1000, message: `Ending the adventure in 15 minutes! Join now or update your silver with !adventure|adv to participate! GAMBA` },
    {
        delay: 10 * 60 * 1000,
        message: `Alarm Ending the adventure in 5 minutes! Join now or update your silver with !adventure|adv to participate! dinkDonk`,
    },
    {
        delay: 13 * 60 * 1000,
        message: `Alarm Ending the adventure in 2 minutes! Join now or update your silver with !adventure|adv to participate! dinkDonk`,
    },
    { delay: 15 * 60 * 1000, message: `!adventureend` },
];

export function scheduleAdventureWarnings(
    prisma: PrismaClient,
    channelLogin: string,
    adventureId: number,
    warnings: AdventureWarning[] = DEFAULT_WARNINGS,
) {
    const timers: NodeJS.Timeout[] = [];
    for (const { delay, message } of warnings) {
        const timer = setTimeout(async () => {
            const adv = await prisma.adventure.findUnique({ where: { id: adventureId } });
            if (!adv || adv.name === "DONE" || isChannelLive(channelLogin)) {
                for (const t of timers) {
                    clearTimeout(t);
                    console.log("clear timeout #", t);
                }
                return;
            }
            sendActionToChannel(channelLogin, message);
        }, delay);
        timer.unref();
        timers.push(timer);
    }
}

export async function restartAdventureWarnings(channelProviderId?: string) {
    // Find all adventures that are not DONE and not ended
    const adventures = await prisma.adventure.findMany({ where: { name: { not: "DONE" }, channelProviderId } });
    for (const adv of adventures) {
        console.log("Rescheduleing adventure warning for channel: ", adv.channel);
        // You may want to check for additional conditions, e.g. if the adventure is active
        // and not ended by other means
        scheduleAdventureWarnings(prisma, adv.channel, adv.id, RESTART_WARNINGS);
        // await delay(1000);
    }
}
