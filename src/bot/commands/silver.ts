import { createBotCommand } from "../BotCommandWithKeywords";
import { getUserSilverString } from "@/common/userSilver";
import { getUserByUsername } from "@/twitch/api";
import { prisma } from "@/prisma";

export const silverCommand = createBotCommand(
    "silver",
    async (params, ctx) => {
        const { broadcasterId, broadcasterName, say } = ctx;
        let { userDisplayName, userId, userName } = ctx;
        let usernameArg = params.shift();
        if (usernameArg) {
            usernameArg = usernameArg.replaceAll("@", "");
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
    },
    { aliases: ["ilver"] },
);
