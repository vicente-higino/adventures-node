import { FishStats, Prisma, PrismaClient } from "@prisma/client";

export async function findOrCreateBalance(
    db: dbClient,
    channelLogin: string,
    channelProviderId: string,
    userProviderId: string,
    userLogin: string,
    userDisplayName: string,
    newValue = 500,
) {
    let balance = await db.balance.findUnique({
        where: { channelProviderId_userId: { channelProviderId, userId: userProviderId } },
        include: { user: true },
    });

    if (!balance) {
        balance = await db.balance.create({
            data: {
                channel: channelLogin,
                channelProviderId: channelProviderId,
                value: newValue,
                user: {
                    connectOrCreate: {
                        where: { providerId: userProviderId },
                        create: { providerId: userProviderId, displayName: userDisplayName, login: userLogin },
                    },
                },
            },
            include: { user: true },
        });
    }
    if (balance.user.login !== userLogin || balance.user.displayName !== userDisplayName) {
        await updateUserDetails(db, userProviderId, userLogin, userDisplayName);
    }
    return balance;
}
export async function setBalance(db: dbClient, id: number, newValue: number) {
    const balance = await db.balance.update({ where: { id }, data: { value: newValue } });
    return balance;
}
export async function increaseBalanceWithChannelID(db: dbClient, channelProviderId: string, userProviderId: string, amountToIncrease: number) {
    let balance = await db.balance.findUniqueOrThrow({ where: { channelProviderId_userId: { channelProviderId, userId: userProviderId } } });
    balance = await increaseBalance(db, balance.id, amountToIncrease);
    return balance;
}
export async function increaseBalance(db: dbClient, id: number, amountToIncrease: number) {
    if (amountToIncrease < 0) {
        // Delegate to decreaseBalance for negative amounts
        return decreaseBalance(db, id, amountToIncrease);
    }
    const updated = await db.balance.update({ where: { id }, data: { value: { increment: amountToIncrease } } });

    if (!updated) {
        throw new Error("Balance not found.");
    }

    return updated;
}

export async function decreaseBalance(db: dbClient, id: number, amountToDecrease: number) {
    // Get the current balance
    const current = await db.balance.findUniqueOrThrow({ where: { id } });

    if (current.value <= 0) {
        // Already zero, nothing to do
        return current;
    }
    amountToDecrease = Math.abs(amountToDecrease); // Ensure we are dealing with a positive amount
    if (amountToDecrease >= current.value) {
        // Set balance to zero if amount is greater than or equal to current balance
        return db.balance.update({ where: { id }, data: { value: 0 } });
    }

    // Otherwise, decrement normally
    const updated = await db.balance.update({ where: { id, value: { gte: amountToDecrease } }, data: { value: { decrement: amountToDecrease } } });

    if (!updated) {
        throw new Error("Insufficient balance or balance not found.");
    }

    return updated;
}

export async function findOrCreateUserStats(db: dbClient, channelLogin: string, channelProviderId: string, userProviderId: string) {
    let userStats = await db.userStats.findUnique({ where: { channelProviderId_userId: { channelProviderId, userId: userProviderId } } });
    if (!userStats) {
        userStats = await db.userStats.create({
            data: { channel: channelLogin, channelProviderId: channelProviderId, userId: userProviderId },
            include: { user: true },
        });
    }
    return userStats;
}

export async function updateUserAdventureStats(
    db: dbClient,
    channel: string,
    channelProviderId: string,
    userProviderId: string,
    stats: { wagerAmount: number; winAmount: number; didWin: boolean },
) {
    const userStats = await findOrCreateUserStats(db, channel, channelProviderId, userProviderId);

    // Compute new streaks and streakWager
    let newWinStreak = userStats.winStreak ?? 0;
    let newLoseStreak = userStats.loseStreak ?? 0;
    let newStreakWager = userStats.streakWager ?? 0;
    if (stats.didWin) {
        newWinStreak += 1;
        newLoseStreak = 0;
        newStreakWager = newWinStreak === 1 ? stats.wagerAmount : newStreakWager + stats.wagerAmount;
    } else {
        newLoseStreak += 1;
        newWinStreak = 0;
        newStreakWager = newLoseStreak === 1 ? stats.wagerAmount : newStreakWager + stats.wagerAmount;
    }

    const updatedUserStats = await db.userStats.update({
        where: { id: userStats.id },
        data: {
            totalWagers: { increment: stats.wagerAmount },
            totalWinnings: stats.didWin ? { increment: stats.winAmount } : undefined,
            gamesPlayed: { increment: 1 },
            gamesWon: stats.didWin ? { increment: 1 } : undefined,
            winStreak: newWinStreak,
            loseStreak: newLoseStreak,
            streakWager: newStreakWager,
        },
    });

    return { ...updatedUserStats, newStreak: stats.didWin ? newWinStreak : newLoseStreak, isWinStreak: stats.didWin };
}

