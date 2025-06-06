import { createAdminBotCommand } from "../BotCommandWithKeywords";
import { getChanceByRarity, modifyRarityWeights } from "@/fishing";
import { z } from "zod";
import { Rarity } from "@prisma/client";

export const setRarityWeightCommand = createAdminBotCommand(
    "setweight",
    async (params, ctx) => {
        const { msg, say } = ctx;
        // Zod schema for validation
        const schema = z.tuple([z.string(), z.coerce.number().min(1)]);
        const parseResult = schema.safeParse(params);

        if (!parseResult.success) {
            say(`Usage: !setWeight <rarity> <weight>`);
            return;
        }

        const [rarity, value] = parseResult.data;
        const rarityKey = rarity.charAt(0).toUpperCase() + rarity.slice(1).toLowerCase();

        if (!Object.values(Rarity).includes(rarityKey as Rarity)) {
            say(`Invalid rarity: ${rarityKey}. Valid options: ${Object.values(Rarity).join(", ")}`);
            return;
        }

        modifyRarityWeights({ [rarityKey]: value });

        // You can now use newWeights with getFish or randomFish
        // Example: const fish = getFish({ rarityWeights: newWeights });

        say(`Rarity weight for ${rarityKey} set to ${value} (${getChanceByRarity(rarityKey as Rarity).toPrecision(2)}%).`);
    },
    { ignoreCase: true },
);
