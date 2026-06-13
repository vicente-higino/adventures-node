import { prisma } from "@/prisma";
import { RedeemableType } from "@prisma/client";
import { createBotCommand } from "../botCommandWithKeywords";
import logger from "@/logger";
import { getBotPrefix } from "@/bot";
import { assertNever } from "@/utils/misc";

function getCommand(type: RedeemableType) {
    switch (type) {
        case "START_ADVENTURE_MULTIPLIER":
            return `(${getBotPrefix()}adv2x)`;
        case "START_LEGENDARY_EVENT":
            return `(${getBotPrefix()}sle)`;
        default:
            assertNever(type);
    }
}

export const inventoryCommand = createBotCommand(
    "inventory",
    async (params, ctx) => {
        const { broadcasterId, broadcasterName, userDisplayName, userId, say } = ctx;
        const inv = await prisma.userRedeemable.findMany({
            where: { userId, channelProviderId: broadcasterId, quantity: { gt: 0 } },
            include: { redeemable: true },
        });
        logger.trace({ ...inv }, "%s Invetory on channel %s", userDisplayName, broadcasterName);
        if (!inv || inv.length === 0) {
            say(`@${userDisplayName} Inventory is empty...`);
            return;
        }
        const items = inv.map(({ quantity, redeemable }) => {
            return `[${quantity}] - ${redeemable.name} ${getCommand(redeemable.type)}`;
        });
        say(`@${userDisplayName} Inventory:$(newline)${items.join(" | ")}`);
    },
    { aliases: ["inv"], ignoreCase: true },
);
