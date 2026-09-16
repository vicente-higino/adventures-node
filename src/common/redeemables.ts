import logger from "@/logger";
import { prisma } from "@/prisma";

export const ADVENTURE_TICKET_MULTIPLIERS = [2, 3, 4, 5] as const;
export type AdventureTicketMultiplier = (typeof ADVENTURE_TICKET_MULTIPLIERS)[number];
export const ADVENTURE_TICKET_DROP_WEIGHTS: Readonly<Record<AdventureTicketMultiplier, number>> = { 2: 225, 3: 20, 4: 4, 5: 1 };
export const ADVENTURE_TICKET_DROP_TABLE = ADVENTURE_TICKET_MULTIPLIERS.map(multiplier => ({
    multiplier,
    weight: ADVENTURE_TICKET_DROP_WEIGHTS[multiplier],
}));

export function getAdventureTicketCode(multiplier: AdventureTicketMultiplier): `adventure_${AdventureTicketMultiplier}x` {
    return `adventure_${multiplier}x`;
}

export function getAdventureTicketMultiplier(code: string): AdventureTicketMultiplier | undefined {
    const match = /^adventure_([2-5])x$/.exec(code);
    if (!match) return undefined;
    const multiplier = Number(match[1]);
    return ADVENTURE_TICKET_MULTIPLIERS.find(candidate => candidate === multiplier);
}

const adventureTickets = ADVENTURE_TICKET_MULTIPLIERS.map(multiplier => ({
    code: getAdventureTicketCode(multiplier),
    name: `${multiplier}x Adventure Ticket`,
    description: `Use !advupgrade ${multiplier}x to upgrade an active adventure to a ${multiplier}x payout.`,
    type: "START_ADVENTURE_MULTIPLIER" as const,
    config: { multiplier, dropWeight: ADVENTURE_TICKET_DROP_WEIGHTS[multiplier] },
}));

export const redeemables = [
    {
        code: "legendary_event_ticket",
        name: "Legendary Event Ticket",
        description: "Starts a legendary event.",
        type: "START_LEGENDARY_EVENT",
        config: { durationMinutes: 90 },
    },
    ...adventureTickets,
    { code: "legendary_bait", name: "Legendary Bait", description: "Your next fish will be a legendary fish.", type: "LEGENDARY_BAIT", config: {} },
] as const;

export type RedeemableCode = (typeof redeemables)[number]["code"];
export const redeemableCodes: readonly RedeemableCode[] = redeemables.map(redeemable => redeemable.code);

export function isRedeemableCode(value: string): value is RedeemableCode {
    return (redeemableCodes as readonly string[]).includes(value);
}

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
interface GrantRedeemableOptions {
    userId: string;
    channelProviderId: string;
    redeemableCode: RedeemableCode;
    quantity?: number;
}

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

interface ConsumeRedeemableOptions {
    userId: string;
    channelProviderId: string;
    redeemableCode: RedeemableCode;
}

export async function consumeRedeemable({ userId, channelProviderId, redeemableCode }: ConsumeRedeemableOptions): Promise<boolean> {
    const redeemable = await prisma.redeemable.findUnique({ where: { code: redeemableCode } });

    if (!redeemable) {
        logger.error(`Redeemable "${redeemableCode}" not found`);
        return false;
    }
    logger.debug({ userId, channelProviderId, redeemableCode }, "Consuming Redeemable");
    const inventory = await prisma.userRedeemable.findUnique({
        where: { channelProviderId_userId_redeemableId: { channelProviderId, userId, redeemableId: redeemable.id } },
        include: { redeemable: true },
    });

    if (!inventory || inventory.quantity <= 0) {
        logger.debug({ userId, channelProviderId, redeemableCode }, "Not Consuming Redeemable");
        return false;
    }
    await prisma.userRedeemable.update({ where: { id: inventory.id }, data: { quantity: { decrement: 1 } } });

    return true;
}
