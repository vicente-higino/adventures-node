import { z } from "zod";
import 'dotenv/config';

const envSchema = z.object({
    TWITCH_CLIENT_ID: z.string({
        required_error: "Missing environment variable: TWITCH_CLIENT_ID"
    }),
    TWITCH_CLIENT_SECRET: z.string({
        required_error: "Missing environment variable: TWITCH_CLIENT_SECRET"
    }),
    DATABASE_URL: z.string({
        required_error: "Missing environment variable: DATABASE_URL"
    }),
    COOLDOWN_FISHING_IN_HOURS: z.coerce.number({
        required_error: "Missing environment variable: COOLDOWN_FISHING_IN_HOURS"
    }),
    COOLDOWN_ADVENTURE_IN_HOURS: z.coerce.number({
        required_error: "Missing environment variable: COOLDOWN_ADVENTURE_IN_HOURS"
    }),

});

// Parse and validate environment variables
const env = envSchema.safeParse(process.env);

if (!env.success) {
    console.error("❌ Environment validation error:");
    env.error.issues.forEach(issue => {
        console.error(`- ${issue.message}`);
    });
    process.exit(1); // Stop the app if required vars are missing
}

export default env.data;