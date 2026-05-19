import logger from "@/logger";
import { prisma } from "@/prisma";
import { getUserById, getUserByUsername, sendChatMessageToChannel } from "@/twitch/api";
import { splitOnSpaces } from "@/utils/misc";
import { GetBot, getBotConfig } from "./createBot";
import { isChannelLive } from "./liveChannels";

export function sendMessageToChannel(channel: string, message: string) {
    // Placeholder function to send a message to a channel
    // Replace with actual implementation
    logger.info(`Sending message to ${channel}: ${message}`);
    GetBot()
        ?.say(channel, message)
        .catch(err => {
            logger.error(err, `Error sending message to ${channel}:`);
        });
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
        logger.error(`User not found: ${channel}`);
        return;
    }
    const texts = splitOnSpaces(message, max_length);
    texts.map(msg => sendChatMessageToChannel(broadcaster.id, getBotConfig().userId, msg));
}
export async function sendActionToChannelWithAPI(channel: string, message: string, max_length = 490) {
    // Placeholder function to send a message to a channel
    // Replace with actual implementation
    const broadcaster = await getUserByUsername(prisma, channel);
    if (!broadcaster) {
        logger.error(`User not found: ${channel}`);
        return;
    }
    const texts = splitOnSpaces(message, max_length);
    texts.map(async msg => await sendChatMessageToChannel(broadcaster.id, getBotConfig().userId, `/me ${msg}`));
}
export function sendActionToChannel(channel: string, message: string) {
    // Placeholder function to send a message to a channel
    // Replace with actual implementation
    logger.info(`Sending message to ${channel}: ${message}`);
    GetBot()
        ?.action(channel, message)
        .catch(err => {
            logger.error(err, `Error sending message to ${channel}:`);
        });
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