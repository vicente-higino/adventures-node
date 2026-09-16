import { ADVENTURE_ITEMS, LOOT_RARITY_WEIGHTS } from "@/adventures/rpg";

export const FISH_TRASH_TREASURE_BASE_CHANCE = 0.25;
export const FISH_TRASH_TREASURE_ROD_MULTIPLIER = 1.125;

export const FISH_TRASH_REWARD_TABLE = [
    { type: "silver", weight: 5 },
    { type: "adventure-ticket", weight: 3 },
    { type: "legendary-event-ticket", weight: 2 },
    { type: "legendary-bait", weight: 1 },
    { type: "adventure-loot", weight: 0.25 },
] as const;

export const FISHING_ADVENTURE_LOOT_TABLE = ADVENTURE_ITEMS.map(item => ({ item, weight: LOOT_RARITY_WEIGHTS[item.rarity] }));

export function getFishingAdventureLootChancePerTrash(rodLevel: number): number {
    const treasureChance = FISH_TRASH_TREASURE_BASE_CHANCE * Math.pow(FISH_TRASH_TREASURE_ROD_MULTIPLIER, rodLevel);
    const totalRewardWeight = FISH_TRASH_REWARD_TABLE.reduce((total, reward) => total + reward.weight, 0);
    const lootWeight = FISH_TRASH_REWARD_TABLE.find(reward => reward.type === "adventure-loot")!.weight;
    return treasureChance * (lootWeight / totalRewardWeight);
}
