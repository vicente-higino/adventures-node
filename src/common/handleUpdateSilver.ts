import { getBotConfig } from "@/bot";
import { findOrCreateBalance, increaseBalance, setBalance } from "@/db";
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
    const parseResult = z.coerce.bigint().min(0n).max(BigInt(Number.MAX_SAFE_INTEGER)).safeParse(newBalance);
    if (!parseResult.success) {
        const error = parseResult.error.errors.map(e => e.message).join(", ");
        return `Usage: ${prefix ?? getBotConfig().prefix}updatesilver <username> <new_balance> (${error})`;
    }
    const value = Number(parseResult.data);
    const balance = await findOrCreateBalance(prisma, channelLogin, channelProviderId, userProviderId, userLogin, userDisplayName, value);
    const newBal = await setBalance(prisma, balance.id, value);
    return `Updated @${userDisplayName} silver to ${newBal.value}.`;
}
