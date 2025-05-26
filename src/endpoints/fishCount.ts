import { OpenAPIRoute } from "chanfana";
import { z } from "zod";
import { type HonoEnv, FossaHeaders } from "@/types";
import { PrismaClient, Rarity } from "@prisma/client";
import type { Context } from "hono";
import { getUserById } from "@/twitch/api";
import { formatSize, formatWeight, roundToDecimalPlaces } from "@/utils/misc";
import { formatSilver } from "@/utils/misc";
import { createUserIdParam } from "@/utils/params";
import { findOrCreateFishStats } from "@/db";

export class FishCount extends OpenAPIRoute {
    schema = { request: { headers: FossaHeaders, params: z.object({ userId: createUserIdParam() }) }, responses: {} };
    handleValidationError(errors: z.ZodIssue[]): Response {
        const msg = "Usage: !fishcount [username]";
        return new Response(msg, { status: 400 });
    }
    async handle(c: Context<HonoEnv>) {
        const data = await this.getValidatedData<typeof this.schema>();
        const prisma = c.get("prisma");
        const channelLogin = data.headers["x-fossabot-channellogin"];
        const channelProviderId = data.headers["x-fossabot-channelproviderid"];
        let userProviderId = data.headers["x-fossabot-message-userproviderid"];
        let userLogin = data.headers["x-fossabot-message-userlogin"];
        let userDisplayName = data.headers["x-fossabot-message-userdisplayname"];
        if (data.params.userId && data.params.userId !== data.headers["x-fossabot-message-userproviderid"]) {
            const user = await getUserById(c, prisma, data.params.userId);
            userProviderId = user?.id ?? data.headers["x-fossabot-message-userproviderid"];
            userLogin = user?.login ?? data.headers["x-fossabot-message-userlogin"];
            userDisplayName = user?.displayName ?? data.headers["x-fossabot-message-userdisplayname"];
        }
        // Get FishStats and FishRecords
        const [fishStats, fishRecords] = await Promise.all([
            findOrCreateFishStats(prisma, channelLogin, channelProviderId, userProviderId, userLogin, userDisplayName),
            prisma.fishRecord.findMany({
                where: {
                    channelProviderId: channelProviderId,
                    OR: [
                        { largestFish: { userId: userProviderId, rarity: { not: Rarity.Trash } } },
                        { smallestFish: { userId: userProviderId, rarity: { not: Rarity.Trash } } },
                        { heaviestFish: { userId: userProviderId, rarity: { not: Rarity.Trash } } },
                        { lightestFish: { userId: userProviderId, rarity: { not: Rarity.Trash } } },
                    ],
                },
                select: {
                    fishName: true,
                    largestFish: { select: { userId: true, size: true, rarity: true } },
                    smallestFish: { select: { userId: true, size: true, rarity: true } },
                    heaviestFish: { select: { userId: true, weight: true, rarity: true } },
                    lightestFish: { select: { userId: true, weight: true, rarity: true } },
                },
            }),
        ]);

        const records = fishRecords.reduce<{
            largest: Array<{ text: string; value: number }>;
            smallest: Array<{ text: string; value: number }>;
            heaviest: Array<{ text: string; value: number }>;
            lightest: Array<{ text: string; value: number }>;
        }>(
            (acc, record) => {
                if (record.largestFish.userId === userProviderId) {
                    acc.largest.push({
                        text: `${record.fishName} (${formatSize(parseFloat(record.largestFish.size))})`,
                        value: parseFloat(record.largestFish.size),
                    });
                }
                if (record.smallestFish.userId === userProviderId) {
                    acc.smallest.push({
                        text: `${record.fishName} (${formatSize(parseFloat(record.smallestFish.size))})`,
                        value: parseFloat(record.smallestFish.size),
                    });
                }
                if (record.heaviestFish.userId === userProviderId) {
                    acc.heaviest.push({
                        text: `${record.fishName} (${formatWeight(parseFloat(record.heaviestFish.weight))})`,
                        value: parseFloat(record.heaviestFish.weight),
                    });
                }
                if (record.lightestFish.userId === userProviderId) {
                    acc.lightest.push({
                        text: `${record.fishName} (${formatWeight(parseFloat(record.lightestFish.weight))})`,
                        value: parseFloat(record.lightestFish.weight),
                    });
                }
                return acc;
            },
            { largest: [], smallest: [], heaviest: [], lightest: [] },
        );

        // Sort and limit each category
        Object.keys(records).forEach(key => {
            const recordArray = records[key as keyof typeof records];
            const sorted = recordArray.sort((a, b) => {
                return key === "smallest" || key === "lightest" ? a.value - b.value : b.value - a.value;
            });

            records[key as keyof typeof records] = sorted.slice(0, 3);
            if (sorted.length > 3) {
                const lastRecord = records[key as keyof typeof records][2];
                lastRecord.text += ` and ${sorted.length - 3} more`;
            }
        });

        const recordsText = Object.entries(records).some(([_, items]) => items.length > 0)
            ? `They hold the record for: ${Object.entries(records)
                .filter(([_, items]) => items.length > 0)
                .map(([type, items]) => `${type.charAt(0).toUpperCase() + type.slice(1)}: ${items.map(i => i.text).join(", ")}`)
                .join("; ")}!`
            : "";

        const fishCountsByRarity = [
            { rarity: Rarity.Legendary, count: fishStats.legendaryFishCount },
            { rarity: Rarity.Epic, count: fishStats.epicFishCount },
            { rarity: Rarity.Rare, count: fishStats.rareFishCount },
            { rarity: Rarity.Fine, count: fishStats.fineFishCount },
            { rarity: Rarity.Uncommon, count: fishStats.uncommonFishCount },
            { rarity: Rarity.Common, count: fishStats.commonFishCount },
            { rarity: Rarity.Trash, count: fishStats.trashFishCount },
        ];

        const totalCount = fishCountsByRarity.reduce((acc, curr) => acc + curr.count, 0);
        const totalValue = fishStats.totalSilverWorth;

        // Calculate average silver per fish
        const avgSilverPerFish = totalCount > 0 ? roundToDecimalPlaces(totalValue / totalCount, 2) : 0;

        const rarityBreakdown = fishCountsByRarity
            .filter(r => r.count > 0)
            .sort((a, b) => b.count - a.count)
            .map(f => `${f.count} ${f.rarity.toLowerCase()}`)
            .join(", ");

        const finesText = fishStats.fishFines > 0 ? `They also have been fined ${formatSilver(fishStats.fishFines)} silver.` : "";

        return c.text(
            totalCount > 0
                ? `@${userDisplayName} has caught ${totalCount} fish worth ${formatSilver(totalValue)} silver in total! (avg ${formatSilver(avgSilverPerFish)} silver/fish)${rarityBreakdown.length > 0 ? ` (${rarityBreakdown})` : ""}. ${recordsText} ${finesText}`
                : `@${userDisplayName} has not caught any fish yet!${finesText}`,
        );
    }
}
