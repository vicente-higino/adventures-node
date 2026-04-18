import { checkIfChannelIsForcedSend, getBotConfig, isChannelLive } from "@/bot";
import { prisma } from "@/prisma";
import { sendActionToChannel, sendMessageToChannel } from "@/utils/misc";
import { handleAdventureEnd } from "../handleAdventure";
import { getStreamByUserId } from "@/twitch/api";
import logger from "@/logger";
import { ADVENTURE_GAMBA_EMOTE, ADVENTURE_ENDING_EMOTE } from "@/emotes";
import boss from "@/db/boss";

export interface AdventureWarning {
    delay: number; // milliseconds
    message: string;
}

function createWarnings(offsetInMs: number): AdventureWarning[] {
    offsetInMs = Math.max(0, offsetInMs); // Ensure offset is not negative
    return [
        {
            delay: 0 + offsetInMs,
            message: `Ending the adventure in 15 minutes! Join now or update your silver with !adventure | !adv to participate! ${ADVENTURE_GAMBA_EMOTE()}`,
        },
        {
            delay: 10 * 60 * 1000 + offsetInMs,
            message: `${ADVENTURE_ENDING_EMOTE.Alarm.name} Ending the adventure in 5 minutes! Join now or update your silver with !adventure | !adv to participate! ${ADVENTURE_ENDING_EMOTE.dinkDonk.name}`,
        },
        {
            delay: 13 * 60 * 1000 + offsetInMs,
            message: `${ADVENTURE_ENDING_EMOTE.Alarm.name} Ending the adventure in 2 minutes! Join now or update your silver with !adventure | !adv to participate! ${ADVENTURE_ENDING_EMOTE.dinkDonk.name}`,
        },
        { delay: 15 * 60 * 1000 + offsetInMs, message: `!adventureend` },
    ];
}

export async function cancelScheduleAdventureWarnings(adventureId: number) {
    const jobs = await boss.findJobs("adv-schedule", { data: { advId: adventureId }, queued: true });
    for (const job of jobs) {
        boss.cancel("adv-schedule", job.id);
        logger.info(job.data, `Canceled Adventure Schedule Job #${job.id}`);
    }
}

const DEFAULT_WARNINGS = createWarnings(30 * 60 * 1000);
const RESTART_WARNINGS = createWarnings(0);

export async function processWarning(adventureId: number, message: string) {
    const adv = await prisma.adventure.findUnique({ where: { id: adventureId } });
    if (!adv) {
        logger.info(`Adventure ID ${adventureId} not found, skipping warning "${message}"`);
        return;
    }
    const live = await getStreamByUserId(adv?.channelProviderId || "");
    const isForceSend = checkIfChannelIsForcedSend({ id: adv.channelProviderId });
    if (adv.name === "DONE" || (live && !isForceSend)) {
        if (live && !isChannelLive({ id: adv.channelProviderId })) {
            logger.info(`Channel ${adv.channel} is mismatched as not live, skipping adventure end warning "${message}"`);
        }
        cancelScheduleAdventureWarnings(adventureId);
        return;
    }
    if (!live || isForceSend) {
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
}
export async function scheduleAdventureWarnings(adventureId: number, warnings: AdventureWarning[] = DEFAULT_WARNINGS) {
    const jobs = await boss.findJobs("adv-schedule", { data: { advId: adventureId }, queued: true });
    if (jobs.length > 0) {
        logger.info({ jobs, adventureId }, "Warnings for adventure already scheduled");
        return;
    }
    for (const { delay, message } of warnings) {
        await boss.sendAfter("adv-schedule", { advId: adventureId, message }, null, delay / 1000);
    }
}

export async function restartAdventureWarnings(channelProviderId?: string) {
    // Find all adventures that are not DONE and not ended
    const adventures = await prisma.adventure.findMany({ where: { name: { not: "DONE" }, channelProviderId } });
    for (const adv of adventures) {
        logger.info("Rescheduling adventure warning for channel: " + adv.channel);
        scheduleAdventureWarnings(adv.id, RESTART_WARNINGS);
    }
}
