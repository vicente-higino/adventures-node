import { formatQualityOddsDisplay, getRod } from "@/fishing";
import { fishingRodLevels } from "@/fishing/constants";
import logger from "@/logger";
import { prisma } from "@/prisma";
import { getUserByUsername } from "@/twitch/api";
import { createBotCommand } from "@/bot/botCommandWithKeywords";

const rodLookup = new Map<string, any>();
for (const rod of fishingRodLevels) {
    rodLookup.set(rod.name.toLowerCase(), rod);
    rodLookup.set(`(${rod.name.replaceAll(" ", "_").toLowerCase()})`, rod);
}

export const fishingQualityOddsCommand = createBotCommand(
    "fissingqualityodds",
    async (params, ctx) => {
        let { msg, say, userId, broadcasterId, userDisplayName } = ctx;
        const param = params.shift()?.toLowerCase().replaceAll("@", "");
        if (param) {
            let rod = rodLookup.get(param) ?? fishingRodLevels.find(r => r.name.toLowerCase().includes(param));
            if (rod) {
                say(`${rod.name} ★ odds: ${formatQualityOddsDisplay(rod.qualityChance)}`);
                return;
            }
            logger.debug(`No rod found matching "${param}". Checking for user...`);
            const user = await getUserByUsername(prisma, param);
            if (user) {
                userId = user.id;
                userDisplayName = user.displayName;
            } else {
                say(`@${userDisplayName}, User "${param}" not found.`);
                return;
            }
        }
        const fishStats = await prisma.fishStats.findUnique({ where: { channelProviderId_userId: { channelProviderId: broadcasterId, userId } } });
        if (!fishStats) {
            const defaultRod = getRod(0);
            say(`Fishing ★ odds: ${formatQualityOddsDisplay(defaultRod.qualityChance)}`);
            return;
        }
        let rodLevel = fishStats.activeRodLevel;
        const rod = getRod(rodLevel);
        say(`@${userDisplayName} ${rod.name} ★ odds: ${formatQualityOddsDisplay(rod.qualityChance)}`);
    },
    { ignoreCase: true, aliases: ["fishqualityodds", "fqo"] },
);
