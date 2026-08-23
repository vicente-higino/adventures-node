import { parseStoredAdventureScenario } from "@/common/adventureScenario";
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

        const scenario = parseStoredAdventureScenario(result.adventure.scenarioContext);
        const reward = result.outcome === "SUCCESS" ? `won ${formatSilver(Number(result.payout))} silver gross` : "lost the wager";
        const extras = [
            result.criticalCode === "critical-success" ? "critical success" : "",
            result.criticalCode === "critical-failure" ? "critical failure" : "",
            result.lootSnapshot ? "found loot" : "",
            result.statusSnapshot ? "gained a status" : "",
            Number(result.streakBonus) > 0 ? `received ${formatSilver(Number(result.streakBonus))} streak bonus` : "",
        ].filter(Boolean);

        ctx.say(
            `@${ctx.userDisplayName} Last adventure, ${scenario?.title ?? result.adventure.scenarioId ?? "Unknown encounter"}: ${result.outcome.toLowerCase()}, ${reward}${extras.length ? `, ${extras.join(", ")}` : ""}.`,
        );
    },
    { aliases: ["lastadv"], ignoreCase: true },
);
