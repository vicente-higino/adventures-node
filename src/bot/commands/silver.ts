import { createBotCommand } from '../BotCommandWithKeywords';
import { getUserSilverString } from '@/common/userSilver';
import { getUserByUsername } from '@/twitch/api';
import { prisma } from '@/prisma';
import { isChannelLive } from '@/bot';

export const silverCommand = createBotCommand('silver', async (params, ctx) => {
    let { broadcasterId, broadcasterName, userDisplayName, userId, userName, say } = ctx;
    if (isChannelLive(broadcasterId)) {
        return;
    }
    let usernameArg = params.shift();
    if (usernameArg) {
        usernameArg = usernameArg.replaceAll("@", "")
        const user = await getUserByUsername(prisma, usernameArg);
        userId = user?.id ?? userId;
        userName = user?.login ?? userName;
        userDisplayName = user?.displayName ?? userDisplayName;
    }
    const result = await getUserSilverString({
        prisma,
        channelLogin: broadcasterName,
        channelProviderId: broadcasterId,
        userProviderId: userId,
        userLogin: userName,
        userDisplayName,
    });
    say(result);
}, { aliases: ["ilver"] });
