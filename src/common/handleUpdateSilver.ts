import { getBotConfig } from "@/bot";
import { findOrCreateBalance } from "@/db";
import { prisma } from "@/prisma";
import z from "zod";

export async function handleUpdateSilver(params: {
    channelLogin: string;
    channelProviderId: string;
    userProviderId: string;
    userLogin: string;
    userDisplayName: string;
    newBalance: string | number;
    prefix?: string;
}): Promise<string> {
    const { channelLogin, channelProviderId, userProviderId, userLogin, userDisplayName, newBalance, prefix } = params;
    const parseResult = z.coerce.number().min(0).safeParse(newBalance);
    if (!parseResult.success) {
        return `Usage: ${prefix ?? getBotConfig().prefix}updatesilver <username> <new_balance>`;
    }
    const value = parseResult.data;

    const balance = await findOrCreateBalance(prisma, channelLogin, channelProviderId, userProviderId, userLogin, userDisplayName, value);
    const newBal = await prisma.balance.update({ where: { userId: userProviderId, channel: channelLogin, id: balance.id }, data: { value } });
    return `Updated @${userDisplayName} silver to ${newBal.value}.`;
}
