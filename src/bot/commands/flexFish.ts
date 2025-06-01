import { createBotCommand } from '../BotCommandWithKeywords';
import { prisma } from "@/prisma"
import { formatSize, formatWeight } from "@/utils/misc";

// Returns the user's single most valuable fish (highest value, most recent if tie)
async function getUserMostValuableFish(userId: string, channelProviderId: string) {
    const fish = await prisma.fish.findFirst({
        where: { userId, channelProviderId },
        orderBy: [
            { value: 'desc' },
            { createdAt: 'desc' }
        ]
    });
    return fish;
}

// Formats a fish object for display in chat
function formatFishDisplay(fish: any) {
    // Use formatWeight and formatSize from misc
    const weightStr = formatWeight(parseFloat(fish.weight));
    const sizeStr = formatSize(parseFloat(fish.size));
    return `[${fish.rarity}] ${fish.prefix} ${fish.name} (${weightStr}, ${sizeStr}) worth ${fish.value} silver`;
}

export const flexFishCommand = createBotCommand('flexfish', async (params, ctx) => {
    const { userId, userDisplayName, broadcasterId, say } = ctx;
    // Fetch the user's most valuable fish
    const fish = await getUserMostValuableFish(userId, broadcasterId);
    if (!fish) {
        say(`${userDisplayName}, you don't have any fish to flex! Go fishing first.`);
        return;
    }
    say(`${userDisplayName} most valuable fish: ${formatFishDisplay(fish)}. EZ`);
}, { ignoreCase: true });
