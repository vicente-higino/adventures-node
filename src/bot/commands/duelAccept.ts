import { prisma } from "@/prisma";
import { getUserByUsername } from "@/twitch/api";
import { createBotCommand } from "../BotCommandWithKeywords";
import { handleDuelAccept } from "@/common/handleDuels";

export const duelAcceptCommand = createBotCommand(
    "accept",
    async (params, ctx) => {
        const { broadcasterId, broadcasterName, userDisplayName, userId, userName, say } = ctx;
        let usernameArg = params.shift();
        let challengerId: string | undefined;
        if (usernameArg && usernameArg.length > 0) {
            const user = await getUserByUsername(prisma, usernameArg.replaceAll("@", ""));
            if (!user) {
                say(`@${userDisplayName}, user not found.`);
                return;
            }
            challengerId = user.id;
        }
        const result = await handleDuelAccept({
            channelLogin: broadcasterName,
            channelProviderId: broadcasterId,
            challengedId: userId,
            userlogin: userName,
            userDisplayName,
            challengerId,
        });
        say(result);
    },
    { aliases: [], ignoreCase: true },
);
