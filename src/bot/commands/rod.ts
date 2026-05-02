import { createBotCommand } from "../botCommandWithKeywords";
import { getBotConfig } from "@/bot";
import { prisma } from "@/prisma";
import { findOrCreateBalance, findOrCreateFishStats, increaseBalance } from "@/db";
import { fishingRodLevels, ROD_UPGRADE_COSTS } from "@/fishing/constants";
import logger from "@/logger";
import { formatSilver } from "@/utils/misc";
import { getRod } from "@/fishing";



function handleList(fishStats: { fishingRodLevel: number }, userDisplayName: string): string {
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

function handleShowCurrent(fishStats: { fishingRodLevel: number, activeRodLevel: number }, userDisplayName: string): string {
    const currentLevel = fishStats.fishingRodLevel;
    const activeLevel = fishStats.activeRodLevel;
    const currentRod = fishingRodLevels[activeLevel];
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
    fishStats: { id: number; fishingRodLevel: number; totalSilverWorth: number, updatedAt: Date },
    balance: { id: number; value: number },
    maxStr: string | undefined,
    userDisplayName: string,
): Promise<string> {
    const currentLevel = fishStats.fishingRodLevel;
    if (currentLevel >= fishingRodLevels.length - 1) {
        return `@${userDisplayName} You already have the Legendary Rod!`;
    }

    let targetLevel = currentLevel + 1;
    if (maxStr === "max") {
        for (let i = currentLevel + 1; i < fishingRodLevels.length; i++) {
            let cumulativeCostForLevel = 0;
            for (let j = 0; j < i; j++) {
                cumulativeCostForLevel += ROD_UPGRADE_COSTS[j];
            }
            if (fishStats.totalSilverWorth >= cumulativeCostForLevel) {
                targetLevel = i;
            } else {
                break;
            }
        }
    } else if (maxStr) {
        return `@${userDisplayName} Invalid argument for buy. Use ${getBotConfig().prefix}rod buy max to upgrade as much as possible.`;
    }

    let targetLevelCumulativeCost = 0;
    for (let i = 0; i < targetLevel; i++) {
        targetLevelCumulativeCost += ROD_UPGRADE_COSTS[i];
    }

    let currentLevelCumulativeCost = 0;
    for (let i = 0; i < currentLevel; i++) {
        currentLevelCumulativeCost += ROD_UPGRADE_COSTS[i];
    }

    const cost = targetLevelCumulativeCost - currentLevelCumulativeCost;
    const targetRod = fishingRodLevels[targetLevel];

    if (fishStats.totalSilverWorth < targetLevelCumulativeCost) {
        const needed = targetLevelCumulativeCost - fishStats.totalSilverWorth;
        return `@${userDisplayName} You need to earn ${formatSilver(needed)} more silver from fishing to upgrade to ${targetRod.name}.`;
    }

    if (balance.value < cost) {
        const needed = cost - Number(balance.value);
        return `@${userDisplayName} You need ${formatSilver(needed)} more silver to upgrade to ${targetRod.name}. You have ${formatSilver(balance.value)} silver.`;
    }

    await Promise.all([
        increaseBalance(prisma, balance.id, -cost),
        prisma.fishStats.update({ where: { id: fishStats.id }, data: { fishingRodLevel: targetLevel, activeRodLevel: targetLevel, updatedAt: fishStats.updatedAt } }),
    ]);

    return `@${userDisplayName} Upgraded to ${targetRod.name}! You spent ${formatSilver(cost)} silver and have ${formatSilver(balance.value - cost)} silver left.`;
}

async function handleSelect(
    fishStats: { id: number; fishingRodLevel: number; activeRodLevel: number, updatedAt: Date },
    rodLevelStr: string,
    userDisplayName: string,
): Promise<string> {
    if (!rodLevelStr) {
        return `@${userDisplayName} Usage: ${getBotConfig().prefix}rod select <0-${fishingRodLevels.length - 1}|rod_name|max>`;
    }

    let selectedLevel: number;

    if (rodLevelStr === "max") {
        selectedLevel = fishStats.fishingRodLevel;
    } else {
        selectedLevel = parseInt(rodLevelStr, 10);

        if (isNaN(selectedLevel)) {
            selectedLevel = fishingRodLevels.findIndex(rod => rod.name.toLowerCase().includes(rodLevelStr));
            if (selectedLevel === -1) {
                return `@${userDisplayName} Rod not found. Available rods: ${fishingRodLevels.map(r => r.name).join(", ")}`;
            }
        } else {
            selectedLevel = getRod(selectedLevel).level;
        }
    }

    if (selectedLevel > fishStats.fishingRodLevel) {
        const neededRod = fishingRodLevels[selectedLevel];
        return `@${userDisplayName} You don't own the ${neededRod.name} yet. You need to upgrade first.`;
    }

    if (selectedLevel === fishStats.activeRodLevel) {
        return `@${userDisplayName} You already have the ${fishingRodLevels[selectedLevel].name} selected.`;
    }

    await prisma.fishStats.update({ where: { id: fishStats.id }, data: { activeRodLevel: selectedLevel, updatedAt: fishStats.updatedAt } });

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
                const maxStr = params[1]?.toLowerCase();
                message = await handleBuyOrUpgrade(fishStats, balance, maxStr, userDisplayName);
            } else if (subcommand === "sel" || subcommand === "select") {
                const rodLevelStr = params[1]?.toLowerCase();
                message = await handleSelect(fishStats, rodLevelStr || "", userDisplayName);
            } else {
                message = `@${userDisplayName} Usage: ${getBotConfig().prefix}rod [list|sel <0-${fishingRodLevels.length - 1}|rod_name>|buy <max>]`;
            }
            if (message) {
                say(message);
            }
        } catch (err) {
            logger.error(err, "Shop command error");
            say(`@${userDisplayName} Something went wrong.`);
        }
    },
    { ignoreCase: true },
);
