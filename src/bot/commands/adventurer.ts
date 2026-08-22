import { formatAdventureCheckModifiers, getAdventureClass, getAdventureItem, isAdventureCheck, isAdventureClassCode } from "@/adventures/rpg";
import { getBotPrefix } from "@/bot";
import { findAdventureProfile, findOrCreateAdventureProfile, getAdventureLevelProgress } from "@/common/adventureProfiles";
import { prisma } from "@/prisma";
import { getUserByUsername } from "@/twitch/api";
import { createBotCommand } from "../botCommandWithKeywords";

function formatEquipment(profile: NonNullable<Awaited<ReturnType<typeof findAdventureProfile>>>): string {
    const equipment = profile.inventoryItems.filter(inventory => inventory.equippedSlot && inventory.quantity > 0 && inventory.item.active);
    if (equipment.length === 0) return "none";

    return equipment
        .map(inventory => {
            const definition = getAdventureItem(inventory.item.code);
            const check =
                definition?.bonus.check ?? (inventory.item.checkCode && isAdventureCheck(inventory.item.checkCode) ? inventory.item.checkCode : null);
            const modifier = definition?.bonus.modifier ?? inventory.item.modifier;
            const bonus = check ? ` [${formatAdventureCheckModifiers([check], modifier)}]` : "";
            return `${inventory.equippedSlot}: ${inventory.item.name}${bonus}`;
        })
        .join(", ");
}

function formatConditions(profile: NonNullable<Awaited<ReturnType<typeof findAdventureProfile>>>): string {
    if (profile.conditions.length === 0) return "none";
    return profile.conditions
        .map(condition => {
            const checks = condition.checkCodes.filter(isAdventureCheck);
            const effect = checks.length
                ? formatAdventureCheckModifiers(checks, condition.modifier)
                : `All checks ${condition.modifier >= 0 ? "+" : ""}${condition.modifier}`;
            return `${condition.name} [${effect}; ${condition.remainingAdventures} adv]`;
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

        const progress = getAdventureLevelProgress(profile.xp);
        const classDefinition = profile.classCode && isAdventureClassCode(profile.classCode) ? getAdventureClass(profile.classCode) : null;
        const classText = classDefinition
            ? `${classDefinition.name} [${formatAdventureCheckModifiers(classDefinition.proficiencies, 1)}]`
            : `Unassigned (${getBotPrefix()}class <name>)`;
        const record = stats ? `${stats.gamesWon}/${stats.gamesPlayed} wins` : "0/0 wins";

        say(
            `@${target.displayName},  Level ${progress.level} ${classText} | XP ${progress.xp}/${progress.nextLevelXp} | Gear: ${formatEquipment(profile)} | Status: ${formatConditions(profile)} | Record: ${record}`,
        );
    },
    { aliases: ["char", "character"], ignoreCase: true },
);
