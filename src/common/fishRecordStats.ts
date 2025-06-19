import { formatSize, formatSilver } from "@/utils/misc";
import { Fish, PrismaClient, Rarity } from "@prisma/client";

export async function getFishRecordStats({
    prisma, channelProviderId, userProviderId, page = 1,
}: {
    prisma: PrismaClient;
    channelProviderId: string;
    userProviderId: string;
    page?: number;
}): Promise<{ text: string; totalPages: number }> {
    const fishRecords = await prisma.fishRecord.findMany({
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
            largestFish: true,
            smallestFish: true,
            heaviestFish: true,
            lightestFish: true,
        },
    });

    const records = fishRecords.reduce<Map<number, { text: string; value: number; silver: number; types: string[]; fishName: string; }>>(
        (acc, record) => {
            const processFish = (fish: Fish, type: string) => {
                if (fish.userId === userProviderId) {
                    const id = fish.id;
                    if (!acc.has(id)) {
                        acc.set(id, {
                            text: `${record.fishName} #${fish.id} (${formatSize(parseFloat(fish.size))} - ${formatSilver(fish.value)} Silver)`,
                            value: parseFloat(fish.size),
                            silver: fish.value,
                            types: [],
                            fishName: record.fishName
                        });
                    }
                    const entry = acc.get(id);
                    entry?.types.push(type);
                }
            };

            processFish(record.largestFish, 'Largest');
            processFish(record.smallestFish, 'Smallest');
            processFish(record.heaviestFish, 'Heaviest');
            processFish(record.lightestFish, 'Lightest');

            return acc;
        },
        new Map()
    );

    // Convert Map to Array and sort by silver value
    const recordsArray = Array.from(records.values())
        .sort((a, b) => b.silver - a.silver)
        .map(record => ({
            ...record,
            text: `${record.types.join("/")} ${record.text}`
        }));

    const RECORDS_PER_PAGE = 4;
    const totalPages = Math.max(1, Math.ceil(recordsArray.length / RECORDS_PER_PAGE));
    page = Math.max(1, Math.min(page, totalPages));

    const startIdx = (page - 1) * RECORDS_PER_PAGE;
    const pageRecords = recordsArray.slice(startIdx, startIdx + RECORDS_PER_PAGE);

    const recordsText = pageRecords.length > 0
        ? pageRecords.map(record => record.text).join(", ")
        : "No records found.";

    return {
        text: recordsText,
        totalPages
    };
}
