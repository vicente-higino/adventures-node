import { ADVENTURE_CHECK_LABELS, ADVENTURE_ITEM_SLOTS, getAdventureItem, isAdventureCheck } from "@/adventures/rpg";
import { getBotPrefix } from "@/bot";
import { findAdventureProfile, findOrCreateAdventureProfile } from "@/common/adventureProfiles";
import { prisma } from "@/prisma";
import { AdventureItemType } from "@prisma/client";
import { createBotCommand } from "../botCommandWithKeywords";

type ProfileWithInventory = NonNullable<Awaited<ReturnType<typeof findAdventureProfile>>>;
type OwnedItem = ProfileWithInventory["inventoryItems"][number];

function normalize(value: string): string {
    return value
        .trim()
        .toLowerCase()
        .replaceAll("_", " ")
        .replace(/[^a-z0-9]+/g, "");
}

function matchOwnedItem(items: readonly OwnedItem[], input: string): { item?: OwnedItem; ambiguous?: OwnedItem[] } {
    const normalized = normalize(input);
    if (!normalized) return {};

    const exact = items.filter(inventory => normalize(inventory.item.code) === normalized || normalize(inventory.item.name) === normalized);
    if (exact.length === 1) return { item: exact[0] };
    if (exact.length > 1) return { ambiguous: exact };

    const partial = items.filter(
        inventory => normalize(inventory.item.name).includes(normalized) || normalize(inventory.item.code).includes(normalized),
    );
    if (partial.length === 1) return { item: partial[0] };
    return partial.length > 1 ? { ambiguous: partial } : {};
}

function ambiguousMessage(items: readonly OwnedItem[]): string {
    return items
        .slice(0, 5)
        .map(inventory => inventory.item.name.replaceAll(" ", "_"))
        .join(", ");
}

async function loadProfile(ctx: {
    broadcasterId: string;
    broadcasterName: string;
    userId: string;
    userName: string;
    userDisplayName: string;
}): Promise<ProfileWithInventory> {
    await findOrCreateAdventureProfile({
        channelLogin: ctx.broadcasterName,
        channelProviderId: ctx.broadcasterId,
        userProviderId: ctx.userId,
        userLogin: ctx.userName,
        userDisplayName: ctx.userDisplayName,
    });
    return (await findAdventureProfile(ctx.broadcasterId, ctx.userId))!;
}

export const adventureEquipCommand = createBotCommand(
    "equip",
    async (params, ctx) => {
        const input = params.join(" ");
        if (!input) {
            ctx.say(`@${ctx.userDisplayName} Usage: ${getBotPrefix()}equip <item_name>. See ${getBotPrefix()}inventory for owned gear.`);
            return;
        }

        const profile = await loadProfile(ctx);
        const equippable = profile.inventoryItems.filter(
            inventory => inventory.quantity > 0 && inventory.item.active && inventory.item.type === AdventureItemType.EQUIPMENT,
        );
        const match = matchOwnedItem(equippable, input);
        if (match.ambiguous) {
            ctx.say(`@${ctx.userDisplayName} Be more specific: ${ambiguousMessage(match.ambiguous)}.`);
            return;
        }
        if (!match.item) {
            ctx.say(`@${ctx.userDisplayName} You do not own equippable gear matching "${input}" in this channel.`);
            return;
        }

        const inventory = match.item;
        const definition = getAdventureItem(inventory.item.code);
        if (!definition || definition.kind !== "equipment" || definition.slot === "none") {
            ctx.say(`@${ctx.userDisplayName} ${inventory.item.name} cannot be equipped.`);
            return;
        }
        if (inventory.equippedSlot === definition.slot) {
            ctx.say(`@${ctx.userDisplayName} ${inventory.item.name} is already equipped in your ${definition.slot} slot.`);
            return;
        }

        await prisma.$transaction([
            prisma.adventureInventoryItem.updateMany({
                where: { profileId: profile.id, equippedSlot: definition.slot, id: { not: inventory.id } },
                data: { equippedSlot: null },
            }),
            prisma.adventureInventoryItem.update({ where: { id: inventory.id }, data: { equippedSlot: definition.slot } }),
        ]);

        ctx.say(
            `@${ctx.userDisplayName} Equipped ${inventory.item.name} [${definition.slot}],  ${ADVENTURE_CHECK_LABELS[definition.bonus.check]} +${definition.bonus.modifier} in ${definition.theme} adventures.`,
        );
    },
    { aliases: ["advequip"], ignoreCase: true },
);

export const adventureUnequipCommand = createBotCommand(
    "unequip",
    async (params, ctx) => {
        const input = params.join(" ");
        if (!input) {
            ctx.say(`@${ctx.userDisplayName} Usage: ${getBotPrefix()}unequip <slot|item_name|all>.`);
            return;
        }

        const profile = await loadProfile(ctx);
        const equipped = profile.inventoryItems.filter(inventory => inventory.equippedSlot && inventory.quantity > 0);
        if (equipped.length === 0) {
            ctx.say(`@${ctx.userDisplayName} You have no adventure gear equipped.`);
            return;
        }

        const normalizedInput = input.trim().toLowerCase();
        if (normalizedInput === "all") {
            await prisma.adventureInventoryItem.updateMany({
                where: { profileId: profile.id, equippedSlot: { not: null } },
                data: { equippedSlot: null },
            });
            ctx.say(`@${ctx.userDisplayName} Unequipped all adventure gear.`);
            return;
        }

        const slot = ADVENTURE_ITEM_SLOTS.find(candidate => candidate !== "none" && candidate === normalizedInput);
        if (slot) {
            const item = equipped.find(inventory => inventory.equippedSlot === slot);
            if (!item) {
                ctx.say(`@${ctx.userDisplayName} Your ${slot} slot is already empty.`);
                return;
            }
            await prisma.adventureInventoryItem.update({ where: { id: item.id }, data: { equippedSlot: null } });
            ctx.say(`@${ctx.userDisplayName} Unequipped ${item.item.name} from your ${slot} slot.`);
            return;
        }

        const match = matchOwnedItem(equipped, input);
        if (match.ambiguous) {
            ctx.say(`@${ctx.userDisplayName} Be more specific: ${ambiguousMessage(match.ambiguous)}.`);
            return;
        }
        if (!match.item) {
            ctx.say(`@${ctx.userDisplayName} No equipped item matches "${input}".`);
            return;
        }

        const oldSlot = match.item.equippedSlot;
        await prisma.adventureInventoryItem.update({ where: { id: match.item.id }, data: { equippedSlot: null } });
        ctx.say(`@${ctx.userDisplayName} Unequipped ${match.item.item.name} from your ${oldSlot} slot.`);
    },
    { aliases: ["advunequip"], ignoreCase: true },
);
