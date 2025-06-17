import { Context, Next } from "hono";
import { FossaContext, fossaContextSchema, HonoEnv } from "@/types";

export const authMiddleware = async (c: Context<HonoEnv>, next: Next) => {
    const provider = c.req.header("x-fossabot-channelprovider");
    if (provider !== "twitch") {
        return c.text("This is only available in twitch chat.");
    }
    const token = c.req.header("x-fossabot-customapitoken") ?? "";

    try {
        console.log(`Validating fossa token: ${token}`);
        const context = await fetchFossaContext(token);
        if (context) {
            return next();
        }
        return c.text("Unauthorized", 403);
    } catch (error) {
        return c.text("Unauthorized", 403);
    }
};

const roles = ["broadcaster", "moderator"];

function canExecute(context: FossaContext): boolean {
    if (context.message) {
        console.log(context.message.user.roles);

        return context.message.user.roles.some(r => roles.includes(r.type));
    }
    return false;
}

function validateContext(context: unknown): FossaContext | null {
    const result = fossaContextSchema.safeParse(context);
    if (result.success) {
        return result.data;
    } else {
        console.error("Invalid context:", result.error);
        return null;
    }
}
async function fetchFossaContext(token: string): Promise<FossaContext | null> {
    try {
        const context = await fetch(`https://api.fossabot.com/v2/customapi/context/${token}`);
        if (context.ok) {
            const data = await context.json();
            return validateContext(data);
        }
        console.error("No context found in request");
        return null;
    } catch (error) {
        console.error(error);
        return null;
    }
}
