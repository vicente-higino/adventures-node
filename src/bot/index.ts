import { RefreshingAuthProvider } from '@twurple/auth';
import { promises as fs } from 'fs';
import env from '@/env';
import { Bot } from '@twurple/easy-bot';
import { fishCommand } from './commands/fish';
import { silverCommand } from './commands/silver';
import { z } from 'zod';
import { apiClient } from '@/twitch/api';
import { listener } from '@/twitch/eventsub';
const clientId = env.TWITCH_CLIENT_ID;
const clientSecret = env.TWITCH_CLIENT_SECRET;

// Validate bot config
const BotConfigSchema = z.object({
    channels: z.array(z.string().min(3)).min(1),
    prefix: z.string(),
    debug: z.boolean(),
    isAlwaysMod: z.boolean()
});

// Load bot config
let botConfig: z.infer<typeof BotConfigSchema>;


export const refreshingAuthProvider = new RefreshingAuthProvider(
    {
        clientId,
        clientSecret
    }
);
refreshingAuthProvider.onRefresh(async (userId, newTokenData) => await fs.writeFile(`./secrets/tokens.${userId}.json`, JSON.stringify(newTokenData, null, 4), 'utf-8'));

// Track which channels are live
const liveChannels = new Set<string>();
export function isChannelLive(channel: string) {
    return liveChannels.has(channel);
}

async function fetchLiveChannels() {
    const streams = await apiClient.streams.getStreamsByUserNames(botConfig.channels);
    for (const stream of streams) {
        liveChannels.add(stream.userId);
    }
    console.log('Live channels:', Array.from(liveChannels));
}

async function createEventsubListeners(users: string[]) {

    await apiClient.eventSub.deleteAllSubscriptions();
    const userIds = await apiClient.users.getUsersByNames(users);
    for (const user of userIds) {
        listener.onStreamOnline(user, e => {
            liveChannels.add(e.broadcasterId);
            console.log(`${e.broadcasterDisplayName} just went live!`);
            console.log('Live channels:', Array.from(liveChannels));
        });
        listener.onStreamOffline(user, e => {
            liveChannels.delete(e.broadcasterId);
            console.log(`${e.broadcasterDisplayName} just went offline`);
            console.log('Live channels:', Array.from(liveChannels));
        });
    }
    listener.start();

}

let bot: Bot | null = null;
let currentBotUserId: string | null = null; // Track the userId for the singleton

export const GetBot = () => bot;

export const createBot = (async (userId: string) => {
    if (bot && currentBotUserId === userId) {
        return bot; // Return existing bot if userId matches
    }
    await loadBotConfig();
    fetchLiveChannels();
    await createEventsubListeners(botConfig.channels);

    const tokenFile = `./secrets/tokens.${userId}.json`;
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


