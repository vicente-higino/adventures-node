import cron from "node-cron";
import { getBotConfig, isChannelLive } from "@/bot";
import { prisma } from "@/prisma";
import dayjs from "dayjs";
import duration from "dayjs/plugin/duration";
import relativeTime from "dayjs/plugin/relativeTime";
import { formatMinutes } from "@/utils/time";
import { CONGRATULATIONS_EMOTES, EVENT_STARTED_EMOTES, SAD_EMOTES } from "@/emotes";
import { getUsersByUsername } from "@/twitch/api";
import { pickRandom, sendActionToAllChannel, sendActionToChannel, boxMullerTransform, roundToDecimalPlaces } from "@/utils/misc";
import { modifyRarityWeights, resetRarityWeights, getChanceByRarity } from "./rarities";
import logger from "@/logger";

dayjs.extend(duration);
dayjs.extend(relativeTime);

// Replace the three separate variables with a single state object
const legendaryEventState: { active: boolean; timeout: NodeJS.Timeout | null; recordId: number | null } = {
    active: false,
    timeout: null,
    recordId: null,
};

async function endLegendaryEvent(name: string) {
    if (!legendaryEventState.active) return;
    legendaryEventState.active = false;
    resetRarityWeights();
    if (legendaryEventState.timeout) {
        clearTimeout(legendaryEventState.timeout);
        legendaryEventState.timeout = null;
    }
    try {
        if (legendaryEventState.recordId) {
            const ev = await prisma.legendaryEvent.findUnique({ where: { id: legendaryEventState.recordId } });
            if (ev) {
                const startedAt = ev.startedAt;
                const endedAt = new Date();

                // Group by channel and user to produce per-channel stats
                const grouped = await prisma.fish.groupBy({
                    by: ["channelProviderId", "userId"],
                    where: { rarity: "Legendary", createdAt: { gte: startedAt, lte: endedAt } },
                    _count: { id: true },
                });

                // Map channel -> [{ userId, count }]
                const channelMap: Record<string, Array<{ userId: string; count: number }>> = {};
                for (const row of grouped) {
                    const ch = row.channelProviderId;
                    if (!channelMap[ch]) channelMap[ch] = [];
                    channelMap[ch].push({ userId: row.userId, count: row._count.id });
                }

                const allUserIds = Array.from(new Set(grouped.map(g => g.userId)));
                const users =
                    allUserIds.length > 0
                        ? await prisma.user.findMany({ where: { providerId: { in: allUserIds } }, select: { providerId: true, displayName: true } })
                        : [];
                const nameById: Record<string, string> = {};
                for (const u of users) nameById[u.providerId] = u.displayName;

                const { channels: configuredChannels } = getBotConfig();
                const channels = await getUsersByUsername(configuredChannels);
                if (!channels || channels.length === 0) {
                    logger.warn("No configured channels found for legendary event summary.");
                    return;
                }

                for (const channel of channels) {
                    if (isChannelLive(channel.id)) continue;
                    const entries = channelMap[channel.id] || [];
                    const totalLegendary = entries.reduce((s, e) => s + e.count, 0);
                    const uniqueCatchers = entries.length;
                    const top = entries.sort((a, b) => b.count - a.count).slice(0, 3);
                    const topStrings = top.map(t => `${nameById[t.userId] ?? t.userId} (${t.count})`);

                    const endMsg = `The ${name} has ended. Legendary fish odds are back to normal.`;
                    const summary = `Summary: ${totalLegendary} legendary fish caught by ${uniqueCatchers} player${uniqueCatchers === 1 ? "" : "s"}. Top: ${topStrings.join(", ") || "none"}. ${pickRandom(CONGRATULATIONS_EMOTES)}`;
                    const noSummary = `No legendary fish were caught during the event. ${pickRandom(SAD_EMOTES)}`;
                    sendActionToChannel(channel.login, endMsg);
                    if (entries.length > 0) {
                        sendActionToChannel(channel.login, summary);
                    } else {
                        sendActionToChannel(channel.login, noSummary);
                    }
                }

                // mark event inactive in DB
                await prisma.legendaryEvent.update({ where: { id: ev.id }, data: { active: false } });
                legendaryEventState.recordId = null;
                return;
            }
        }
    } catch (err) {
        logger.error(err, "Failed to compute legendary event summary");
    }

    // Fallback announcement if DB not available or something failed
    sendActionToAllChannel(`The ${name} has ended. Legendary fish odds are back to normal.`);
}

