import { ms } from "ms";
import { getBotConfig } from "..";
import { createAdminBotCommand } from "../BotCommandWithKeywords";
import { manualLegendaryEventTask } from "@/fishing";

export const startEventCommand = createAdminBotCommand(
    "startevent",
    async (params, ctx) => {
        const { say } = ctx;
        const legendaryWeight = Number(params[0]);
        const durationMinutes = Number(params[1]);
        const customMsg = params.slice(2).join(" ");
        if (isNaN(legendaryWeight) || isNaN(durationMinutes) || legendaryWeight <= 0 || durationMinutes <= 0) {
            say(`Usage: ${getBotConfig().prefix}startEvent <legendaryWeight> <durationMinutes>`);
            return;
        }
        if (manualLegendaryEventTask(legendaryWeight, durationMinutes * 60 * 1000, customMsg)) {
            say(`Started Legendary Fishing Event with weight ${legendaryWeight} for ${ms(durationMinutes * 60 * 1000, { long: true })}.`);
        } else {
            say(`A Legendary Fishing Event is already active. Please wait until it ends.`);
        }
    },
    { ignoreCase: true, aliases: ["se"] },
);
