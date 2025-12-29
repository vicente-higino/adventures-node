import { restartAdventureWarnings } from "@/common/helpers/schedule";
import logger from "@/logger";
import { apiClient } from "@/twitch/api";
import { listener } from "@/twitch/eventsub";
import { liveChannels } from "./liveChannels";

// Track which userIds have listeners to avoid duplicate listeners
const eventsubListeners = new Set<string>();

export async function createEventsubListeners(users: string[]) {
    // await apiClient.eventSub.deleteAllSubscriptions();
    const userIds = await apiClient.users.getUsersByNames(users);
    for (const user of userIds) {
        if (eventsubListeners.has(user.id)) {
            continue; // Skip if listener already exists for this userId
        }
        listener.onStreamOnline(user, e => {
            liveChannels.setStatus(e.broadcasterId, e.broadcasterName, true);
            logger.info(`${e.broadcasterDisplayName} just went live!`);
            logger.info(liveChannels.listLive(), "Live channels");
        });
        listener.onStreamOffline(user, e => {
            liveChannels.setStatus(e.broadcasterId, e.broadcasterName, false);
            restartAdventureWarnings(user.id);
            logger.info(`${e.broadcasterDisplayName} just went offline`);
            logger.info(liveChannels.listLive(), "Live channels");
        });
        eventsubListeners.add(user.id);
    }
}
