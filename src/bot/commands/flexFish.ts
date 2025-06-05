import { createBotCommand } from "../BotCommandWithKeywords";
import { prisma } from "@/prisma";
import { formatSize, formatWeight } from "@/utils/misc";
import dayjs from "dayjs";
import utc from "dayjs/plugin/utc";
import calendar from "dayjs/plugin/calendar";
import relativeTime from "dayjs/plugin/relativeTime";
import { Fish } from "@prisma/client";
import z from "zod";
import { getBotConfig } from "..";
dayjs.extend(relativeTime);
dayjs.extend(utc);
dayjs.extend(calendar);
// Returns the user's single most valuable fish (highest value, most recent if tie)
async function getUserMostValuableFish(userId: string, channelProviderId: string) {
    const fish = await prisma.fish.findFirst({ where: { userId, channelProviderId }, orderBy: [{ value: "desc" }, { createdAt: "desc" }] });
    return fish;
}

// Formats a fish object for display in chat
function formatFishDisplay(fish: Fish) {
    // Use formatWeight and formatSize from misc
    const weightStr = formatWeight(parseFloat(fish.weight));
    const sizeStr = formatSize(parseFloat(fish.size));
    const caughtAgo = dayjs(fish.createdAt).fromNow();
    const caughtDateUTC = dayjs.utc(fish.createdAt).calendar(null, {
        sameDay: "[Today at] hh:mm UTC", // The same day ( Today at 2:30 AM )
        nextDay: "[Tomorrow at] hh:mm UTC", // The next day ( Tomorrow at 2:30 AM )
        nextWeek: "dddd [at] hh:mm UTC", // The next week ( Sunday at 2:30 AM )
        lastDay: "[Yesterday at] hh:mm UTC", // The day before ( Yesterday at 2:30 AM )
        lastWeek: "[Last] dddd [at] hh:mm UTC", // Last week ( Last Monday at 2:30 AM )
        sameElse: "DD/MM/YYYY", // Everything else ( 17/10/2011 )
    });
    return `[${fish.rarity}] ${fish.prefix} ${fish.name} (${weightStr}, ${sizeStr}) worth ${fish.value} silver - caught ${caughtAgo} (${caughtDateUTC})`;
}

export const flexFishCommand = createBotCommand(
    "flexfish",
    async (params, ctx) => {
        const { userId, userDisplayName, broadcasterId, say } = ctx;
        const [first] = params;

        let fish;
        let flexLabel = "most valuable fish";
        if (first) {
            // Use zod to validate and extract id with #
            const idSchema = z.string().regex(/^#\d+$/, { message: "Must start with # followed by a number" });
            const idParsed = idSchema.safeParse(first);
            if (!idParsed.success) {
                say(`${userDisplayName}, invalid fish id. Usage: ${getBotConfig().prefix}flexfish [#fishId]`);
                return;
            }
            const fishId = Number(first.slice(1));
            fish = await prisma.fish.findFirst({ where: { id: fishId, userId, channelProviderId: broadcasterId } });
            if (!fish) {
                say(`${userDisplayName}, you don't own a fish with id ${fishId}.`);
                return;
            }
            flexLabel = `fish #${fishId}`;
        } else {
            // Fetch the user's most valuable fish
            fish = await getUserMostValuableFish(userId, broadcasterId);
            if (!fish) {
                say(`${userDisplayName}, you don't have any fish to flex! Go fishing first.`);
                return;
            }
        }
        say(`${userDisplayName} ${flexLabel}: ${formatFishDisplay(fish)}. EZ`);
    },
    { ignoreCase: true },
);
