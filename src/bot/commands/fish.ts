import { createBotCommand } from '../BotCommandWithKeywords';
import { fishForUser } from '@/common/fishForUser';
import { prisma } from '@/prisma';
import env from '@/env';
import { isChannelLive } from '@/bot';

export const fishCommand = createBotCommand('fish', async (params, ctx) => {
    const { broadcasterId, broadcasterName, userDisplayName, userId, userName, say } = ctx;
    if (isChannelLive(broadcasterId)) {
        return;
    }
    const result = await fishForUser({
        prisma,
        channelLogin: broadcasterName,
        channelProviderId: broadcasterId,
        userProviderId: userId,
        userLogin: userName,
        userDisplayName,
        cooldownHours: env.COOLDOWN_FISHING_IN_HOURS,
    });
    say(result);
}, { ignoreCase: true });
