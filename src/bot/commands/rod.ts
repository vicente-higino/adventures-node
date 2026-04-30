import { createBotCommand } from "../botCommandWithKeywords";
import { getBotConfig } from "@/bot";
import { prisma } from "@/prisma";
import { findOrCreateBalance, findOrCreateFishStats, increaseBalance } from "@/db";
import { fishingRodLevels } from "@/fishing/constants";
import logger from "@/logger";
import { formatSilver } from "@/utils/misc";
import { sub } from "date-fns";

// Rod upgrade costs (silver needed to upgrade to next level)
const ROD_UPGRADE_COSTS: Record<number, number> = {
    0: 500,      // Wooden to Reinforced
    1: 5000,     // Reinforced to Fiberglass
    2: 25000,     // Fiberglass to Carbon Fiber
    3: 100000,     // Carbon Fiber to Titanium
    4: 250000,    // Titanium to Mythril
    5: 500000,    // Mythril to Legendary
};

function handleList(
    fishStats: { fishingRodLevel: number },
    userDisplayName: string,
): string {
    const currentLevel = fishStats.fishingRodLevel;
    let listMessage = `@${userDisplayName} Available Rods: `;
    const rods: string[] = [];

    for (let i = 0; i < fishingRodLevels.length; i++) {
        const rod = fishingRodLevels[i];
        const cumulativeCost = Object.entries(ROD_UPGRADE_COSTS)
            .filter(([idx]) => parseInt(idx) < i)
            .reduce((sum, [, val]) => sum + val, 0);
        const individualCost = i > 0 ? ROD_UPGRADE_COSTS[i - 1] : 0;
        const status = i === currentLevel ? "[ACTIVE]" : i < currentLevel ? "[OWN]" : "";
        rods.push(`${status} ${rod.name}${i > 0 ? ` (${formatSilver(individualCost)} silver, ${formatSilver(cumulativeCost)} total)` : ""}`);
    }

    return listMessage + rods.join(" | ");
}

function handleShowCurrent(
    fishStats: { fishingRodLevel: number },
    userDisplayName: string,
): string {
    const currentLevel = fishStats.fishingRodLevel;
    const currentRod = fishingRodLevels[currentLevel];
    let listMessage = `@${userDisplayName} [ACTIVE] ${currentRod.name}`;

    if (currentLevel < fishingRodLevels.length - 1) {
        const nextRod = fishingRodLevels[currentLevel + 1];
        const cost = ROD_UPGRADE_COSTS[currentLevel];
        const cumulativeCost = Object.entries(ROD_UPGRADE_COSTS)
            .filter(([i]) => parseInt(i) <= currentLevel)
            .reduce((sum, [, val]) => sum + val, 0);
        listMessage += ` | Next: ${nextRod.name} (${formatSilver(cost)} silver) | Total needed: ${formatSilver(cumulativeCost)} silver`;
    } else {
        listMessage += ` | [MAX]`;
    }
    return listMessage;
}

async function handleBuyOrUpgrade(
    fishStats: { id: number; fishingRodLevel: number; totalSilverWorth: number },
    balance: { id: number; value: number },
    userDisplayName: string,
): Promise<string> {
    const currentLevel = fishStats.fishingRodLevel;
    if (currentLevel >= fishingRodLevels.length - 1) {
        return `@${userDisplayName} You already have the Legendary Rod!`;
    }
    let cumulativeCost = 0;
    for (let i = 0; i <= currentLevel; i++) {
        cumulativeCost += ROD_UPGRADE_COSTS[i];
    }

    const cost = ROD_UPGRADE_COSTS[currentLevel];
    const nextRod = fishingRodLevels[currentLevel + 1];

    if (fishStats.totalSilverWorth < cumulativeCost) {
        const needed = cumulativeCost - fishStats.totalSilverWorth;
        return `@${userDisplayName} You need to earn ${formatSilver(needed)} more silver from fishing to upgrade to ${nextRod.name}.`;
    }

    if (balance.value < cost) {
        const needed = cost - Number(balance.value);
        return `@${userDisplayName} You need ${formatSilver(needed)} more silver to upgrade to ${nextRod.name}. You have ${formatSilver(balance.value)} silver.`;
    }

    await Promise.all([
        increaseBalance(prisma, balance.id, -cost),
        prisma.fishStats.update({
            where: { id: fishStats.id },
            data: { fishingRodLevel: { increment: 1 } },
        }),
    ]);

    return `@${userDisplayName} Upgraded to ${nextRod.name}! You spent ${formatSilver(cost)} silver and have ${formatSilver(balance.value - cost)} silver left.`;
}

