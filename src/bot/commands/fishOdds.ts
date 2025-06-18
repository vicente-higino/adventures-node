import { createBotCommand } from "../BotCommandWithKeywords";
import { formatRarityWeightDisplay } from "@/fishing";

export const fishOddsCommand = createBotCommand(
    "fishingodds",
    async (params, ctx) => {
        const { msg, say } = ctx;
        // Zod schema for validation
        say(`Fishing odds: ${formatRarityWeightDisplay()}`);
    },
    { ignoreCase: true },
);
