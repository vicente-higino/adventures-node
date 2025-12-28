import { getBotConfig, isChannelLive } from "@/bot";
import { prisma } from "@/prisma";
import { delay, sendActionToChannel, sendMessageToChannel } from "@/utils/misc";
import { PrismaClient } from "@prisma/client";
import { handleAdventureEnd } from "../handleAdventure";
import { getStreamByUserId } from "@/twitch/api";
import logger from "@/logger";

export interface AdventureWarning {
    delay: number; // milliseconds
    message: string;
}

const DEFAULT_WARNINGS: AdventureWarning[] = [
    {
        delay: 30 * 60 * 1000,
        message: `Ending the adventure in 15 minutes! Join now or update your silver with !adventure | !adv to participate! GAMBA`,
    },
    {
        delay: 40 * 60 * 1000,
        message: `Alarm Ending the adventure in 5 minutes! Join now or update your silver with !adventure | !adv to participate! dinkDonk`,
    },
    {
        delay: 43 * 60 * 1000,
        message: `Alarm Ending the adventure in 2 minutes! Join now or update your silver with !adventure | !adv to participate! dinkDonk`,
    },
    { delay: 45 * 60 * 1000, message: `!adventureend` },
];
export const RESTART_WARNINGS: AdventureWarning[] = [
    { delay: 1000, message: `Ending the adventure in 15 minutes! Join now or update your silver with !adventure | !adv to participate! GAMBA` },
    {
        delay: 10 * 60 * 1000,
        message: `Alarm Ending the adventure in 5 minutes! Join now or update your silver with !adventure | !adv to participate! dinkDonk`,
    },
    {
        delay: 13 * 60 * 1000,
        message: `Alarm Ending the adventure in 2 minutes! Join now or update your silver with !adventure | !adv to participate! dinkDonk`,
    },
    { delay: 15 * 60 * 1000, message: `!adventureend` },
];

export function scheduleAdventureWarnings(prisma: PrismaClient, adventureId: number, warnings: AdventureWarning[] = DEFAULT_WARNINGS) {
    const timers: NodeJS.Timeout[] = [];
    for (const { delay, message } of warnings) {
        const timer = setTimeout(async () => {
            const adv = await prisma.adventure.findUnique({ where: { id: adventureId } });
            if (!adv) {
                logger.info(`Adventure ID ${adventureId} not found, skipping warning "${message}"`);
                return;
            }
            const live = await getStreamByUserId(adv?.channelProviderId || "");
            if (adv.name === "DONE" || live) {
                if (live && !isChannelLive(adv.channel)) {
                    logger.info(`Channel ${adv.channel} is mismatched as not live, skipping adventure end warning "${message}"`);
                }
                for (const t of timers) {
                    clearTimeout(t);
                    logger.info("clear timeout #" + t.toString() + " for adventure ID " + adventureId);
                }
                return;
            }
            if (!live) {
                if (message === "!adventureend" && getBotConfig().modChannels.includes(adv.channel)) {
                    const result = await handleAdventureEnd({
                        channelLogin: adv.channel,
                        channelProviderId: adv.channelProviderId,
                        userProviderId: getBotConfig().userId,
                        userLogin: "",
                        userDisplayName: "",
                    });
                    sendMessageToChannel(adv.channel, result);
                } else {
                    sendActionToChannel(adv.channel, message);
                }
            }
        }, delay);
        timer.unref();
        timers.push(timer);
    }
    logger.info(`Scheduled ${timers.length} timers #${timers.join(", #")} adventure warnings for adventure ID ${adventureId}`);
}

export async function restartAdventureWarnings(channelProviderId?: string) {
    // Find all adventures that are not DONE and not ended
    const adventures = await prisma.adventure.findMany({ where: { name: { not: "DONE" }, channelProviderId } });
    for (const adv of adventures) {
        logger.info("Rescheduling adventure warning for channel: " + adv.channel);

        // Calculate the elapsed time since the adventure started
        const startTime = new Date(adv.createdAt).getTime();
        const currentTime = Date.now();
        const elapsedTime = currentTime - startTime;

        const totalDuration = 30 * 60 * 1000;

        // Determine the delayOffset or use default delays if the adventure has passed the end time
        const adjustedWarnings =
            elapsedTime >= totalDuration
                ? RESTART_WARNINGS // Use default delays if the adventure has passed the end time
                : RESTART_WARNINGS.map(warning => ({
                      ...warning,
                      delay: warning.delay + Math.max(0, totalDuration - elapsedTime), // Add the delayOffset
                  }));

        scheduleAdventureWarnings(prisma, adv.id, adjustedWarnings);
    }
}
