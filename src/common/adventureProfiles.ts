import {
    ADVENTURE_ITEMS,
    getAdventureItem,
    getAdventureItemModifier,
    type AdventureItemDefinition,
} from "@/adventures/rpg";
import logger from "@/logger";
import { prisma } from "@/prisma";
import { AdventureItemRarity, AdventureItemType, Prisma } from "@prisma/client";

export const EXPECTED_ADVENTURE_ITEM_COUNT = 42;

const ITEM_TYPE_BY_KIND = {
    equipment: AdventureItemType.EQUIPMENT,
    consumable: AdventureItemType.CONSUMABLE,
    material: AdventureItemType.MATERIAL,
    collectible: AdventureItemType.COLLECTIBLE,
} as const;

const ITEM_RARITY_BY_DEFINITION = {
    common: AdventureItemRarity.COMMON,
    uncommon: AdventureItemRarity.UNCOMMON,
    rare: AdventureItemRarity.RARE,
    epic: AdventureItemRarity.EPIC,
} as const;

export interface AdventureProfileIdentity {
    channelLogin: string;
    channelProviderId: string;
    userProviderId: string;
    userLogin: string;
    userDisplayName: string;
}

export type AdventureProfileSnapshotIdentity = Pick<AdventureProfileIdentity, "channelLogin" | "channelProviderId" | "userProviderId"> &
    Partial<Pick<AdventureProfileIdentity, "userLogin" | "userDisplayName">>;

export interface AdventureEquipmentSnapshot {
    readonly code: string;
    readonly name: string;
    readonly slot: string;
    readonly theme: string;
    readonly modifier: number;
}

/** A JSON-safe record saved on Player when somebody joins an adventure. */
export interface AdventureLoadoutSnapshot {
    readonly equippedItems: AdventureEquipmentSnapshot[];
    readonly capturedAt: string;
}

export interface GrantAdventureItemOptions {
    profileId: number;
    itemCode: string;
    quantity?: number;
    metadata?: Prisma.InputJsonObject;
}

function itemPersistenceData(item: AdventureItemDefinition) {
    return {
        name: item.name,
        description: item.description,
        type: ITEM_TYPE_BY_KIND[item.kind],
        rarity: ITEM_RARITY_BY_DEFINITION[item.rarity],
        theme: item.theme,
        checkCode: null,
        modifier: getAdventureItemModifier(item),
        config: { slot: item.slot },
        active: true,
    } satisfies Prisma.AdventureItemUpdateInput;
}

async function syncAdventureItem(item: AdventureItemDefinition) {
    const data = itemPersistenceData(item);
    return prisma.adventureItem.upsert({ where: { code: item.id }, update: data, create: { code: item.id, ...data } });
}

/** Mirrors the code-owned loot catalog into the database on bot startup. */
export async function syncAdventureItems(): Promise<void> {
    if (ADVENTURE_ITEMS.length !== EXPECTED_ADVENTURE_ITEM_COUNT) {
        throw new Error(`Expected ${EXPECTED_ADVENTURE_ITEM_COUNT} adventure items, found ${ADVENTURE_ITEMS.length}`);
    }

    await prisma.$transaction(
        ADVENTURE_ITEMS.map(item => {
            const data = itemPersistenceData(item);
            return prisma.adventureItem.upsert({ where: { code: item.id }, update: data, create: { code: item.id, ...data } });
        }),
    );
    logger.info({ count: ADVENTURE_ITEMS.length }, "Adventure item catalog synced");
}

/** Creates the user and their channel-local RPG profile only when first needed. */
export async function findOrCreateAdventureProfile(identity: AdventureProfileIdentity) {
    await prisma.user.upsert({
        where: { providerId: identity.userProviderId },
        update: { login: identity.userLogin, displayName: identity.userDisplayName },
        create: { providerId: identity.userProviderId, login: identity.userLogin, displayName: identity.userDisplayName },
    });

    return prisma.adventureProfile.upsert({
        where: { channelProviderId_userId: { channelProviderId: identity.channelProviderId, userId: identity.userProviderId } },
        update: { channel: identity.channelLogin },
        create: { channel: identity.channelLogin, channelProviderId: identity.channelProviderId, userId: identity.userProviderId },
    });
}

export async function findAdventureProfile(channelProviderId: string, userProviderId: string) {
    return prisma.adventureProfile.findUnique({
        where: { channelProviderId_userId: { channelProviderId, userId: userProviderId } },
        include: {
            inventoryItems: {
                where: { quantity: { gt: 0 } },
                include: { item: true },
                orderBy: [{ equippedSlot: "asc" }, { item: { name: "asc" } }],
            },
            conditions: {
                where: { remainingAdventures: { gt: 0 }, OR: [{ expiresAt: null }, { expiresAt: { gt: new Date() } }] },
                orderBy: { createdAt: "asc" },
            },
            user: true,
        },
    });
}

function toEquipmentSnapshot(inventoryItem: {
    equippedSlot: string | null;
    quantity: number;
    item: { code: string; name: string; active: boolean; modifier: number; checkCode: string | null; theme: string | null };
}): AdventureEquipmentSnapshot | null {
    if (!inventoryItem.equippedSlot || inventoryItem.quantity <= 0 || !inventoryItem.item.active) return null;

    const definition = getAdventureItem(inventoryItem.item.code);
    if (!definition || definition.kind !== "equipment" || definition.slot === "none") return null;
    if (inventoryItem.equippedSlot !== definition.slot) return null;

    return {
        code: definition.id,
        name: definition.name,
        slot: definition.slot,
        theme: definition.theme,
        modifier: getAdventureItemModifier(definition),
    };
}

/** Loads a profile and freezes all player-controlled bonuses for an adventure join. */
export async function getAdventureProfileSnapshot(identity: AdventureProfileSnapshotIdentity): Promise<AdventureLoadoutSnapshot> {
    let userLogin = identity.userLogin;
    let userDisplayName = identity.userDisplayName;
    if (!userLogin || !userDisplayName) {
        const user = await prisma.user.findUniqueOrThrow({ where: { providerId: identity.userProviderId } });
        userLogin ??= user.login;
        userDisplayName ??= user.displayName;
    }
    const baseProfile = await findOrCreateAdventureProfile({ ...identity, userLogin, userDisplayName });
    const profile = await prisma.adventureProfile.findUniqueOrThrow({
        where: { id: baseProfile.id },
        include: {
            inventoryItems: {
                where: { equippedSlot: { not: null }, quantity: { gt: 0 }, item: { active: true } },
                include: { item: true },
                orderBy: { equippedSlot: "asc" },
            },
        },
    });

    const equipment = profile.inventoryItems.map(toEquipmentSnapshot).filter((item): item is AdventureEquipmentSnapshot => item !== null);

    return {
        equippedItems: equipment,
        capturedAt: new Date().toISOString(),
    };
}

/** Grants code-owned loot to an existing channel profile. */
export async function grantAdventureItem({ profileId, itemCode, quantity = 1, metadata = {} }: GrantAdventureItemOptions) {
    if (!Number.isSafeInteger(quantity) || quantity <= 0) throw new RangeError("Adventure item quantity must be a positive integer");
    const definition = getAdventureItem(itemCode);
    if (!definition) throw new Error(`Unknown adventure item: ${itemCode}`);

    const item = await syncAdventureItem(definition);
    return prisma.adventureInventoryItem.upsert({
        where: { profileId_itemId: { profileId, itemId: item.id } },
        update: { quantity: { increment: quantity } },
        create: { profileId, itemId: item.id, quantity, metadata },
        include: { item: true },
    });
}
