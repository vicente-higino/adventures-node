import { parseStoredAdventureScenario } from "@/common/adventureScenario";
import { getConvertedLootSilver } from "@/common/adventureLoot";
import { formatSilver } from "@/utils/misc";
import { prisma } from "@/prisma";
import { createBotCommand } from "../botCommandWithKeywords";

export const adventureLastCommand = createBotCommand(
    "advlast",
    async (_params, ctx) => {
        const result = await prisma.adventurePlayerResult.findFirst({
            where: { userId: ctx.userId, adventure: { channelProviderId: ctx.broadcasterId } },
            include: { adventure: true },
            orderBy: { createdAt: "desc" },
        });
        if (!result) {
            ctx.say(`@${ctx.userDisplayName} You do not have a completed RPG adventure in this channel yet.`);
            return;
        }

        const reward = result.outcome === "SUCCESS" ? `+${formatSilver(Number(result.payout-result.buyin))} silver` : `-${formatSilver(Number(result.buyin))} silver`;
        const buff = result.effectiveModifier !== 0 ? ` (${result.effectiveModifier > 0 ? "+" : ""}${result.effectiveModifier})` : "";
        const roll = `Roll: ${result.roll}${buff}/20 vs DC ${result.dc}`;
        const convertedLootSilver = getConvertedLootSilver(result.lootSnapshot);
        const extras = [
            result.criticalCode === "critical-success" ? "critical success" : "",
            result.criticalCode === "critical-failure" ? "critical failure" : "",
            convertedLootSilver > 0
                ? `+${formatSilver(convertedLootSilver)} loot bonus`
                : result.lootSnapshot
                  ? "found loot"
                  : "",
            result.statusSnapshot ? "gained a status" : "",
            Number(result.streakBonus) > 0 ? `+${formatSilver(Number(result.streakBonus))} bonus` : "",
        ].filter(Boolean);

        ctx.say(
            `@${ctx.userDisplayName} Last adventure:$(newline)${roll}, ${reward}${extras.length ? `, ${extras.join(", ")}` : ""}.`,
        );
    },
    { aliases: ["lastadv"], ignoreCase: true },
);