export async function updateUseDuelsStats(
    db: dbClient,
    channel: string,
    channelProviderId: string,
    userProviderId: string,
    stats: { wagerAmount: number; winAmount: number; didWin: boolean },
) {
    const userStats = await findOrCreateUserStats(db, channel, channelProviderId, userProviderId);

    // Compute new duel streaks and streakWager
    let newDuelWinStreak = userStats.duelWinStreak ?? 0;
    let newDuelLoseStreak = userStats.duelLoseStreak ?? 0;
    let newStreakWager = userStats.streakWager ?? 0;
    if (stats.didWin) {
        newDuelWinStreak += 1;
        newDuelLoseStreak = 0;
        newStreakWager = newDuelWinStreak === 1 ? stats.wagerAmount : newStreakWager + stats.wagerAmount;
    } else {
        newDuelLoseStreak += 1;
        newDuelWinStreak = 0;
        newStreakWager = newDuelLoseStreak === 1 ? stats.wagerAmount : newStreakWager + stats.wagerAmount;
    }

    const updatedUserStats = await db.userStats.update({
        where: { id: userStats.id },
        data: {
            duelsWagered: { increment: stats.wagerAmount },
            duelsPlayed: { increment: 1 },
            duelsWon: stats.didWin ? { increment: 1 } : undefined,
            duelsWonAmount: stats.didWin ? { increment: stats.winAmount } : undefined,
            duelWinStreak: newDuelWinStreak,
            duelLoseStreak: newDuelLoseStreak,
            streakWager: newStreakWager,
        },
    });
    return updatedUserStats;
}

export async function updateUserDetails(prisma: dbClient, userId: string, newLogin: string, newDisplayName: string): Promise<void> {
    await prisma.user.update({ where: { providerId: userId }, data: { login: newLogin, displayName: newDisplayName } });
}

export async function cancelExpiredDuels(prisma: dbClient): Promise<void> {
    const oneHourAgo = new Date(Date.now() - 60 * 60 * 1000);

    // Find pending duels older than one hour
    const expiredDuels = await prisma.duel.findMany({ where: { status: "Pending", createdAt: { lt: oneHourAgo } } });

    if (expiredDuels.length === 0) {
        console.log("No expired duels found.");
        return;
    }

    console.log(`Found ${expiredDuels.length} expired duels to cancel.`);

    const tasks: Promise<unknown>[] = [];

    for (const duel of expiredDuels) {
        console.log(
            `Cancelling duel ID ${duel.id} between ${duel.challengerId} and ${duel.challengedId}. Refunding ${duel.wagerAmount} to ${duel.challengerId}.`,
        );
        // Refund the wager to the challenger
        tasks.push(increaseBalanceWithChannelID(prisma, duel.channelProviderId, duel.challengerId, duel.wagerAmount));

        // Delete the duel
        tasks.push(
            prisma.duel.delete({
                where: {
                    id: duel.id, // Use the primary key 'id' for deletion
                },
            }),
        );
    }

    // Execute all refunds and deletions
    try {
        await Promise.all(tasks);
        console.log(`Successfully cancelled ${expiredDuels.length} expired duels.`);
    } catch (error) {
        console.error("Error cancelling expired duels:", error);
    }
}

/**
 * Finds an existing FishStats record for a user in a specific channel or creates a new one if it doesn't exist.
 *
 * @param prisma The dbClient instance.
 * @param channelLogin The login name of the channel.
 * @param channelProviderId The provider ID of the channel.
 * @param userProviderId The provider ID of the user.
 * @returns A Promise that resolves to the found or created FishStats record.
 */

export async function findOrCreateFishStats(
    prisma: dbClient,
    channelLogin: string,
    channelProviderId: string,
    userProviderId: string,
    userLogin: string,
    userDisplayName: string,
): Promise<FishStats> {
    let fishStats = await prisma.fishStats.findUnique({
        where: { channelProviderId_userId: { channelProviderId, userId: userProviderId } },
        include: { user: true },
    });

    if (!fishStats) {
        fishStats = await prisma.fishStats.create({
            data: {
                channel: channelLogin,
                channelProviderId,
                user: {
                    connectOrCreate: {
                        where: { providerId: userProviderId },
                        create: { providerId: userProviderId, displayName: userDisplayName, login: userLogin },
                    },
                },
            },
            include: { user: true },
        });
    }
    if (fishStats.user.login !== userLogin || fishStats.user.displayName !== userDisplayName) {
        await updateUserDetails(prisma, userProviderId, userLogin, userDisplayName);
    }

    return fishStats;
}

/**
 * Adds bonus silver to a user's stats and balance.
 * Increments totalWinnings and increases balance.
 */
export async function addBonusToUserStats(db: dbClient, channelProviderId: string, userProviderId: string, bonusAmount: number) {
    // Find the userStats for the user in the channel
    const userStats = await findOrCreateUserStats(db, channelProviderId, channelProviderId, userProviderId);
    if (userStats) {
        await db.userStats.update({ where: { id: userStats.id }, data: { totalWinnings: { increment: bonusAmount } } });
    }
    // Also add to balance
    await increaseBalanceWithChannelID(db, channelProviderId, userProviderId, bonusAmount);
}

type dbClient = PrismaClient | Prisma.TransactionClient;
