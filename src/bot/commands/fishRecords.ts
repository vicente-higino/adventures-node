import { createBotCommand } from '../BotCommandWithKeywords';
import { getFishRecordStats } from '@/common/fishCountSummary';
import { prisma } from '@/prisma';
import { getUserByUsername } from '@/twitch/api';

export const fishRecordsCommand = createBotCommand('fishrecords', async (params, ctx) => {
    let { broadcasterId, userDisplayName, userId, userName, say } = ctx;
    let usernameArg = params.shift();
    if (usernameArg) {
        usernameArg = usernameArg.replaceAll("@", "")
        const user = await getUserByUsername(prisma, usernameArg);
        userId = user?.id ?? userId;
        userName = user?.login ?? userName;
        userDisplayName = user?.displayName ?? userDisplayName;
    }
    const recordsText = await getFishRecordStats({
        prisma,
        channelProviderId: broadcasterId,
        userProviderId: userId,
    });
    say(`@${userDisplayName} ${recordsText}`);
}, { aliases: ["fishrecs"], ignoreCase: true });