export const legendaryEventTaskPerChannel = (channels: string[]) =>
    cron.createTask("*/1 * * * *", c => {
        if (legendaryEventState.active) {
            logger.info(`Legendary event already active, skipping random event.`);
            return;
        }
        // logger.info(`[${c.dateLocalIso}] Running legendary event task for channels: ${channels.join(", ")}`);
        const chance = 5 / (7 * 24 * 60);
        const shouldRun = chance > Math.random();
        if (shouldRun) {
            const legendaryWeight = Math.round(boxMullerTransform(25, 10, 20));
            manualLegendaryEventTask(legendaryWeight, 90 * 60 * 1000);
        }
    });

/**
 * Manually starts a Legendary Fishing Event for the given channels.
 */
export function manualLegendaryEventTask(
    legendaryWeight: number,
    durationMs: number,
    name: string = "Legendary Fishing Event",
    msg: string = "Legendary fish are much more likely for the next",
): boolean {
    if (legendaryEventState.active) {
        return false;
    }
    legendaryEventState.active = true;
    const legendaryChanceBefore = getChanceByRarity("Legendary");
    modifyRarityWeights({ Legendary: legendaryWeight, Common: w => w - legendaryWeight + 1 });
    const legendaryChanceAfter = getChanceByRarity("Legendary");
    const chanceStr = `${roundToDecimalPlaces(legendaryChanceBefore, 2).toFixed(2)}% -> ${roundToDecimalPlaces(legendaryChanceAfter, 2).toFixed(2)}%`;
    sendActionToAllChannel(`A ${name} has started! ${msg} ${formatMinutes(durationMs)}! ${chanceStr} ${pickRandom(EVENT_STARTED_EMOTES)}`);

    // persist event to DB
    prisma.legendaryEvent
        .create({ data: { name, legendaryWeight, message: msg, startedAt: new Date(), endsAt: new Date(Date.now() + durationMs) } })
        .then(rec => {
            legendaryEventState.recordId = rec.id;
        })
        .catch(err => logger.error(err, "Failed to persist legendary event"));

    legendaryEventState.timeout = setTimeout(() => {
        endLegendaryEvent(name);
    }, durationMs);
    return true;
}

export function startLegendaryTasks(): void {
    const { channels } = getBotConfig();
    // resume active event from DB if present
    prisma.legendaryEvent
        .findFirst({ where: { active: true }, orderBy: { startedAt: "desc" } })
        .then(active => {
            if (active) {
                legendaryEventState.active = true;
                legendaryEventState.recordId = active.id;
                // apply weights
                modifyRarityWeights({ Legendary: active.legendaryWeight, Common: w => w - active.legendaryWeight + 1 });
                const remaining = new Date(active.endsAt).getTime() - Date.now();
                if (remaining > 0) {
                    legendaryEventState.timeout = setTimeout(() => endLegendaryEvent(active.name), remaining);
                    // sendActionToAllChannel(`Resuming ${active.name}! Legendary fish are still more likely for the next ${formatMinutes(remaining)}.`);
                } else {
                    // event expired but still marked active in DB; end it
                    endLegendaryEvent(active.name);
                }
            }
        })
        .catch(err => logger.error(err, "Failed to load active legendary event"));

    legendaryEventTaskPerChannel(channels).start();
    cron.schedule(
        "0 0 25 12 *",
        () => {
            manualLegendaryEventTask(
                100,
                24 * 60 * 60 * 1000,
                "Legendary Christmas Event",
                "Holiday magic is in the water, and legendary fish are much more likely for the next",
            );
        },
        { timezone: "UTC" },
    );
}

// Admin helpers
export async function listLegendaryEvents(activeOnly = true) {
    const where = activeOnly ? { active: true } : {};
    return prisma.legendaryEvent.findMany({ where, orderBy: { startedAt: "desc" } });
}

export async function endLegendaryEventById(id: number): Promise<boolean> {
    try {
        const ev = await prisma.legendaryEvent.findUnique({ where: { id } });
        if (!ev || !ev.active) return false;
        // If this is the currently-running event in memory, end it properly
        if (legendaryEventState.recordId === id) {
            endLegendaryEvent(ev.name);
        } else {
            // Mark inactive and announce
            await prisma.legendaryEvent.update({ where: { id }, data: { active: false } });
            sendActionToAllChannel(`The ${ev.name} has been force-ended by an admin.`);
        }
        return true;
    } catch (err) {
        logger.error(err, "Failed to end legendary event by id");
        return false;
    }
}
