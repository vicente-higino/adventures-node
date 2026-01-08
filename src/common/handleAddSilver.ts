import { getBotConfig } from "@/bot";
import { findOrCreateBalance, increaseBalance } from "@/db";
import { prisma } from "@/prisma";
import z, { number } from "zod";

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
    const parseResult = z.coerce.bigint().max(BigInt(Number.MAX_SAFE_INTEGER)).safeParse(add);
    if (!parseResult.success) {
        const error = parseResult.error.errors.map(e => e.message).join(", ");
        return `Usage: ${prefix ?? getBotConfig().prefix}addsilver <username> <new_balance> (${error})`;
    }
    const value = Number(parseResult.data);
    const balance = await findOrCreateBalance(prisma, channelLogin, channelProviderId, userProviderId, userLogin, userDisplayName);
    const newBal = await increaseBalance(prisma, balance.id, value);
    return `Updated @${userDisplayName} silver to ${newBal.value}.`;
}
