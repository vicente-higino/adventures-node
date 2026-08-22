import {
    ADVENTURE_CHECKS,
    ADVENTURE_CHECK_LABELS,
    formatAdventureClassNames,
    getAdventureClass,
    isAdventureClassCode,
    parseAdventureClass,
} from "@/adventures/rpg";
import { getBotPrefix } from "@/bot";
import { findOrCreateAdventureProfile } from "@/common/adventureProfiles";
import { prisma } from "@/prisma";
import { createBotCommand } from "../botCommandWithKeywords";

const CHECK_DESCRIPTIONS = {
    might: "force",
    agility: "movement",
    endurance: "hardship",
    stealth: "infiltration",
    survival: "navigation",
    perception: "traps",
    knowledge: "lore",
    technology: "machines",
    arcana: "magic",
    spirit: "fear/curses",
    presence: "leadership",
    deception: "bluffs",
} as const;

function proficiencyNames(classCode: Parameters<typeof getAdventureClass>[0]): string {
    return getAdventureClass(classCode)
        .proficiencies.map(check => ADVENTURE_CHECK_LABELS[check])
        .join("/");
}

export const adventureClassInfoCommand = createBotCommand(
    "classinfo",
    async (params, ctx) => {
        const input = params.join(" ");
        const definition = parseAdventureClass(input);
        if (!definition) {
            ctx.say(`@${ctx.userDisplayName} Unknown class. Use ${getBotPrefix()}class help to see the available classes.`);
            return;
        }

        ctx.say(
            `${definition.name},  ${definition.description} Proficient in ${definition.proficiencies
                .map(check => ADVENTURE_CHECK_LABELS[check])
                .join(" and ")} (+1 when either check is used).`,
        );
    },
    { aliases: ["advclassinfo"], ignoreCase: true },
);

export const adventureClassCommand = createBotCommand(
    "class",
    async (params, ctx) => {
        const { broadcasterId, broadcasterName, userDisplayName, userId, userName, say } = ctx;
        if (params.length === 1 && params[0].toLowerCase() === "help") {
            say(`Classes: ${formatAdventureClassNames()}.`);
            return;
        }

        const profile = await findOrCreateAdventureProfile({
            channelLogin: broadcasterName,
            channelProviderId: broadcasterId,
            userProviderId: userId,
            userLogin: userName,
            userDisplayName,
        });

        if (params.length === 0) {
            if (profile.classCode && isAdventureClassCode(profile.classCode)) {
                const currentClass = getAdventureClass(profile.classCode);
                say(`@${userDisplayName} Your class is ${currentClass.name} [${proficiencyNames(currentClass.code)}].`);
            } else {
                say(`@${userDisplayName} You have no class yet. Use ${getBotPrefix()}class help, then ${getBotPrefix()}class <name>.`);
            }
            return;
        }

        const requestedClass = parseAdventureClass(params.join(" "));
        if (!requestedClass) {
            say(`@${userDisplayName} Unknown class. Use ${getBotPrefix()}class help to see the available classes.`);
            return;
        }
        if (profile.classCode === requestedClass.code) {
            say(`@${userDisplayName} You are already a ${requestedClass.name}.`);
            return;
        }

        await prisma.adventureProfile.update({ where: { id: profile.id }, data: { classCode: requestedClass.code } });
        say(
            `@${userDisplayName} You are now a ${requestedClass.name}! Proficiencies: ${requestedClass.proficiencies
                .map(check => ADVENTURE_CHECK_LABELS[check])
                .join(" and ")} (+1).`,
        );
    },
    { aliases: ["advclass"], ignoreCase: true },
);

export const adventureChecksCommand = createBotCommand(
    "checks",
    async (_params, ctx) => {
        const checks = ADVENTURE_CHECKS.map(check => `${ADVENTURE_CHECK_LABELS[check]} (${CHECK_DESCRIPTIONS[check]})`);
        ctx.say(`Adventure checks: ${checks.join(" | ")}. Each encounter offers three approaches; your class can add +1.`);
    },
    { aliases: ["advchecks"], ignoreCase: true },
);
