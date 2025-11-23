import { createBotCommand } from "../BotCommandWithKeywords";
import { getUserByUsername } from "@/twitch/api";
import { prisma } from "@/prisma";
import z from "zod";

const rankSchema = z.array(z.object({ position: z.coerce.number() })).nonempty();

async function getRank(userId: string, channelProviderId: string) {
    try {
        const [rank, total, balance] = await Promise.all([
            prisma.$queryRaw`
        SELECT position
        FROM (
            SELECT
                "userId",
                ROW_NUMBER() OVER (
                    ORDER BY "value" DESC
                ) AS position
            FROM "Balance"
            WHERE "channelProviderId" = ${channelProviderId}
        ) ranked
        WHERE "userId" = ${userId};`,
            prisma.balance.count({ where: { channelProviderId } }),
            prisma.balance.findUnique({ where: { channelProviderId_userId: { userId, channelProviderId } } }),
        ]);
        const parsedRank = rankSchema.safeParse(rank);
        if (parsedRank.success && balance) {
            return { ...parsedRank.data[0], total, balance: balance.value };
        }
        return null;
    } catch (error) {
        console.error(error);
        return null;
    }
}
export const rankCommand = createBotCommand(
    "rank",
    async (params, ctx) => {
        const { broadcasterId, broadcasterName, say, userDisplayName, userId, userName } = ctx;
        let targetUsername = params.shift() ?? userName;
        targetUsername = targetUsername.replaceAll("@", "");
        const targetUser = await getUserByUsername(prisma, targetUsername);
        if (!targetUser) {
            say(`@${userDisplayName}, User not found: ${targetUsername}`);
            return;
        }
        const result = await getRank(targetUser.id, broadcasterId);
        if (!result) {
            say(`@${userDisplayName}, ${targetUser.displayName} is not on the silver leaderboard.`);
            return;
        }
        say(`@${targetUser.displayName} is rank #${result.position}/${result.total} with ${result.balance} silver on the leaderboard.`);
    },
    { aliases: ["rk"] },
);
