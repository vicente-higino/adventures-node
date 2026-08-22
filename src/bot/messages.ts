import logger from "@/logger";
import { prisma } from "@/prisma";
import { getUserById, getUserByUsername, sendChatMessageToChannel } from "@/twitch/api";
import { splitOnSpaces } from "@/utils/misc";
import { GetBot, getBotConfig } from "@/bot";
import { isChannelLive } from "./liveChannels";

export function sendMessageToChannel(channel: string, message: string) {
    void sendMessageToChannelStrict(channel, message).catch(err => logger.error(err, `Error sending message to ${channel}:`));
}
export async function sendMessageToChannelStrict(channel: string, message: string) {
    logger.info(`Sending message to ${channel}: ${message}`);
    const bot = GetBot();
    if (!bot) throw new Error("Bot is not connected.");
    await bot.say(channel, message);
}
export async function sendMessageToChannelId(channelId: string, message: string) {
    const broadcaster = await getUserById(prisma, channelId);
    if (!broadcaster) {
        logger.error(`User not found: ${channelId}`);
        return;
    }
    logger.info(`Sending message to ${broadcaster.login}: ${message}`);
    GetBot()
        ?.say(broadcaster.login, message)
        .catch(err => {
            logger.error(err, `Error sending message to ${broadcaster.login}:`);
        });
}
export async function sendMessageToChannelWithAPI(channel: string, message: string, max_length = 500) {
    // Placeholder function to send a message to a channel
    // Replace with actual implementation
    const broadcaster = await getUserByUsername(prisma, channel);
    if (!broadcaster) {
        throw new Error(`User not found: ${channel}`);
    }
    const texts = splitOnSpaces(message, max_length);
    await Promise.all(texts.map(msg => sendChatMessageToChannel(broadcaster.id, getBotConfig().userId, msg)));
}
export async function sendActionToChannelWithAPI(channel: string, message: string, max_length = 490) {
    // Placeholder function to send a message to a channel
    // Replace with actual implementation
    const broadcaster = await getUserByUsername(prisma, channel);
    if (!broadcaster) {
        throw new Error(`User not found: ${channel}`);
    }
    const texts = splitOnSpaces(message, max_length);
    await Promise.all(texts.map(msg => sendChatMessageToChannel(broadcaster.id, getBotConfig().userId, `/me ${msg}`)));
}
export function sendActionToChannel(channel: string, message: string) {
    void sendActionToChannelStrict(channel, message).catch(err => logger.error(err, `Error sending message to ${channel}:`));
}
export async function sendActionToChannelStrict(channel: string, message: string) {
    logger.info(`Sending message to ${channel}: ${message}`);
    const bot = GetBot();
    if (!bot) throw new Error("Bot is not connected.");
    await bot.action(channel, message);
}

export function sendMessageToAllChannel(message: string, onlyOffline = true) {
    // Placeholder function to send a message to a channel
    // Replace with actual implementation
    const { channels } = getBotConfig();
    for (const channel of channels) {
        if (onlyOffline && isChannelLive({ username: channel })) continue;
        logger.info(`Sending message to ${channel}: ${message}`);
        GetBot()
            ?.say(channel, message)
            .catch(err => {
                logger.error(err, `Error sending message to ${channel}:`);
            });
    }
}
export function sendActionToAllChannel(message: string, onlyOffline = true) {
    // Placeholder function to send a message to a channel
    // Replace with actual implementation
    const { channels } = getBotConfig();
    for (const channel of channels) {
        if (onlyOffline && isChannelLive({ username: channel })) continue;
        logger.info(`Sending message to ${channel}: ${message}`);
        GetBot()
            ?.action(channel, message)
            .catch(err => {
                logger.error(err, `Error sending message to ${channel}:`);
            });
    }
}
