import { formatUserFishingFineRates } from "@/common/fishingFine";
import { prisma } from "@/prisma";
import { getUserByUsername } from "@/twitch/api";
import { createBotCommand } from "../botCommandWithKeywords";

export const myFishingFineRatesCommand = createBotCommand(
    "myfinerates",
    async (params, { broadcasterId, say, userDisplayName, userId }) => {
        let targetUserId = userId;
        let targetDisplayName = userDisplayName;
        const username = params.shift()?.replaceAll("@", "");

        if (username) {
            const user = await getUserByUsername(prisma, username);
            if (!user) {
                say(`@${userDisplayName}, user "${username}" not found.`);
                return;
            }
            targetUserId = user.id;
            targetDisplayName = user.displayName;
        }

        const balance = await prisma.balance.findUnique({
            where: { channelProviderId_userId: { channelProviderId: broadcasterId, userId: targetUserId } },
            select: { value: true },
        });
        const fishStats = await prisma.fishStats.findUnique({
            where: { channelProviderId_userId: { channelProviderId: broadcasterId, userId: targetUserId } },
            select: { activeRodLevel: true },
        });
        say(formatUserFishingFineRates(targetDisplayName, balance?.value ?? 500, fishStats?.activeRodLevel ?? 0));
    },
    { aliases: ["myfines", "myfine", "fr","fines"], ignoreCase: true },
);
