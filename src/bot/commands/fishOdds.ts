import { createAdminBotCommand } from "../BotCommandWithKeywords";
import { formatRarityWeightDisplay } from "@/fishing";

export const fishOddsCommand = createAdminBotCommand(
    "fishingodds",
    async (params, ctx) => {
        const { msg, say } = ctx;
        // Zod schema for validation
        say(`Fishing odds: ${formatRarityWeightDisplay()}`);
    },
    { ignoreCase: true },
);
