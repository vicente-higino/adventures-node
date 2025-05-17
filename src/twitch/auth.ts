import { AppTokenAuthProvider, AuthProvider, AccessToken } from "@twurple/auth";

// Define a minimal Store interface if not already available
interface Store {
    get(key: string): Promise<string | null>;
    put(key: string, value: string): Promise<void>;
}

export class AppTokenAuthProviderWithStore extends AppTokenAuthProvider {
    private store: Store;

    constructor(clientId: string, clientSecret: string, store: Store) {
        super(clientId, clientSecret);
        this.store = store;
    }

    override async getAnyAccessToken(): Promise<AccessToken> {
        return this.getAppAccessToken();
    }
    override async getAppAccessToken(forceNew?: boolean): Promise<AccessToken> {
        const tokenStr = await this.store.get<AccessToken>("twitch_access_token", "json");
        if (tokenStr && !forceNew) {
            // Validate the token using expiresIn and obtainmentTimestamp
            const currentTime = Date.now();
            const tokenExpiryTime = tokenStr.obtainmentTimestamp + tokenStr.expiresIn! * 1000;
            if (tokenExpiryTime > currentTime) {
                console.log("Valid token found in KV:", tokenStr);
                return tokenStr;
            } else {
                console.log("Invalid or expired token found in KV. Removing...");
                await this.store.delete("twitch_access_token");
            }
        }
        const token = await super.getAppAccessToken(forceNew);
        console.log("Fetched new token:", token);
        await this.store.put("twitch_access_token", JSON.stringify(token), { expirationTtl: token.expiresIn ?? 60 * 60 * 24 });
        console.log("Token stored in KV");
        return token;
    }

    private async setAccessToken(token: string): Promise<void> {
        await this.store.put("twitch_access_token", token);
    }
}

// Add the KVStore class
export class KVStore implements Store {
    private kv: KVNamespace;

    constructor(kvNamespace: KVNamespace) {
        this.kv = kvNamespace;
    }

    async get(key: string): Promise<string | null> {
        return this.kv.get(key);
    }

    async put(key: string, value: string): Promise<void> {
        await this.kv.put(key, value);
    }
}
