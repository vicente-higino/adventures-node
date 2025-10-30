import { createBotCommand } from "../BotCommandWithKeywords";
import { getBotConfig, updateBotConfig } from "@/bot";
import { prisma } from "@/prisma";
import { getUserByUsername } from "@/twitch/api";
import { z } from "zod";

export const forceSendCommand = createBotCommand(
    "allowmessages",
    async (params, ctx) => {
        const { say, broadcasterName } = ctx;
        const { isMod, isBroadcaster, userId, userName } = ctx.msg.userInfo;

        const isSuper = getBotConfig().superUserId === userId;
        // allow superuser OR channel mod/broadcaster; non-super users can only affect current channel
        if (!isSuper && !isMod && !isBroadcaster) {
            return;
        }

        // superuser may pass a channel param; others are forced to the current broadcaster channel
        const targetRaw = isSuper ? (params[1] ?? broadcasterName) : broadcasterName;
        const target = targetRaw.replace(/^@/, "").toLowerCase();
        const action = (params[0] ?? "toggle").toLowerCase();
        const userTarget = await getUserByUsername(prisma, target);
        if (!userTarget) {
            say(`${userName}, user not found: ${target}`);
            return;
        }
        // validate action with zod
        const ActionSchema = z.enum(["on", "off", "enable", "disable", "toggle"]);
        const actionParse = ActionSchema.safeParse(action);
        if (!actionParse.success) {
            say(`Usage: ${getBotConfig().prefix}allowmessages <on|off|toggle> [channel]`);
            return;
        }

        const cfg = getBotConfig();
        const set = new Set(cfg.forceSendChannels ?? []);
        const exists = set.has(target) || set.has(userTarget.id);

        if (action === "on" || action === "enable") {
            if (!exists) {
                set.add(target);
                set.add(userTarget.id);
                await updateBotConfig({ forceSendChannels: Array.from(set) });
            }
            say(`Channel ${target} will now allow sending messages even if live.`);
            return;
        }

        if (action === "off" || action === "disable") {
            if (exists) {
                set.delete(target);
                set.delete(userTarget.id);
                await updateBotConfig({ forceSendChannels: Array.from(set) });
                say(`Channel ${target} will no longer allow sending messages while live.`);
            } else {
                say(`Channel ${target} was not set to allow messages while live.`);
            }
            return;
        }

        // toggle
        if (exists) {
            set.delete(target);
            set.delete(userTarget.id);
            await updateBotConfig({ forceSendChannels: Array.from(set) });
            say(`Channel ${target} will no longer allow sending messages while live.`);
        } else {
            set.add(target);
            set.add(userTarget.id);
            await updateBotConfig({ forceSendChannels: Array.from(set) });
            say(`Channel ${target} will now allow sending messages even if live.`);
        }
    },
    { aliases: ["allowmsgs", "forcesend", "allowsend"], ignoreCase: true, offlineOnly: false },
);
