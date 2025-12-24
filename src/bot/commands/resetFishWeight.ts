import { createAdminBotCommand } from "../BotCommandWithKeywords";
import { resetRarityWeights } from "@/fishing/rarities";

export const resetRarityWeightCommand = createAdminBotCommand(
    "resetweights",
    async (params, ctx) => {
        const { msg, say } = ctx;
        // Zod schema for validation
        resetRarityWeights();
        say("Fish rarity weights have been reset to their default values!");
    },
    { ignoreCase: true },
);
