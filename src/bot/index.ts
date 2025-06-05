import { RefreshingAuthProvider } from '@twurple/auth';
import { promises as fs, readFileSync } from 'fs';
import env from '@/env';
import { Bot } from '@twurple/easy-bot';
import { fishCommand } from './commands/fish';
import { silverCommand } from './commands/silver';
import { z } from 'zod';
import { apiClient } from '@/twitch/api';
import { listener } from '@/twitch/eventsub';
import { setRarityWeightCommand } from './commands/setFishWeight';
import { resetRarityWeightCommand } from './commands/resetFishWeight';

import { fishOddsCommand } from './commands/fishOdds';
import { flexFishCommand } from './commands/flexFish';
import { fishGalleryCommand } from './commands/fishGallery';
import { fishDexCommand, fishDexGlobalCommand } from './commands/fishDex';
import { fishCountCommand } from './commands/fishCount';
import { fishRecordsCommand } from './commands/fishRecords';
const clientId = env.TWITCH_CLIENT_ID;
const clientSecret = env.TWITCH_CLIENT_SECRET;

// Validate bot config
const BotConfigSchema = z.object({
    channels: z.array(z.string().min(3).toLowerCase()).min(1),
    prefix: z.string(),
    userId: z.string(),
    debug: z.boolean(),
    isAlwaysMod: z.boolean(),
    superUserId: z.string()
});

// Load bot config
const config = readFileSync("./config/bot-config.json", "utf-8");
let botConfig = BotConfigSchema.parse(JSON.parse(config));

export function getBotConfig() {
    return botConfig;
}
export const refreshingAuthProvider = new RefreshingAuthProvider(
    {
        clientId,
        clientSecret
    }
);
refreshingAuthProvider.onRefresh(async (userId, newTokenData) => await fs.writeFile(`./secrets/tokens.${userId}.json`, JSON.stringify(newTokenData, null, 4), 'utf-8'));

// Track which channels are live using LiveChannel objects
class LiveChannel {
    constructor(public userId: string, public userName: string) { }

    matches(channel: string) {
        return this.userId === channel || this.userName.toLowerCase() === channel.toLowerCase();
    }
}
const liveChannels = new Set<LiveChannel>();

export function isChannelLive(channel: string) {
    for (const live of liveChannels) {
        return live.matches(channel);
    }
    return false;
}

async function fetchLiveChannels() {
    const streams = await apiClient.streams.getStreamsByUserNames(botConfig.channels);
    liveChannels.clear();
    for (const stream of streams) {
        liveChannels.add(new LiveChannel(stream.userId, stream.userName));
    }
    console.log('Live channels:', Array.from(liveChannels).map(lc => ({ id: lc.userId, name: lc.userName })));
}

// Track which userIds have listeners to avoid duplicate listeners
const eventsubListeners = new Set<string>();

async function createEventsubListeners(users: string[]) {
    // await apiClient.eventSub.deleteAllSubscriptions();
    const userIds = await apiClient.users.getUsersByNames(users);
    for (const user of userIds) {
        if (eventsubListeners.has(user.id)) {
            continue; // Skip if listener already exists for this userId
        }
        listener.onStreamOnline(user, e => {
            liveChannels.add(new LiveChannel(e.broadcasterId, e.broadcasterName));
            console.log(`${e.broadcasterDisplayName} just went live!`);
            console.log('Live channels:', Array.from(liveChannels).map(lc => ({ id: lc.userId, name: lc.userName })));
        });
        listener.onStreamOffline(user, e => {
            // Remove by id or name
            for (const lc of Array.from(liveChannels)) {
                if (lc.userId === e.broadcasterId || lc.userName.toLowerCase() === e.broadcasterName.toLowerCase()) {
                    liveChannels.delete(lc);
                }
            }
            console.log(`${e.broadcasterDisplayName} just went offline`);
            console.log('Live channels:', Array.from(liveChannels).map(lc => ({ id: lc.userId, name: lc.userName })));
        });
        eventsubListeners.add(user.id);
    }
}

let bot: Bot | null = null;
let currentBotUserId: string | null = null; // Track the userId for the singleton

export const GetBot = () => bot;

export const createBot = (async () => {
    await loadBotConfig();

    if (bot && currentBotUserId === botConfig.userId) {
        return bot; // Return existing bot if userId matches
    }
    fetchLiveChannels();
    createEventsubListeners(botConfig.channels);

    const tokenFile = `./secrets/tokens.${botConfig.userId}.json`;
    bot?.chat.quit();
    try {
        await fs.access(tokenFile);
        const tokenData = JSON.parse(await fs.readFile(tokenFile, 'utf-8'));
        const userId = await refreshingAuthProvider.addUserForToken(tokenData, ['chat']);
        bot = new Bot({
            authProvider: refreshingAuthProvider,
            channels: botConfig.channels,
            prefix: botConfig.prefix,
            debug: botConfig.debug,
            chatClientOptions: { isAlwaysMod: botConfig.isAlwaysMod },
            commands: [
                fishCommand,
                silverCommand,
                setRarityWeightCommand,
                resetRarityWeightCommand,
                fishOddsCommand,
                flexFishCommand,
                fishGalleryCommand,
                fishDexCommand,
                fishDexGlobalCommand,
                fishCountCommand,
                fishRecordsCommand
            ]
        });
        bot.onAuthenticationSuccess(() => {
            bot?.api.users.getAuthenticatedUser(userId).then(user => {
                console.log(`Logged in as ${user.name}`);
            }
            ).catch(err => {
                console.error('Error fetching user:', err);
            }
            );
        });
        bot.onMessage((ctx) => {
            const { broadcasterName, userId, text } = ctx;
            const temuBotslieRegex = /temu botslie/i;
            if (temuBotslieRegex.test(text)) {
                bot?.say(broadcasterName, `SideEye`);
            }
        });
        currentBotUserId = userId; // Update the current userId

        return bot;
    } catch (err) {
        console.error(err)
        console.error(`Token file not found: ${tokenFile}`);
        // Optionally handle initialization without tokens here
    }
});

async function loadBotConfig() {
    try {
        const raw = await fs.readFile('./config/bot-config.json', 'utf-8');
        botConfig = BotConfigSchema.parse(JSON.parse(raw));
    } catch (e) {
        throw new Error('Failed to load or validate bot-config.json');
    }
}

// Save the current botConfig to file
export async function saveBotConfig() {
    if (!botConfig) throw new Error('botConfig is not loaded');
    await fs.writeFile('./config/bot-config.json', JSON.stringify(botConfig, null, 4), 'utf-8');
}

// Update botConfig with new options, validate, and save
export async function updateBotConfig(updates: Partial<z.infer<typeof BotConfigSchema>>) {
    if (!botConfig) throw new Error('botConfig is not loaded');
    const newConfig = { ...botConfig, ...updates };
    botConfig = BotConfigSchema.parse(newConfig);
    await saveBotConfig();
}