async function handleSelect(
    fishStats: { id: number; fishingRodLevel: number; activeRodLevel: number },
    rodLevelStr: string,
    userDisplayName: string,
): Promise<string> {
    if (!rodLevelStr) {
        return `@${userDisplayName} Usage: ${getBotConfig().prefix}rod select <0-${fishingRodLevels.length - 1}|rod_name>`;
    }

    let selectedLevel = parseInt(rodLevelStr, 10);

    // If it's not a number, try to find by name
    if (isNaN(selectedLevel)) {
        selectedLevel = fishingRodLevels.findIndex(rod => rod.name.toLowerCase().includes(rodLevelStr));
        if (selectedLevel === -1) {
            return `@${userDisplayName} Rod not found. Available rods: ${fishingRodLevels.map(r => r.name).join(", ")}`;
        }
    } else if (selectedLevel < 0 || selectedLevel > fishingRodLevels.length - 1) {
        return `@${userDisplayName} Invalid rod number. Available rods are 0-${fishingRodLevels.length - 1}.`;
    }

    if (selectedLevel > fishStats.fishingRodLevel) {
        const neededRod = fishingRodLevels[selectedLevel];
        return `@${userDisplayName} You don't own the ${neededRod.name} yet. You need to upgrade first.`;
    }

    if (selectedLevel === fishStats.activeRodLevel) {
        return `@${userDisplayName} You already have the ${fishingRodLevels[selectedLevel].name} selected.`;
    }

    await prisma.fishStats.update({
        where: { id: fishStats.id },
        data: { activeRodLevel: selectedLevel },
    });

    return `@${userDisplayName} Selected ${fishingRodLevels[selectedLevel].name}!`;
}

export const rodCommand = createBotCommand(
    "rod",
    async (params, ctx) => {
        const { broadcasterId, broadcasterName, userDisplayName, userId, userName, say } = ctx;
        try {
            const balance = await findOrCreateBalance(prisma, broadcasterName, broadcasterId, userId, userName, userDisplayName);
            const fishStats = await findOrCreateFishStats(prisma, broadcasterName, broadcasterId, userId, userName, userDisplayName);

            const subcommand = params[0]?.toLowerCase();
            let message: string | undefined;

            if (subcommand === "list") {
                message = handleList(fishStats, userDisplayName);
            } else if (!subcommand) {
                message = handleShowCurrent(fishStats, userDisplayName);
            } else if (subcommand === "buy" || subcommand === "upgrade") {
                message = await handleBuyOrUpgrade(fishStats, balance, userDisplayName);
            } else if (subcommand === "select") {
                const rodLevelStr = params[1]?.toLowerCase();
                message = await handleSelect(fishStats, rodLevelStr || "", userDisplayName);
            } else {
                message = `@${userDisplayName} Usage: ${getBotConfig().prefix}rod [list|select <0-${fishingRodLevels.length - 1}|rod_name>|buy]`;
            }
            if (message) {
                say(message);
            }
        } catch (err) {
            logger.error(err, "Shop command error");
            say(`@${userDisplayName} Something went wrong while processing your shop request.`);
        }
    },
    { ignoreCase: true },
);
