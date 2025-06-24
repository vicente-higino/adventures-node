import { createBotCommand } from "../BotCommandWithKeywords";
import { getFishRecordStats } from "@/common/fishRecordStats";
import { prisma } from "@/prisma";
import { getUserByUsername } from "@/twitch/api";
import { getBotConfig } from "@/bot";

export const fishRecordsCommand = createBotCommand(
    "fishrecords",
    async (params, ctx) => {
        let { broadcasterId, userDisplayName, userId, userName, say } = ctx;
        let page = 1;
        let username: string | undefined;

        // Parse parameters
        for (const param of params) {
            const parsedPage = parseInt(param);
            if (!isNaN(parsedPage)) {
                page = parsedPage;
            } else if (param.startsWith("@")) {
                username = param.substring(1);
            } else {
                username = param;
            }
        }

        if (username) {
            const user = await getUserByUsername(prisma, username);
            if (user) {
                userId = user.id;
                userName = user.login;
                userDisplayName = user.displayName;
            }
        }

        const { text: recordsText, totalPages } = await getFishRecordStats({
            prisma,
            channelProviderId: broadcasterId,
            userProviderId: userId,
            page,
        });

        // Handle invalid page numbers
        if (page < 1 || page > totalPages) {
            say(
                `@${userDisplayName}, invalid page number. Available pages: 1-${totalPages}. Usage: ${getBotConfig().prefix}fishrecords [@username] [page]`,
            );
            return;
        }

        say(`@${userDisplayName} [${page}/${totalPages}] ${recordsText}`);
    },
    { aliases: ["fishrecs", "fishrecord"], ignoreCase: true },
);
