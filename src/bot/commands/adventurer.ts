import { getAdventureItem, getAdventureItemModifier } from "@/adventures/rpg";
import { findAdventureProfile, findOrCreateAdventureProfile } from "@/common/adventureProfiles";
import { prisma } from "@/prisma";
import { getUserByUsername } from "@/twitch/api";
import { createBotCommand } from "../botCommandWithKeywords";

function formatEquipment(profile: NonNullable<Awaited<ReturnType<typeof findAdventureProfile>>>): string {
    const equipment = profile.inventoryItems.filter(inventory => inventory.equippedSlot && inventory.quantity > 0 && inventory.item.active);
    if (equipment.length === 0) return "none";

    return equipment
        .map(inventory => {
            const definition = getAdventureItem(inventory.item.code);
            const modifier = definition ? getAdventureItemModifier(definition) : inventory.item.modifier;
            const theme = definition?.theme ?? inventory.item.theme;
            const bonus = theme ? ` [${theme} +${modifier * 5}%]` : "";
            return `${inventory.equippedSlot}: ${inventory.item.name}${bonus}`;
        })
        .join(", ");
}

function formatConditions(profile: NonNullable<Awaited<ReturnType<typeof findAdventureProfile>>>): string {
    if (profile.conditions.length === 0) return "none";
    return profile.conditions
        .map(condition => {
            const percent = condition.modifier * 5;
            return `${condition.name} [${percent >= 0 ? "+" : ""}${percent}%; ${condition.remainingAdventures} adv]`;
        })
        .join(", ");
}

export const adventurerCommand = createBotCommand(
    "adventurer",
    async (params, ctx) => {
        const { broadcasterId, broadcasterName, say } = ctx;
        let target = { id: ctx.userId, login: ctx.userName, displayName: ctx.userDisplayName };
        const requestedUsername = params[0]?.replaceAll("@", "");
        if (requestedUsername) {
            const found = await getUserByUsername(prisma, requestedUsername);
            if (!found) {
                say(`@${ctx.userDisplayName} Adventurer not found: ${requestedUsername}.`);
                return;
            }
            target = found;
        }

        if (!requestedUsername || target.id === ctx.userId) {
            await findOrCreateAdventureProfile({
                channelLogin: broadcasterName,
                channelProviderId: broadcasterId,
                userProviderId: target.id,
                userLogin: target.login,
                userDisplayName: target.displayName,
            });
        }

        const [profile, stats] = await Promise.all([
            findAdventureProfile(broadcasterId, target.id),
            prisma.userStats.findUnique({ where: { channelProviderId_userId: { channelProviderId: broadcasterId, userId: target.id } } }),
        ]);
        if (!profile) {
            say(`@${ctx.userDisplayName} ${target.displayName} has no adventurer profile in this channel yet.`);
            return;
        }

        const record = stats ? `${stats.gamesWon}/${stats.gamesPlayed} wins` : "0/0 wins";

        say(`@${target.displayName}, Gear: ${formatEquipment(profile)} | Status: ${formatConditions(profile)} | Record: ${record}`);
    },
    { aliases: ["char", "character"], ignoreCase: true },
);
