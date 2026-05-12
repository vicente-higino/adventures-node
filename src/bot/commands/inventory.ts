import { prisma } from "@/prisma";
import { createBotCommand } from "../botCommandWithKeywords";
import logger from "@/logger";

export const inventoryCommand = createBotCommand(
    "inventory",
    async (params, ctx) => {
        const { broadcasterId, userDisplayName, userId, say } = ctx;
        const inv = await prisma.userRedeemable.findMany({
            where: {
                userId,
                channelProviderId: broadcasterId,
                quantity: {
                    gt: 0
                }
            },
            include: {
                redeemable: true
            }
        });
        logger.debug({ ...inv })
        if (!inv || inv.length === 0) {
            say(`@${userDisplayName} Inventory is empty...`);
            return;
        }
        const items = inv.map(({ quantity, redeemable }) => {
            return `[${quantity}] - ${redeemable.name}`;
        });
        say(`@${userDisplayName} Inventory:$(newline)${items.join(" | ")}`);
    },
    { aliases: ["inv"], ignoreCase: true },
);
