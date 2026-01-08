import env from "@/env";
import { Prisma, PrismaClient } from "@prisma/client"; // Import PrismaClient
import { PrismaPg } from "@prisma/adapter-pg";
import logger from "./logger";

const adapter = new PrismaPg({ connectionString: env.DATABASE_URL });
export const prisma = new PrismaClient({ adapter }).$extends({
    name: "bigintToNumber",
    result: {
        balance: { value: bigintToNumber<Prisma.BalanceGetPayload<{}>, "value">("value") },
        player: { buyin: bigintToNumber<Prisma.PlayerGetPayload<{}>, "buyin">("buyin") },
        channelFishCount: { total: bigintToNumber<Prisma.ChannelFishCountGetPayload<{}>, "total">("total") },
        duel: { wagerAmount: bigintToNumber<Prisma.DuelGetPayload<{}>, "wagerAmount">("wagerAmount") },
        userStats: {
            totalWinnings: bigintToNumber<Prisma.UserStatsGetPayload<{}>, "totalWinnings">("totalWinnings"),
            totalWagers: bigintToNumber<Prisma.UserStatsGetPayload<{}>, "totalWagers">("totalWagers"),
            duelsWagered: bigintToNumber<Prisma.UserStatsGetPayload<{}>, "duelsWagered">("duelsWagered"),
            duelsWonAmount: bigintToNumber<Prisma.UserStatsGetPayload<{}>, "duelsWonAmount">("duelsWonAmount"),
        },
    },
});
export type ExtendedPrismaClient = typeof prisma;
type ExtendedPrismaClientTransaction = typeof prisma.$transaction;
export type dbClient = ExtendedPrismaClient;

type BigIntKeys<T> = { [K in keyof T]: T[K] extends bigint ? K : never }[keyof T];

export function bigintToNumber<TResult, TField extends BigIntKeys<TResult>>(field: TField) {
    return {
        needs: { [field]: true } as Record<TField, true>,
        compute(data: Pick<TResult, TField>) {
            const value = data[field] as unknown as bigint;

            if (value > BigInt(Number.MAX_SAFE_INTEGER) || value < BigInt(Number.MIN_SAFE_INTEGER)) {
                logger.warn(`Database value for "${String(field)}" is out of safe integer range: ${value.toString()}`);
            }

            return Number(value);
        },
    };
}
