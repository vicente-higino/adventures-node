import env from "@/env";
import logger from "@/logger";
import { getChannelsModForUser } from "@/twitch/api";
import { sendActionToChannelWithAPI, sendMessageToChannelWithAPI } from "@/utils/misc";
import { RefreshingAuthProvider } from "@twurple/auth";
import { Bot } from "@twurple/easy-bot";
import { promises as fs, readFileSync } from "fs";
import { z } from "zod";
import { commands } from "./commands";
import { EmoteTracker } from "./emote-tracker";
import { createEventsubListeners } from "./eventsubListeners";
import { checkIfChannelIsForcedSend, fetchLiveChannels, isChannelLive } from "./liveChannels";
export { checkIfChannelIsForcedSend, isChannelLive };

const clientId = env.TWITCH_CLIENT_ID;
const clientSecret = env.TWITCH_CLIENT_SECRET;

// Validate bot config
const BotConfigSchema = z.object({
    channels: z.array(z.string().min(3).toLowerCase()).min(1),
    modChannels: z.array(z.string().min(3).toLowerCase()).min(1),
    prefix: z.string(),
    userId: z.string(),
    debug: z.boolean(),
    isAlwaysMod: z.boolean(),
    superUserId: z.string(),
    forceSendChannels: z.array(z.string().min(1).toLowerCase()).optional().default([]),
});

// Load bot config
const config = readFileSync("./config/bot-config.json", "utf-8");
let botConfig = BotConfigSchema.parse(JSON.parse(config));

export function getBotConfig() {
    return botConfig;
}
export const refreshingAuthProvider = new RefreshingAuthProvider({ clientId, clientSecret });
refreshingAuthProvider.onRefresh(
    async (userId, newTokenData) => await fs.writeFile(`./secrets/tokens.${userId}.json`, JSON.stringify(newTokenData, null, 4), "utf-8"),
);

let bot: Bot | null = null;
let currentBotUserId: string | null = null; // Track the userId for the singleton
export let emoteTracker: EmoteTracker | null = null; // Placeholder for emote tracker
export const GetBot = () => bot;

export const createBot = async (forceRecreate?: boolean) => {
    await loadBotConfig();

    if (bot && currentBotUserId === botConfig.userId && !forceRecreate) {
        return; // Return existing bot if userId matches
    }
    await fetchLiveChannels(botConfig.channels);
    await createEventsubListeners(botConfig.channels);
    const tokenFile = `./secrets/tokens.${botConfig.userId}.json`;
    bot?.chat.quit();
    try {
        await fs.access(tokenFile);
        const tokenData = JSON.parse(await fs.readFile(tokenFile, "utf-8"));
        const userId = await refreshingAuthProvider.addUserForToken(tokenData, ["chat"]);
        bot = new Bot({
            authProvider: refreshingAuthProvider,
            channels: botConfig.channels,
            prefix: botConfig.prefix,
            debug: botConfig.debug,
            emitCommandMessageEvents: true,
            chatClientOptions: { isAlwaysMod: botConfig.isAlwaysMod },
            commands,
        });
        bot.say = async (channel: string, message: string) => {
            if (getBotConfig().modChannels.includes(channel)) {
                sendMessageToChannelWithAPI(channel, message);
            } else {
                bot?.chat.say(channel, message);
            }
        };
        bot.action = async (channel: string, message: string) => {
            if (getBotConfig().modChannels.includes(channel)) {
                sendActionToChannelWithAPI(channel, message);
            } else {
                bot?.chat.action(channel, message);
            }
        };
        bot.onAuthenticationSuccess(() => {
            bot?.api.users
                .getAuthenticatedUser(userId)
                .then(user => {
                    logger.info(`Logged in as ${user.name}`);
                    getChannelsModForUser(user.id, bot!.api).then(modChannels => {
                        logger.info(`Bot is mod in channels: ${modChannels.join(", ")}`);
                    });
                })
                .catch(err => {
                    logger.error(err, "Error fetching user");
                });
        });

        bot.onMessage(ctx => {
            const { broadcasterName, text } = ctx;
            const temuBotslieRegex = /temu botslie/i;
            if (temuBotslieRegex.test(text)) {
                bot?.say(broadcasterName, `SideEye`);
            }
        });
        emoteTracker = new EmoteTracker(bot);
        currentBotUserId = userId; // Update the current userId
    } catch (err) {
        logger.error(err);
        logger.error(`Token file not found: ${tokenFile}`);
        // Optionally handle initialization without tokens here
    }
};

async function loadBotConfig() {
    try {
        const raw = await fs.readFile("./config/bot-config.json", "utf-8");
        botConfig = BotConfigSchema.parse(JSON.parse(raw));
    } catch (e) {
        logger.error(e);
        throw new Error("Failed to load or validate bot-config.json");
    }
}

// Save the current botConfig to file
export async function saveBotConfig() {
    if (!botConfig) throw new Error("botConfig is not loaded");
    await fs.writeFile("./config/bot-config.json", JSON.stringify(botConfig, null, 4), "utf-8");
}

// Update botConfig with new options, validate, and save
export async function updateBotConfig(updates: Partial<z.infer<typeof BotConfigSchema>>) {
    if (!botConfig) throw new Error("botConfig is not loaded");
    const newConfig = { ...botConfig, ...updates };
    botConfig = BotConfigSchema.parse(newConfig);
    await saveBotConfig();
}
