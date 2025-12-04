import { PrismaClient } from "@prisma/client";
import { getUserById } from "@/twitch/api";
import { findOrCreateBalance, increaseBalance } from "@/db";
import { calculateAmount } from "@/utils/misc";
import z from "zod";
import { createUserIdParam } from "@/utils/params";

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
export const giveSilverParamsSchema = z.object({
    userId: createUserIdParam(),
    giveAmount: z
        .string({
            description: "Silver amount (number, K/M/B, percentage, 'all', 'to:X', 'k:X', or +/-delta)",
            invalid_type_error:
                "Silver amount must be a number, K/M/B (e.g., 5k), percentage (e.g., 50%), 'all', 'to:X', 'k:X', or a delta (e.g., +1k, -50%)",
            required_error: "Silver amount is required",
        })
        .regex(/^((all|\d+(\.\d+)?%|\d+(\.\d+)?[kmb]?|\d+)|to:\d+(\.\d+)?[kmb]?|k(eep)?:\d+(\.\d+)?[kmb]?)$/i, {
            message:
                "Amount must be a positive whole number, K/M/B (e.g., 5k), percentage (e.g., 50%), 'all', 'to:X', 'k:X', or a delta (e.g., +1k, -50%)",
        }),
});

export const amountParamSchema = giveSilverParamsSchema.shape.giveAmount;
export const giveSilverCommandSyntax = (prefix: string = "!") =>
    `Usage: ${prefix}givesilver [username] [silver(K/M/B)|%|all|to:silver(K/M/B)|k(eep):silver(K/M/B)]`;
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
    const parseResult = amountParamSchema.safeParse(giveAmountStr);
    if (!parseResult.success) {
        return { message: giveSilverCommandSyntax(prefix), status: 400 };
    }
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

    const giveAmount = calculateAmount(giveAmountStr, fromBalance.value, toBalance.value);

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
