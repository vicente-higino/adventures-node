import logger from "@/logger";
import { prisma } from "@/prisma";

export const redeemables = [
    {
        code: "legendary_event_ticket",
        name: "Legendary Event Ticket",
        description: "Starts a legendary event.",
        type: "START_LEGENDARY_EVENT",
        config: { durationMinutes: 90 },
    },
    {
        code: "adventure_2x",
        name: "2x Adventure Ticket",
        description: "Your next adventure will reward 2x payouts.",
        type: "START_ADVENTURE_MULTIPLIER",
        config: { multiplier: 2 },
    },
    {
        code: "legendary_bait",
        name: "Legendary Bait",
        description: "Your next fish will be a legendary fish.",
        type: "LEGENDARY_BAIT",
        config: {},
    },
] as const;

export async function syncRedeemables() {
    for (const redeemable of redeemables) {
        logger.debug({ ...redeemable }, "Syncing Redeemables");
        await prisma.redeemable.upsert({
            where: { code: redeemable.code },

            update: { name: redeemable.name, description: redeemable.description, type: redeemable.type, config: redeemable.config },

            create: { ...redeemable },
        });
    }
}
type RedeemableCode = (typeof redeemables)[number]["code"];
type GrantRedeemableOptions = { userId: string; channelProviderId: string; redeemableCode: RedeemableCode; quantity?: number };

export async function grantRedeemable({ userId, channelProviderId, redeemableCode, quantity = 1 }: GrantRedeemableOptions) {
    const redeemable = await prisma.redeemable.findUnique({ where: { code: redeemableCode } });
    logger.debug({ userId, channelProviderId, redeemable }, "Grant Redeemable");
    if (!redeemable) {
        throw new Error(`Redeemable "${redeemableCode}" not found`);
    }

    return prisma.userRedeemable.upsert({
        where: { channelProviderId_userId_redeemableId: { channelProviderId, userId, redeemableId: redeemable.id } },

        update: { quantity: { increment: quantity } },

        create: { channelProviderId, userId, redeemableId: redeemable.id, quantity },
    });
}

type ConsumeRedeemableOptions = { userId: string; channelProviderId: string; redeemableCode: RedeemableCode };

export async function consumeRedeemable({ userId, channelProviderId, redeemableCode }: ConsumeRedeemableOptions) {
    const redeemable = await prisma.redeemable.findUnique({ where: { code: redeemableCode } });

    if (!redeemable) {
        throw new Error(`Redeemable "${redeemableCode}" not found`);
    }
    logger.debug({ userId, channelProviderId, redeemableCode }, "Consuming Redeemable");
    const inventory = await prisma.userRedeemable.findUnique({
        where: { channelProviderId_userId_redeemableId: { channelProviderId, userId, redeemableId: redeemable.id } },
        include: { redeemable: true },
    });

    if (!inventory || inventory.quantity <= 0) {
        logger.debug({ userId, channelProviderId, redeemableCode }, "Not Consuming Redeemable");
        return null;
    }
    await prisma.userRedeemable.update({ where: { id: inventory.id }, data: { quantity: { decrement: 1 } } });

    return inventory.redeemable;
}
