import { PrismaClient } from "@prisma/client";
import { getUserById } from "@/twitch/api";
import { findOrCreateBalance, increaseBalance } from "@/db";
import { calculateAmount } from "@/utils/misc";

interface GiveSilverParams {
    prisma: PrismaClient;
    channelLogin: string;
    channelProviderId: string;
    fromUserProviderId: string;
    fromUserLogin: string;
    fromUserDisplayName: string;
    toUserProviderId: string;
    giveAmountStr: string;
    prefix?: string;
}

export async function giveSilver({
    prisma,
    channelLogin,
    channelProviderId,
    fromUserProviderId,
    fromUserLogin,
    fromUserDisplayName,
    toUserProviderId,
    giveAmountStr,
    prefix = "!",
}: GiveSilverParams): Promise<{ message: string; status?: number }> {
    const toUser = await getUserById(prisma, toUserProviderId);
    if (!toUser) {
        return { message: `@${fromUserDisplayName}, user not found`, status: 404 };
    }
    const toUserDisplayName = toUser.displayName;
    const toUserLogin = toUser.login;
    if (fromUserProviderId === toUserProviderId) {
        return { message: `@${fromUserDisplayName}, Usage: ${prefix}givesilver <username> <amount|%|all>` };
    }
    const fromBalance = await findOrCreateBalance(prisma, channelLogin, channelProviderId, fromUserProviderId, fromUserLogin, fromUserDisplayName);

    if (fromBalance.value <= 0) {
        return { message: `@${fromUserDisplayName}, you have no silver to give.` };
    }

    const toBalance = await findOrCreateBalance(prisma, channelLogin, channelProviderId, toUserProviderId, toUserLogin, toUserDisplayName);

    const giveAmount = calculateAmount(giveAmountStr, fromBalance.value);

    if (giveAmount <= 0) {
        return { message: `@${fromUserDisplayName}, minimum amount to give is 1 silver.` };
    }

    const newBalance = await increaseBalance(prisma, fromBalance.id, -giveAmount);
    await increaseBalance(prisma, toBalance.id, giveAmount);

    const formattedGiveAmount = giveAmount;
    const formattedNewBalance = newBalance.value;

    if (newBalance.value === 0 && giveAmountStr.toLowerCase() === "all") {
        return { message: `@${fromUserDisplayName}, you gave all your silver (${formattedGiveAmount}) to @${toUserDisplayName}.` };
    }
    return {
        message: `@${fromUserDisplayName}, you gave ${formattedGiveAmount} silver to @${toUserDisplayName}. You have ${formattedNewBalance} silver left.`,
    };
}
