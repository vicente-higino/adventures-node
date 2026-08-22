import { checkIfChannelIsForcedSend, getBotConfig, isChannelLive, sendActionToChannelStrict, sendMessageToChannelStrict } from "@/bot";
import { prisma } from "@/prisma";
import { handleAdventureEnd } from "../handleAdventure";
import { getStreamByUserId } from "@/twitch/api";
import logger from "@/logger";
import { ADVENTURE_GAMBA_EMOTE, ADVENTURE_ENDING_EMOTE } from "@/emotes";
import boss from "@/db/boss";
import { createHash } from "node:crypto";

export interface AdventureWarning {
    delay: number; // milliseconds
    message: string;
}

interface AdventureScheduleJobData {
    advId: number;
    message: string;
    generation?: number;
}

function adventureWarningJobId(adventureId: number, generation: number, message: string): string {
    const hex = createHash("sha256").update(`${adventureId}\0${generation}\0${message}`).digest("hex").slice(0, 32);
    return `${hex.slice(0, 8)}-${hex.slice(8, 12)}-${hex.slice(12, 16)}-${hex.slice(16, 20)}-${hex.slice(20)}`;
}

async function enqueueAdventureWarning(adventureId: number, generation: number, warning: AdventureWarning): Promise<void> {
    let lastError: unknown;
    for (let attempt = 0; attempt < 3; attempt += 1) {
        try {
            await boss.sendAfter(
                "adv-schedule",
                { advId: adventureId, message: warning.message, generation },
                {
                    id: adventureWarningJobId(adventureId, generation, warning.message),
                    retryLimit: 5,
                    retryDelay: 10,
                    retryBackoff: true,
                    expireInSeconds: 120,
                },
                warning.delay / 1000,
            );
            return;
        } catch (error) {
            lastError = error;
        }
    }
    throw lastError;
}

const MINUTE_IN_MS = 60 * 1000;

function createWarningsUntilEnd(millisecondsUntilEnd: number): AdventureWarning[] {
    const remaining = Math.max(0, millisecondsUntilEnd);
    const warnings = [
        {
            beforeEnd: 15 * MINUTE_IN_MS,
            message: `Ending the adventure in 15 minutes! Join now or update your silver with !adventure | !adv to participate! ${ADVENTURE_GAMBA_EMOTE()}`,
        },
        {
            beforeEnd: 5 * MINUTE_IN_MS,
            message: `${ADVENTURE_ENDING_EMOTE.Alarm.name} Ending the adventure in 5 minutes! Join now or update your silver with !adventure | !adv to participate! ${ADVENTURE_ENDING_EMOTE.dinkDonk.name}`,
        },
        {
            beforeEnd: 2 * MINUTE_IN_MS,
            message: `${ADVENTURE_ENDING_EMOTE.Alarm.name} Ending the adventure in 2 minutes! Join now or update your silver with !adventure | !adv to participate! ${ADVENTURE_ENDING_EMOTE.dinkDonk.name}`,
        },
        { beforeEnd: 0, message: `!adventureend` },
    ];
    return warnings
        .filter(warning => warning.beforeEnd === 0 || remaining >= warning.beforeEnd)
        .map(warning => ({ delay: Math.max(0, remaining - warning.beforeEnd), message: warning.message }));
}

export async function cancelScheduleAdventureWarnings(adventureId: number) {
    const jobs = await boss.findJobs("adv-schedule", { data: { advId: adventureId }, queued: true });
    for (const job of jobs) {
        await boss.cancel("adv-schedule", job.id);
        logger.info(job.data, `Canceled Adventure Schedule Job #${job.id}`);
    }
}

const RESTART_WARNINGS = createWarningsUntilEnd(15 * MINUTE_IN_MS);

function persistedChatParagraphs(value: unknown): string[] {
    return Array.isArray(value) && value.every(paragraph => typeof paragraph === "string") ? value : [];
}

