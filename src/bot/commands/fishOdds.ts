import { createBotCommand } from "../botCommandWithKeywords";
import { formatRarityWeightDisplay, getRarityWeights } from "@/fishing/rarities";
import { prisma } from "@/prisma";

export const fishOddsCommand = createBotCommand(
    "fishingodds",
    async (params, ctx) => {
        const { msg, say, userId, broadcasterId, userDisplayName } = ctx;
        const fishStats = await prisma.fishStats.findUnique({ where: { channelProviderId_userId: { channelProviderId: broadcasterId, userId } } });
        if (!fishStats) {
            say(`Fishing odds: ${formatRarityWeightDisplay()}`);
            return;
        }
        const rodLevel = fishStats.activeRodLevel;
        const weights = getRarityWeights(rodLevel);
        say(`@${userDisplayName} Fishing odds: ${formatRarityWeightDisplay(weights)}`);
    },
    { ignoreCase: true, aliases: ["fishodds", "fishingodd", "fo"] },
);
