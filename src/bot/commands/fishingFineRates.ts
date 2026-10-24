import { formatFishingFineRates } from "@/common/fishingFine";
import { createBotCommand } from "../botCommandWithKeywords";

export const fishingFineRatesCommand = createBotCommand(
    "allfinerates",
    (_params, { say }) => {
        say(formatFishingFineRates());
    },
    { aliases: ["allfines", "allfishingfines", "afr"], ignoreCase: true },
);
