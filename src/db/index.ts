import { FishStats, Prisma, PrismaClient } from "@prisma/client";

export async function findOrCreateBalance(
    db: dbClient,
    channelLogin: string,
    channelProviderId: string,
    userProviderId: string,
    userLogin: string,
    userDisplayName: string,
    newValue: number = 500,
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
    let balance = await db.balance.update({ where: { id }, data: { value: newValue } });
    return balance;
}
export async function increaseBalanceWithChannelID(db: dbClient, channelProviderId: string, userProviderId: string, amountToIncrease: number) {
    let balance = await db.balance.findFirst({ where: { channelProviderId, userId: userProviderId } });
    if (!balance) {
        throw new Error("Balance not found");
    }
    balance = await increaseBalance(db, balance.id, amountToIncrease);
    return balance;
}
export async function increaseBalance(db: any, id: number, amountToIncrease: number) {
    let oldBalance = await db.balance.findUniqueOrThrow({ where: { id } });
    const isBalanceNegative = oldBalance.value + amountToIncrease < 0;
    let balance = await db.balance.update({
        where: { id },
        data: { value: { increment: isBalanceNegative ? -oldBalance.value : amountToIncrease } },
    });
    return balance;
}

export async function findOrCreateUserStats(db: dbClient, channelLogin: string, channelProviderId: string, userProviderId: string) {
    let userStats = await db.userStats.findFirst({ where: { userId: userProviderId, channelProviderId: channelProviderId } });
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
    const updatedUserStats = await db.userStats.update({
        where: { id: userStats.id },
        data: {
            totalWagers: { increment: stats.wagerAmount },
            totalWinnings: { increment: stats.didWin ? stats.winAmount : 0 },
            gamesPlayed: { increment: 1 },
            gamesWon: stats.didWin ? { increment: 1 } : undefined,
        },
    });

    return updatedUserStats;
}

export async function updateUseDuelsStats(
    db: dbClient,
    channel: string,
    channelProviderId: string,
    userProviderId: string,
    stats: { wagerAmount: number; winAmount: number; didWin: boolean },
) {
    const userStats = await findOrCreateUserStats(db, channel, channelProviderId, userProviderId);
    const updatedUserStats = await db.userStats.update({
        where: { id: userStats.id },
        data: {
            duelsWagered: { increment: stats.wagerAmount },
            duelsPlayed: { increment: 1 },
            duelsWon: stats.didWin ? { increment: 1 } : undefined,
            duelsWonAmount: stats.didWin ? { increment: stats.winAmount } : undefined,
        },
    });
    return updatedUserStats;
}

export async function updateUserDetails(prisma: dbClient, userId: string, newLogin: string, newDisplayName: string): Promise<void> {
    await prisma.user.update({ where: { providerId: userId }, data: { login: newLogin, displayName: newDisplayName } });
}

export async function cancelExpiredDuels(prisma: dbClient): Promise<void> {
    const tenMinAgo = new Date(Date.now() - 10 * 60 * 1000); // Calculate timestamp for 10 min ago

    // Find pending duels older than one hour
    const expiredDuels = await prisma.duel.findMany({
        where: {
            status: "Pending",
            createdAt: {
                lt: tenMinAgo, // Less than 10 min ago (older)
            },
        },
    });

    if (expiredDuels.length === 0) {
        console.log("No expired duels found.");
        return;
    }

    console.log(`Found ${expiredDuels.length} expired duels to cancel.`);

    const tasks: Promise<any>[] = [];

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


type dbClient = PrismaClient | Prisma.TransactionClient