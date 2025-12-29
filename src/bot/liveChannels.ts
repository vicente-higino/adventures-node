import logger from "@/logger";
import { apiClient } from "@/twitch/api";
import { getBotConfig } from "./index";

class LiveChannelManager {
    private byId = new Map<string, { userId: string; userName: string; isLive: boolean }>();
    private byName = new Map<string, { userId: string; userName: string; isLive: boolean }>();

    setStatus(userId: string, userName: string, isLive: boolean) {
        const key = userId;
        let entry = this.byId.get(key);
        if (!entry) {
            entry = { userId, userName, isLive };
            this.byId.set(userId, entry);
            this.byName.set(userName.toLowerCase(), entry);
        } else {
            entry.isLive = isLive;
            entry.userName = userName; // update name if changed
            this.byName.set(userName.toLowerCase(), entry);
        }
    }

    isLive(channel: string) {
        const byId = this.byId.get(channel);
        if (byId) return byId.isLive;
        const byName = this.byName.get(channel.toLowerCase());
        return byName ? byName.isLive : false;
    }

    listLive() {
        return Array.from(this.byId.values()).filter(e => e.isLive);
    }

    listAll() {
        return Array.from(this.byId.values());
    }
}

export const liveChannels = new LiveChannelManager();

export function checkIfChannelIsForcedSend(channel: string) {
    const overrides = getBotConfig().forceSendChannels ?? [];
    return overrides.includes(channel.toLowerCase());
}

export function isChannelLive(channel: string) {
    const isLive = liveChannels.isLive(channel);
    logger.debug({ channel, forced: checkIfChannelIsForcedSend(channel), isLive }, "Checking if channel is live");
    if (checkIfChannelIsForcedSend(channel)) {
        return false;
    }
    return isLive;
}

export async function fetchLiveChannels(channels: string[]) {
    const streams = await apiClient.streams.getStreamsByUserNames(channels);
    for (const stream of streams) {
        liveChannels.setStatus(stream.userId, stream.userName, true);
    }
    logger.info(liveChannels.listAll(), "Initially fetched live channels");
}
