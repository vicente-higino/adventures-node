import { prisma } from "@/prisma";
import { getUserByUsername } from "@/twitch/api";
import { createBotCommand } from "../BotCommandWithKeywords";
import { handleDuelCancel } from "@/common/handleDuels";

export const duelCancelCommand = createBotCommand(
    "cancelduel",
    async (params, ctx) => {
        const { broadcasterId, userDisplayName, userId, say } = ctx;
        let usernameArg = params.shift();
        let challengedId: string | undefined;
        if (usernameArg && usernameArg.length > 0) {
            const user = await getUserByUsername(prisma, usernameArg.replaceAll("@", ""));
            if (!user) {
                say(`@${userDisplayName}, user not found.`);
                return;
            }
            challengedId = user.id;
        }
        const result = await handleDuelCancel({ channelProviderId: broadcasterId, currentUserId: userId, userDisplayName, challengedId });
        say(result);
    },
    { aliases: ["deny"], ignoreCase: true },
);
