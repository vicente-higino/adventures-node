import { createBotCommand } from "../BotCommandWithKeywords";
import { formatRarityWeightDisplay } from "@/fishing/rarities";

export const fishOddsCommand = createBotCommand(
    "fishingodds",
    async (params, ctx) => {
        const { msg, say } = ctx;
        // Zod schema for validation
        say(`Fishing odds: ${formatRarityWeightDisplay()}`);
    },
    { ignoreCase: true, aliases: ["fishodds", "fishingodd", "fo"] },
);
