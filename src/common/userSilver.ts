import { findOrCreateBalance } from "../db";
import { formatSilver } from "../utils/misc";

interface GetUserSilverStringParams {
    prisma: any;
    channelLogin: string;
    channelProviderId: string;
    userProviderId: string;
    userLogin: string;
    userDisplayName: string;
}

export async function getUserSilverString({
    prisma,
    channelLogin,
    channelProviderId,
    userProviderId,
    userLogin,
    userDisplayName,
}: GetUserSilverStringParams): Promise<string> {
    const balance = await findOrCreateBalance(prisma, channelLogin, channelProviderId, userProviderId, userLogin, userDisplayName);
    return `@${userDisplayName} has ${formatSilver(balance.value)} silver.`;
}
