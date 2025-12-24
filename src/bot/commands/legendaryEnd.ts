import { createAdminBotCommand } from "../BotCommandWithKeywords";
import { endLegendaryEventById } from "@/fishing";
import { z } from "zod";
import { getBotConfig } from "..";

export const legendaryEndCommand = createAdminBotCommand(
    "legendary-event-end",
    async (params, ctx) => {
        const { say } = ctx;
        const schema = z.tuple([z.coerce.number().int().positive()]);
        const parsed = schema.safeParse(params);
        if (!parsed.success) {
            say(`Usage: ${getBotConfig().prefix}legendary-end <id>`);
            return;
        }
        const [id] = parsed.data;
        const ok = await endLegendaryEventById(id);
        if (ok) say(`Legendary event ${id} ended.`);
        else say(`Failed to end legendary event ${id} (not found or already inactive).`);
    },
    { ignoreCase: true, aliases: ["lee"] },
);

export default legendaryEndCommand;
