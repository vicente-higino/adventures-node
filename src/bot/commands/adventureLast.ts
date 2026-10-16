import { parseStoredAdventureScenario } from "@/common/adventureScenario";
import { getConvertedLootSilver } from "@/common/adventureLoot";
import { ADVENTURE_ITEM_MODIFIER_BY_RARITY, ADVENTURE_ITEM_RARITIES, getAdventureTheme, isAdventureThemeCode } from "@/adventures/rpg";
import { formatSilver } from "@/utils/misc";
import { prisma } from "@/prisma";
import { getUserByUsername } from "@/twitch/api";
import { createBotCommand } from "../botCommandWithKeywords";
import { z } from "zod";

const adventureLootItemSchema = z.object({ name: z.string(), theme: z.string().optional(), rarity: z.enum(ADVENTURE_ITEM_RARITIES).optional() });
const adventureLootSnapshotSchema = z.union([
    z.object({ item: adventureLootItemSchema, convertedToSilver: z.number().optional(), reason: z.string().optional() }),
    adventureLootItemSchema,
]);
const adventureStatusSnapshotSchema = z.object({
    label: z.string(),
    modifier: z.number().finite().optional(),
    durationAdventures: z.number().int().positive().optional(),
});

type AdventureLootSnapshot = z.infer<typeof adventureLootSnapshotSchema>;
type AdventureStatusSnapshot = z.infer<typeof adventureStatusSnapshotSchema>;

function formatTheme(theme: string): string {
    return isAdventureThemeCode(theme) ? getAdventureTheme(theme).name : theme.replace(/(^|[-\s])\p{L}/gu, match => match.toUpperCase());
}

function formatLoot(snapshot: unknown): string | undefined {
    const itemSnapshot = adventureLootSnapshotSchema.safeParse(snapshot);
    if (!itemSnapshot.success) return undefined;
    const snapshotData: AdventureLootSnapshot = itemSnapshot.data;
    const item = "item" in snapshotData ? snapshotData.item : snapshotData;

    const theme = item.theme ? formatTheme(item.theme) : undefined;
    const modifier = item.rarity ? ADVENTURE_ITEM_MODIFIER_BY_RARITY[item.rarity] : undefined;
    const bonus = theme && modifier ? ` (${theme} +${modifier * 5}%)` : "";
    return `${item.name}${bonus}`;
}

function formatStatus(snapshot: unknown): string | undefined {
    const parsedStatus = adventureStatusSnapshotSchema.safeParse(snapshot);
    if (!parsedStatus.success) return undefined;
    const status: AdventureStatusSnapshot = parsedStatus.data;

    const modifierText = status.modifier === undefined ? "" : ` ${status.modifier >= 0 ? "+" : ""}${status.modifier * 5}%`;
    const remainingAdventures = status.durationAdventures ?? 1;
    const duration = `${remainingAdventures} adventure${remainingAdventures === 1 ? "" : "s"}`;
    return `${status.label}${modifierText} (${duration})`;
}

export const adventureLastCommand = createBotCommand(
    "advlast",
    async (params, ctx) => {
        let userId = ctx.userId;
        let userDisplayName = ctx.userDisplayName;
        const username = params[0]?.replace(/^@/, "");
        if (username) {
            const user = await getUserByUsername(prisma, username);
            if (!user) {
                ctx.say(`@${ctx.userDisplayName} Adventurer not found: ${username}.`);
                return;
            }
            userId = user.id;
            userDisplayName = user.displayName;
        }

        const result = await prisma.adventurePlayerResult.findFirst({
            where: { userId, adventure: { channelProviderId: ctx.broadcasterId } },
            include: { adventure: true },
            orderBy: { createdAt: "desc" },
        });
        if (!result) {
            const message =
                userId === ctx.userId
                    ? "You do not have a completed adventure in this channel yet."
                    : `${userDisplayName} does not have a completed adventure in this channel yet.`;
            ctx.say(`@${ctx.userDisplayName} ${message}`);
            return;
        }

        const reward =
            result.outcome === "SUCCESS"
                ? `+${formatSilver(Number(result.payout - result.buyin))} silver`
                : `-${formatSilver(Number(result.buyin))} silver`;
        const buff = result.effectiveModifier !== 0 ? `(${result.effectiveModifier > 0 ? "+" : ""}${result.effectiveModifier})` : "";
        const roll = `Roll: ${result.roll}${buff}/20 vs DC ${result.dc}`;
        const convertedLootSilver = getConvertedLootSilver(result.lootSnapshot);
        const scenario = parseStoredAdventureScenario(result.adventure.scenarioContext);
        const theme = result.adventure.theme ?? scenario?.theme;
        const loot = formatLoot(result.lootSnapshot);
        const status = formatStatus(result.statusSnapshot);
        const extras = [
            result.criticalCode === "critical-success" ? "critical success" : "",
            result.criticalCode === "critical-failure" ? "critical failure" : "",
            convertedLootSilver > 0 ? `+${formatSilver(convertedLootSilver)} loot bonus` : "",
            loot && convertedLootSilver == 0 ? `found ${loot}` : "",
            status ? `status: ${status}` : "",
            Number(result.streakBonus) > 0 ? `+${formatSilver(Number(result.streakBonus))} bonus` : "",
        ].filter(Boolean);

        ctx.say(
            `@${userDisplayName} Last adventure${theme ? ` (${formatTheme(theme)})` : ""}:$(newline)${roll}, ${reward}${extras.length ? `, ${extras.join(", ")}` : ""}.`,
        );
    },
    { aliases: ["lastadv"], ignoreCase: true },
);
