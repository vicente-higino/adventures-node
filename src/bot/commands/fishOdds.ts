import { fishingRodLevels } from "@/fishing/constants";
import { createBotCommand } from "../botCommandWithKeywords";
import { formatRarityWeightDisplay, getRarityWeights } from "@/fishing/rarities";
import { prisma } from "@/prisma";
import { getUserByUsername } from "@/twitch/api";
import { getRod } from "@/fishing";
import logger from "@/logger";

const rodLevelToNameMap = new Map(fishingRodLevels.map(rod => [rod.level, rod.name]));
const rodEmoteToNameMap = new Map(fishingRodLevels.map(rod => [`(${rod.name.replaceAll(" ", "_").toLowerCase()})`, rod]));

export const fishOddsCommand = createBotCommand(
    "fishingodds",
    async (params, ctx) => {
        let { msg, say, userId, broadcasterId, userDisplayName } = ctx;
        const param = params.shift()?.toLowerCase().replaceAll("@", "");
        if (param) {
            let rod = fishingRodLevels.find(rod => rod.name.toLowerCase().includes(param));
            if (rod) {
                const weights = getRarityWeights(rod.level);
                say(`${rod.name} odds: ${formatRarityWeightDisplay(weights)}`);
                return;
            }
            logger.debug(`No rod found matching "${param}". Checking for emote match...`);
            logger.debug(`Available emotes: ${[...rodEmoteToNameMap.keys()].join(", ")}`);
            rod = rodEmoteToNameMap.get(param);
            if (rod) {
                const weights = getRarityWeights(rod.level);
                say(`${rod.name} odds: ${formatRarityWeightDisplay(weights)}`);
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
            say(`Fishing odds: ${formatRarityWeightDisplay()}`);
            return;
        }
        let rodLevel = fishStats.activeRodLevel;
        const rod = getRod(rodLevel);
        const weights = getRarityWeights(rodLevel);
        say(`@${userDisplayName} ${rod.name} odds: ${formatRarityWeightDisplay(weights)}`);
    },
    { ignoreCase: true, aliases: ["fishodds", "fishingodd", "fo"] },
);