export async function processWarning(adventureId: number, message: string, generation = 0) {
    const adv = await prisma.adventure.findUnique({ where: { id: adventureId } });
    if (!adv) {
        logger.info(`Adventure ID ${adventureId} not found, skipping warning "${message}"`);
        return;
    }
    if (generation !== adv.scheduleGeneration) {
        logger.info({ adventureId, generation, currentGeneration: adv.scheduleGeneration }, "Skipping a stale adventure warning");
        return;
    }
    if (adv.status === "RESOLVED") {
        await cancelScheduleAdventureWarnings(adventureId);
        if (message === "!adventureend") {
            const paragraphs = persistedChatParagraphs(adv.finalChatResult);
            if (paragraphs.length === 0) throw new Error(`Resolved adventure ${adventureId} has no persisted chat result.`);
            for (const paragraph of paragraphs) await sendMessageToChannelStrict(adv.channel, paragraph);
        }
        return;
    }
    if (adv.status === "CANCELLED") {
        await cancelScheduleAdventureWarnings(adventureId);
        return;
    }
    if (adv.status === "RESOLVING") throw new Error(`Adventure ${adventureId} is still resolving.`);

    const live = await getStreamByUserId(adv.channelProviderId);
    const isForceSend = checkIfChannelIsForcedSend({ id: adv.channelProviderId });
    if (live && !isForceSend) {
        if (!isChannelLive({ id: adv.channelProviderId })) {
            logger.info(`Channel ${adv.channel} is mismatched as not live, pausing adventure warning "${message}"`);
        }
        const paused = await prisma.adventure.updateMany({
            where: { id: adventureId, status: "OPEN", scheduleGeneration: generation },
            data: { schedulePaused: true },
        });
        if (paused.count === 1) await cancelScheduleAdventureWarnings(adventureId);
        return;
    }
    if (!live || isForceSend) {
        if (message === "!adventureend") {
            const result = await handleAdventureEnd({
                channelLogin: adv.channel,
                channelProviderId: adv.channelProviderId,
                userProviderId: getBotConfig().userId,
                userLogin: "",
                userDisplayName: "",
                throwOnError: true,
            });
            const settled = await prisma.adventure.findUnique({ where: { id: adventureId }, select: { status: true, finalChatResult: true } });
            if (settled?.status === "RESOLVING") throw new Error(`Adventure ${adventureId} is still resolving.`);
            const persisted = persistedChatParagraphs(settled?.finalChatResult);
            const paragraphs = persisted.length
                ? persisted
                : result
                      .split("$(newline)")
                      .map(part => part.trim())
                      .filter(Boolean);
            for (const paragraph of paragraphs) {
                await sendMessageToChannelStrict(adv.channel, paragraph);
            }
        } else {
            await sendActionToChannelStrict(adv.channel, message);
        }
    }
}
export async function scheduleAdventureWarnings(adventureId: number, warnings?: AdventureWarning[], generation?: number) {
    const adventureState =
        generation === undefined || warnings === undefined
            ? await prisma.adventure.findUniqueOrThrow({
                  where: { id: adventureId },
                  select: { scheduleGeneration: true, createdAt: true, endsAt: true },
              })
            : undefined;
    const currentGeneration = generation ?? adventureState!.scheduleGeneration;
    const endsAt = adventureState?.endsAt ?? (adventureState ? new Date(adventureState.createdAt.getTime() + 45 * MINUTE_IN_MS) : undefined);
    const warningsToSchedule = warnings ?? createWarningsUntilEnd(endsAt!.getTime() - Date.now());
    const jobs = await boss.findJobs<AdventureScheduleJobData>("adv-schedule", { data: { advId: adventureId }, queued: true });
    const queuedMessages = new Set(jobs.filter(job => (job.data.generation ?? 0) === currentGeneration).map(job => job.data.message));
    for (const warning of warningsToSchedule) {
        if (queuedMessages.has(warning.message)) continue;
        await enqueueAdventureWarning(adventureId, currentGeneration, warning);
    }
}

export async function restartAdventureWarnings(channelProviderId?: string) {
    const adventures = await prisma.adventure.findMany({ where: { name: { not: "DONE" }, status: "OPEN", schedulePaused: true, channelProviderId } });
    for (const adv of adventures) {
        logger.info("Rescheduling adventure warning for channel: " + adv.channel);
        const resumed = await prisma.adventure.updateMany({
            where: { id: adv.id, status: "OPEN", schedulePaused: true },
            data: { schedulePaused: false, scheduleGeneration: { increment: 1 }, endsAt: new Date(Date.now() + 15 * MINUTE_IN_MS) },
        });
        if (resumed.count === 0) continue;
        const current = await prisma.adventure.findUniqueOrThrow({ where: { id: adv.id }, select: { scheduleGeneration: true } });
        try {
            await scheduleAdventureWarnings(adv.id, RESTART_WARNINGS, current.scheduleGeneration);
        } catch (error) {
            await prisma.adventure.updateMany({
                where: { id: adv.id, status: "OPEN", scheduleGeneration: current.scheduleGeneration },
                data: { schedulePaused: true },
            });
            throw error;
        }
    }
}

/** Repairs missing jobs after startup or a partial PgBoss write. */
export async function reconcileAdventureWarnings() {
    const adventures = await prisma.adventure.findMany({
        where: { name: { not: "DONE" }, status: "OPEN", schedulePaused: false },
        select: { id: true, channel: true, createdAt: true, endsAt: true, scheduleGeneration: true },
    });
    for (const adventure of adventures) {
        const endsAt = adventure.endsAt ?? new Date(adventure.createdAt.getTime() + 45 * MINUTE_IN_MS);
        logger.info({ adventureId: adventure.id, channel: adventure.channel, endsAt }, "Reconciling adventure warning schedule");
        await scheduleAdventureWarnings(adventure.id, createWarningsUntilEnd(endsAt.getTime() - Date.now()), adventure.scheduleGeneration);
    }
}
