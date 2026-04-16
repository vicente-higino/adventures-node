import { createBot, getBotConfig } from "@/bot";
import { createAdminBotCommand } from "../botCommandWithKeywords";

export const reloadCommand = createAdminBotCommand(
    "reload",
    async (params, ctx) => {
        let { say } = ctx;
        say(`Reloading bot configs.`);
        createBot(true);
    },
    {},
);
