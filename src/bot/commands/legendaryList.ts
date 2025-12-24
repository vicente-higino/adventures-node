import { createAdminBotCommand } from "../BotCommandWithKeywords";
import { listLegendaryEvents } from "@/fishing";
import dayjs from "dayjs";

export const legendaryListCommand = createAdminBotCommand(
    "legendary-event-list",
    async (params, ctx) => {
        const { say } = ctx;
        const events = await listLegendaryEvents(true);
        if (!events || events.length === 0) {
            say("No active legendary events.");
            return;
        }
        const lines = events.map(e => {
            const ends = dayjs(e.endsAt).toISOString();
            return `id=${e.id} name=${e.name} weight=${e.legendaryWeight} endsAt=${ends}`;
        });
        say(lines.join(" | "));
    },
    { ignoreCase: true, aliases: ["lel"] },
);

export default legendaryListCommand;
