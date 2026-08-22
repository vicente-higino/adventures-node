import { prisma } from "@/prisma";
import { RedeemableType } from "@prisma/client";
import { createBotCommand } from "../botCommandWithKeywords";
import logger from "@/logger";
import { getBotPrefix } from "@/bot";
import { assertNever } from "@/utils/misc";
import { ADVENTURE_CHECK_LABELS, getAdventureItem, isAdventureCheck } from "@/adventures/rpg";
import { findAdventureProfile } from "@/common/adventureProfiles";
import { parseInventoryView } from "./inventoryView";

function getCommand(type: RedeemableType) {
    switch (type) {
        case "START_ADVENTURE_MULTIPLIER":
            return `(${getBotPrefix()}adv2x)`;
        case "START_LEGENDARY_EVENT":
            return `(${getBotPrefix()}sle)`;
        case "LEGENDARY_BAIT":
            return `(Free legendary fish)`;
        default:
            assertNever(type);
    }
}

export const inventoryCommand = createBotCommand(
    "inventory",
    async (params, ctx) => {
        const { broadcasterId, broadcasterName, userDisplayName, userId, say } = ctx;
        const view = parseInventoryView(params);
        if (view.mode === "invalid") {
            say(`@${userDisplayName} Usage: ${getBotPrefix()}inv [loot [page]].`);
            return;
        }

        if (view.mode === "tickets") {
            const inv = await prisma.userRedeemable.findMany({
                where: { userId, channelProviderId: broadcasterId, quantity: { gt: 0 } },
                include: { redeemable: true },
            });
            logger.trace({ ...inv }, "%s Ticket inventory on channel %s", userDisplayName, broadcasterName);
            if (inv.length === 0) {
                say(`@${userDisplayName} Ticket inventory is empty. Use ${getBotPrefix()}inv loot to view adventure loot.`);
                return;
            }
            const redeemableItems = inv.map(({ quantity, redeemable }) => `[${quantity}] - ${redeemable.name} ${getCommand(redeemable.type)}`);
            say(`@${userDisplayName} Inventory: Tickets: ${redeemableItems.join(" | ")}`);
            return;
        }

        const profile = await findAdventureProfile(broadcasterId, userId);
        const loot = profile?.inventoryItems ?? [];
        logger.trace({ lootCount: loot.length }, "%s Adventure loot inventory on channel %s", userDisplayName, broadcasterName);
        if (loot.length === 0) {
            say(`@${userDisplayName} Adventure loot inventory is empty.`);
            return;
        }

        const lootPageSize = 8;
        const lootPageCount = Math.max(1, Math.ceil(loot.length / lootPageSize));
        const page = view.page;
        if (page < 1 || page > lootPageCount) {
            say(`@${userDisplayName} Inventory page must be between 1 and ${lootPageCount}.`);
            return;
        }
        const adventureItems = loot.slice((page - 1) * lootPageSize, page * lootPageSize).map(inventory => {
            const definition = getAdventureItem(inventory.item.code);
            const checkCode =
                definition?.bonus.check ?? (inventory.item.checkCode && isAdventureCheck(inventory.item.checkCode) ? inventory.item.checkCode : null);
            const modifier = definition?.bonus.modifier ?? inventory.item.modifier;
            const bonus = checkCode ? ` ${ADVENTURE_CHECK_LABELS[checkCode]} ${modifier >= 0 ? "+" : ""}${modifier}` : "";
            const equipped = inventory.equippedSlot ? ` [equipped: ${inventory.equippedSlot}]` : "";
            return `[${inventory.quantity}] ${inventory.item.name}${bonus}${equipped}`;
        });
        say(`@${userDisplayName} Adventure loot ${page}/${lootPageCount}: ${adventureItems.join(" | ")} (use ${getBotPrefix()}equip <item>)`);
    },
    { aliases: ["inv"], ignoreCase: true },
);
