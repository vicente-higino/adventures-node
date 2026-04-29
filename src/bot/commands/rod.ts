import { createBotCommand } from "../botCommandWithKeywords";
import { getBotConfig } from "@/bot";
import { prisma } from "@/prisma";
import { findOrCreateBalance, findOrCreateFishStats, increaseBalance } from "@/db";
import { fishingRodLevels } from "@/fishing/constants";
import logger from "@/logger";

// Rod upgrade costs (silver needed to upgrade to next level)
const ROD_UPGRADE_COSTS: Record<number, number> = {
    0: 500,      // Wooden to Reinforced
    1: 2500,     // Reinforced to Fiberglass
    2: 10000,     // Fiberglass to Carbon Fiber
    3: 50000,     // Carbon Fiber to Titanium
    4: 100000,    // Titanium to Mythril
    5: 500000,    // Mythril to Legendary
};

export const rodCommand = createBotCommand(
    "rod",
    async (params, ctx) => {
        const { broadcasterId, broadcasterName, userDisplayName, userId, userName, say } = ctx;
        try {
            const balance = await findOrCreateBalance(prisma, broadcasterName, broadcasterId, userId, userName, userDisplayName);
            const fishStats = await findOrCreateFishStats(prisma, broadcasterName, broadcasterId, userId, userName, userDisplayName);

            const subcommand = params[0]?.toLowerCase();

            if (subcommand === "list" || !subcommand) {
                const currentLevel = fishStats.fishingRodLevel;
                const currentRod = fishingRodLevels[currentLevel];
                let listMessage = `@${userDisplayName} [CURRENT] ${currentRod.name}`;

                if (currentLevel < fishingRodLevels.length - 1) {
                    const nextRod = fishingRodLevels[currentLevel + 1];
                    const cost = ROD_UPGRADE_COSTS[currentLevel];
                    const cumulativeCost = Object.entries(ROD_UPGRADE_COSTS)
                        .filter(([i]) => parseInt(i) <= currentLevel)
                        .reduce((sum, [, val]) => sum + val, 0);
                    listMessage += ` | Next: ${nextRod.name} (${cost} silver) | Total needed: ${cumulativeCost} silver`;
                } else {
                    listMessage += ` | [MAX LEVEL]`;
                }
                say(listMessage);
            } else if (subcommand === "buy" || subcommand === "upgrade") {
                const currentLevel = fishStats.fishingRodLevel;
                if (currentLevel >= fishingRodLevels.length - 1) {
                    say(`@${userDisplayName} You already have the Legendary Rod!`);
                    return;
                }
                let cumulativeCost = 0;
                for (let i = 0; i <= currentLevel; i++) {
                    cumulativeCost += ROD_UPGRADE_COSTS[i];
                }

                const cost = ROD_UPGRADE_COSTS[currentLevel];
                const nextRod = fishingRodLevels[currentLevel + 1];

                if (fishStats.totalSilverWorth < cumulativeCost) {
                    const needed = cumulativeCost - fishStats.totalSilverWorth;
                    say(
                        `@${userDisplayName} You need to earn ${needed} more silver from fishing to upgrade to ${nextRod.name}.`,
                    );
                    return;
                }

                if (balance.value < cost) {
                    const needed = cost - Number(balance.value);
                    say(`@${userDisplayName} You need ${needed} more silver to upgrade to ${nextRod.name}. You have ${balance.value} silver.`);
                    return;
                }

                await Promise.all([
                    increaseBalance(prisma, balance.id, -cost),
                    prisma.fishStats.update({
                        where: { id: fishStats.id },
                        data: { fishingRodLevel: { increment: 1 } },
                    }),
                ]);

                say(
                    `@${userDisplayName} Upgraded to ${nextRod.name}! You spent ${cost} silver and have ${balance.value - cost} silver left.`,
                );
            } else {
                say(`@${userDisplayName} Usage: ${getBotConfig().prefix}rod or ${getBotConfig().prefix}rod buy`);
            }
        } catch (err) {
            logger.error(err, "Shop command error");
            say(`@${userDisplayName} Something went wrong while processing your shop request.`);
        }
    },
    { ignoreCase: true },
);
