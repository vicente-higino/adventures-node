import { Context } from "hono";
import { Env } from "../types";
import { PrismaClient } from "@prisma/client"; // Import PrismaClient and User
import { ApiClient } from "@twurple/api";
// import { AppTokenAuthProviderWithStore } from "./auth";
import { AppTokenAuthProvider } from "@twurple/auth";
import env from "env";
const { TWITCH_CLIENT_ID, TWITCH_CLIENT_SECRET } = env;
export function buildUrl(baseUrl: string, params: Record<string, string>): string {
    const url = new URL(baseUrl);
    Object.entries(params).forEach(([key, value]) => {
        url.searchParams.append(key, value);
    });
    return url.toString();
}

// Define a consistent user type for return values
type DbUser = {
    id: string; // Corresponds to providerId
    login: string;
    displayName: string;
};

const authProvider = new AppTokenAuthProvider(TWITCH_CLIENT_ID, TWITCH_CLIENT_SECRET);

async function handleApiRequest<T>(apiCall: () => Promise<T>, authProvider: AppTokenAuthProvider): Promise<T | null> {
    try {
        return await apiCall();
    } catch (error: any) {
        if (error.statusCode === 401) {
            console.error("401 Unauthorized. Fetching new token...");
            await authProvider.getAppAccessToken(true);
            return await apiCall(); // Retry the API call
        }
        console.error("Error during API request:", error);
        return null;
    }
}

export const getUserByUsername = async (
    c: Context<Env>,
    prisma: PrismaClient, // Add prisma client
    username: string,
): Promise<DbUser | null> => {
    // Change return type
    // Check DB first
    username = username.toLowerCase();
    const dbUser = await prisma.user.findUnique({ where: { login: username } });
    if (dbUser) {
        return { id: dbUser.providerId, login: dbUser.login, displayName: dbUser.displayName };
    }

    // If not in DB, fetch from Twitch API
    const apiClient = new ApiClient({ authProvider });
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

export const getUserById = async (
    c: Context<Env>,
    prisma: PrismaClient, // Add prisma client
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
    const apiClient = new ApiClient({ authProvider });
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
