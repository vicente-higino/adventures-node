import { getBotConfig } from "@/bot";
import { findOrCreateBalance } from "@/db";
import { prisma } from "@/prisma";
import z from "zod/v3/external.cjs";

export async function handleAddSilver(params: {
    channelLogin: string;
    channelProviderId: string;
    userProviderId: string;
    userLogin: string;
    userDisplayName: string;
    add: number | string;
    prefix?: string;
}): Promise<string> {
    const { channelLogin, channelProviderId, userProviderId, userLogin, userDisplayName, add, prefix } = params;
    const parseResult = z.coerce.number().min(0).safeParse(add);
    if (!parseResult.success) {
        return `Usage: ${prefix ?? getBotConfig().prefix}addsilver <username> <new_balance>`;
    }
    const value = parseResult.data;
    const balance = await findOrCreateBalance(prisma, channelLogin, channelProviderId, userProviderId, userLogin, userDisplayName);
    const isBalanceNegative = balance.value + value < 0;
    const newBal = await prisma.balance.update({
        where: { userId: userProviderId, channel: channelLogin, id: balance.id },
        data: { value: { increment: isBalanceNegative ? -balance.value : value } },
    });
    return `Updated @${userDisplayName} silver to ${newBal.value}.`;
}
