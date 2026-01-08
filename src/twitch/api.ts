import { ApiClient } from "@twurple/api";
import { AppTokenAuthProvider } from "@twurple/auth";
import env from "@/env";
import Queue from "queue";
import { dbClient, prisma } from "@/prisma";
import logger from "@/logger";
const { TWITCH_CLIENT_ID, TWITCH_CLIENT_SECRET } = env;
export function buildUrl(baseUrl: string, params: Record<string, string>): string {
    const url = new URL(baseUrl);
    Object.entries(params).forEach(([key, value]) => {
        url.searchParams.append(key, value);
    });
    return url.toString();
}

// Define a consistent user type for return values
interface DbUser {
    id: string; // Corresponds to providerId
    login: string;
    displayName: string;
}

const authProvider = new AppTokenAuthProvider(TWITCH_CLIENT_ID, TWITCH_CLIENT_SECRET);
export const apiClient = new ApiClient({ authProvider });

async function handleApiRequest<T>(apiCall: () => Promise<T>, authProvider: AppTokenAuthProvider): Promise<T | null> {
    try {
        return await apiCall();
    } catch (error) {
        logger.error(error, "API call failed:");
        // await authProvider.getAppAccessToken(true);
        return null; // Return null on failure
    }
}

export const getUserByUsername = async (
    prisma: dbClient, // Add prisma client
    username: string,
): Promise<DbUser | null> => {
    // Change return type
    // Check DB first
    username = username.toLowerCase().replaceAll("@", "");
    const dbUser = await prisma.user.findUnique({ where: { login: username } });
    if (dbUser) {
        return { id: dbUser.providerId, login: dbUser.login, displayName: dbUser.displayName };
    }

    // If not in DB, fetch from Twitch API
    const apiUser = await handleApiRequest(() => apiClient.users.getUserByName(username), authProvider);
    if (!apiUser) {
        return null;
    }

    // Upsert user into DB
    await prisma.user.upsert({
        where: { providerId: apiUser.id },
        update: { login: apiUser.name, displayName: apiUser.displayName },
        create: { providerId: apiUser.id, login: apiUser.name, displayName: apiUser.displayName },
    });

    return {
        id: apiUser.id,
        login: apiUser.name,
        displayName: apiUser.displayName,
        // Note: profilePictureUrl and description are not stored/returned in this simplified DbUser type
    };
};
export const getUsersByUsername = async (usernames: string[]): Promise<DbUser[] | null> => {
    const normalized = Array.from(new Set(usernames.map(u => u.toLowerCase().replaceAll("@", "")).filter(Boolean)));

    if (!normalized.length) return [];

    const dbUsers = await prisma.user.findMany({ where: { login: { in: normalized } } });

    const dbUsersByLogin = new Map(dbUsers.map(u => [u.login.toLowerCase(), u]));

    const missingUsernames = normalized.filter(login => !dbUsersByLogin.has(login));

    let apiUsers: DbUser[] = [];

    if (missingUsernames.length > 0) {
        const fetched = await handleApiRequest(() => apiClient.users.getUsersByNames(missingUsernames), authProvider);

        if (fetched?.length) {
            // 4. Upsert fetched users
            await prisma.$transaction(
                fetched.map(apiUser =>
                    prisma.user.upsert({
                        where: { providerId: apiUser.id },
                        update: { login: apiUser.name.toLowerCase(), displayName: apiUser.displayName },
                        create: { providerId: apiUser.id, login: apiUser.name.toLowerCase(), displayName: apiUser.displayName },
                    }),
                ),
            );

            apiUsers = fetched.map(apiUser => ({ id: apiUser.id, login: apiUser.name, displayName: apiUser.displayName }));
        }
    }

    const result: DbUser[] = [
        ...dbUsers.map(dbUser => ({ id: dbUser.providerId, login: dbUser.login, displayName: dbUser.displayName })),
        ...apiUsers,
    ];

    return result.length ? result : [];
};

export const getUserById = async (
    prisma: dbClient, // Add prisma client
    id: string,
): Promise<DbUser | null> => {
    // Change return type
    // Check DB first
    const dbUser = await prisma.user.findUnique({ where: { providerId: id } });
    if (dbUser) {
        // Potentially update display name/login if changed? For now, just return found user.
        // Consider adding an update check here later if needed.
        return { id: dbUser.providerId, login: dbUser.login, displayName: dbUser.displayName };
    }

    // If not in DB, fetch from Twitch API

    const apiUser = await handleApiRequest(() => apiClient.users.getUserById(id), authProvider);
    if (!apiUser) {
        return null;
    }

    // Upsert user into DB
    await prisma.user.upsert({
        where: { providerId: apiUser.id },
        update: { login: apiUser.name, displayName: apiUser.displayName },
        create: { providerId: apiUser.id, login: apiUser.name, displayName: apiUser.displayName },
    });

    return {
        id: apiUser.id,
        login: apiUser.name,
        displayName: apiUser.displayName,
        // Note: profilePictureUrl and description are not stored/returned in this simplified DbUser type
    };
};

// Simple per-channel message queue
const channelQueues: Map<string, Queue> = new Map();

export async function sendChatMessageToChannel(broadcaster_id: string, sender_id: string, message: string) {
    let q = channelQueues.get(broadcaster_id);
    if (!q) {
        q = new Queue({ results: [], concurrency: 1, autostart: true });
        channelQueues.set(broadcaster_id, q);
    }

    q.push(async () => {
        try {
            const res = await apiClient.chat.sendChatMessageAsApp(sender_id, broadcaster_id, message);
            return res;
        } catch (error) {
            logger.error(error, `Error sending chat ${message} to channel ${broadcaster_id}`);
            return null;
        }
    });
}

export async function getChannelsModForUser(userId: string, api: ApiClient): Promise<string[]> {
    try {
        const mods = await api.moderation.getModeratedChannelsPaginated(userId).getAll();
        return mods.map(mod => mod.name);
    } catch (error) {
        logger.error(error, `Error fetching mod channels for user ${userId}`);
        return [];
    }
}

export async function getStreamByUsername(username: string) {
    try {
        const stream = await apiClient.streams.getStreamByUserName(username);
        return stream;
    } catch (error) {
        logger.error(error, `Error fetching stream for user ${username}`);
        return null;
    }
}
export async function getStreamByUserId(userid: string) {
    try {
        const stream = await apiClient.streams.getStreamByUserId(userid);
        return stream;
    } catch (error) {
        logger.error(error, `Error fetching stream for user ${userid}`);
        return null;
    }
}
