import { type AdventureItemDefinition } from "@/adventures/rpg";
import { prisma } from "@/prisma";
import { Prisma } from "@prisma/client";
import { evaluateAdventureLootEligibility, type AdventureLootConversionReason } from "./adventureLoot";
import { withTransactionRetry } from "./helpers/transactionRetry";

interface FishingAdventureLootIdentity {
    channelLogin: string;
    channelProviderId: string;
    userProviderId: string;
    userLogin: string;
    userDisplayName: string;
}

export type FishingAdventureLootGrant =
    | { type: "item"; item: AdventureItemDefinition; autoEquipped: true }
    | { type: "silver"; item: AdventureItemDefinition; silverBonus: number; reason: AdventureLootConversionReason };

/** Grants fishing loot with the same usefulness rules as adventure settlement. */
export async function grantFishingAdventureLoot(
    identity: FishingAdventureLootIdentity,
    candidate: AdventureItemDefinition,
): Promise<FishingAdventureLootGrant> {
    return withTransactionRetry(
        () =>
            prisma.$transaction(
                async tx => {
                    await tx.user.upsert({
                        where: { providerId: identity.userProviderId },
                        update: { login: identity.userLogin, displayName: identity.userDisplayName },
                        create: { providerId: identity.userProviderId, login: identity.userLogin, displayName: identity.userDisplayName },
                    });
                    const profile = await tx.adventureProfile.upsert({
                        where: {
                            channelProviderId_userId: {
                                channelProviderId: identity.channelProviderId,
                                userId: identity.userProviderId,
                            },
                        },
                        update: { channel: identity.channelLogin },
                        create: {
                            channel: identity.channelLogin,
                            channelProviderId: identity.channelProviderId,
                            userId: identity.userProviderId,
                        },
                    });
                    const [item, inventory] = await Promise.all([
                        tx.adventureItem.findUnique({ where: { code: candidate.id } }),
                        tx.adventureInventoryItem.findMany({
                            where: { profileId: profile.id, quantity: { gt: 0 } },
                            include: { item: true },
                        }),
                    ]);
                    const eligibility = evaluateAdventureLootEligibility(
                        candidate,
                        item?.active ?? false,
                        inventory.map(entry => ({
                            code: entry.item.code,
                            quantity: entry.quantity,
                            active: entry.item.active,
                            equippedSlot: entry.equippedSlot,
                            theme: entry.item.theme,
                            modifier: entry.item.modifier,
                        })),
                    );

                    if (!eligibility.eligible) {
                        await tx.balance.update({
                            where: {
                                channelProviderId_userId: {
                                    channelProviderId: identity.channelProviderId,
                                    userId: identity.userProviderId,
                                },
                            },
                            data: { value: { increment: BigInt(eligibility.silverBonus) } },
                        });
                        return { type: "silver", item: candidate, silverBonus: eligibility.silverBonus, reason: eligibility.reason };
                    }

                    if (!item) throw new Error(`Adventure item ${candidate.id} disappeared while granting fishing loot`);
                    await tx.adventureInventoryItem.updateMany({
                        where: { profileId: profile.id, equippedSlot: candidate.slot },
                        data: { equippedSlot: null },
                    });
                    await tx.adventureInventoryItem.upsert({
                        where: { profileId_itemId: { profileId: profile.id, itemId: item.id } },
                        update: { quantity: { increment: 1 }, equippedSlot: candidate.slot },
                        create: { profileId: profile.id, itemId: item.id, quantity: 1, equippedSlot: candidate.slot },
                    });
                    return { type: "item", item: candidate, autoEquipped: true };
                },
                { isolationLevel: Prisma.TransactionIsolationLevel.Serializable, maxWait: 5_000, timeout: 10_000 },
            ),
        { retryUniqueConflicts: true },
    );
}
