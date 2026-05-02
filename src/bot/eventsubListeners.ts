import { restartAdventureWarnings } from "@/common/helpers/schedule";
import logger from "@/logger";
import { apiClient } from "@/twitch/api";
import { listener } from "@/twitch/eventsub";
import { liveChannels } from "./liveChannels";
import Whispers from "./whispers";
import { UserIdResolvable } from "@twurple/api";
import { getBotPrefix } from ".";

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

export async function createWhisperListener(user: UserIdResolvable, whispers: Whispers[] = []) {
    listener.onUserWhisperMessage(user, async e => {
        const { userId, userDisplayName, senderUserName, senderUserId, messageText, id } = e;
        logger.debug({ id, userId, userDisplayName, senderUserId, senderUserName, messageText }, `Received whisper`);

        for (const whisper of whispers) {
            const params = whisper.match(messageText, getBotPrefix());
            if (params) {
                await whisper.execute(params, e);
                return; // Stop after first match
            }
        }
    });
}
