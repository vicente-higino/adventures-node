import { getAdventureItem, getAdventureItemModifier } from "@/adventures/rpg";
import { findAdventureProfile, findOrCreateAdventureProfile } from "@/common/adventureProfiles";
import { prisma } from "@/prisma";
import { getUserByUsername } from "@/twitch/api";
import { createBotCommand } from "../botCommandWithKeywords";
import { formatAdventureBuffs, formatAdventureStatus } from "./adventurerFormat";

function formatBuffs(profile: NonNullable<Awaited<ReturnType<typeof findAdventureProfile>>>): string {
    const equipment = profile.inventoryItems.filter(inventory => inventory.equippedSlot && inventory.quantity > 0 && inventory.item.active);
    return formatAdventureBuffs(
        equipment.map(inventory => {
            const definition = getAdventureItem(inventory.item.code);
            return {
                theme: definition?.theme ?? inventory.item.theme,
                modifier: definition ? getAdventureItemModifier(definition) : inventory.item.modifier,
            };
        }),
    );
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
        const status = formatAdventureStatus(profile.conditions[0]);
        const details = [`Buffs: ${formatBuffs(profile)}`, status ? `Status: ${status}` : "", record].filter(Boolean);

        say(`@${target.displayName}, ${details.join(" | ")}`);
    },
    { aliases: ["char", "character"], ignoreCase: true },
);
