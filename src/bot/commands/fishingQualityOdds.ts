import { formatQualityOddsDisplay, getRod } from "@/fishing";
import { fishingRodLevels } from "@/fishing/constants";
import logger from "@/logger";
import { prisma } from "@/prisma";
import { getUserByUsername } from "@/twitch/api";
import { createBotCommand } from "@/bot/botCommandWithKeywords";

const rodLevelToNameMap = new Map(fishingRodLevels.map(rod => [rod.level, rod.name]));
const rodEmoteToNameMap = new Map(fishingRodLevels.map(rod => [`(${rod.name.replaceAll(" ", "_").toLowerCase()})`, rod]));

export const fishingQualityOddsCommand = createBotCommand(
    "fissingqualityodds",
    async (params, ctx) => {
        let { msg, say, userId, broadcasterId, userDisplayName } = ctx;
        const param = params.shift()?.toLowerCase().replaceAll("@", "");
        if (param) {
            let rod = fishingRodLevels.find(rod => rod.name.toLowerCase().includes(param));
            if (rod) {
                say(`${rod.name} quality odds: ${formatQualityOddsDisplay(rod.qualityChance)}`);
                return;
            }
            logger.debug(`No rod found matching "${param}". Checking for emote match...`);
            logger.debug(`Available emotes: ${[...rodEmoteToNameMap.keys()].join(", ")}`);
            rod = rodEmoteToNameMap.get(param);
            if (rod) {
                say(`${rod.name} quality odds: ${formatQualityOddsDisplay(rod.qualityChance)}`);
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
            say(`Fishing quality odds: ${formatQualityOddsDisplay(defaultRod.qualityChance)}`);
            return;
        }
        let rodLevel = fishStats.activeRodLevel;
        const rod = getRod(rodLevel);
        say(`@${userDisplayName} ${rod.name} quality odds: ${formatQualityOddsDisplay(rod.qualityChance)}`);
    },
    { ignoreCase: true, aliases: ["fishqualityodds", "fqo"] },
);
