import { Context, Next } from "hono";
import { Env } from "types";

export const authMiddleware = async (c: Context<Env>, next: Next) => {
    const provider = c.req.header("x-fossabot-channelprovider");
    if (provider !== "twitch") {
        return c.text("This is only available in twitch chat.");
    }
    const token = c.req.header("x-fossabot-customapitoken") ?? "";

    const timeoutDuration = 5000; // 5-second timeout
    const controller = new AbortController();
    const timeoutId = setTimeout(() => {
        console.log(`Fetch timeout for token: ${token}`);
        controller.abort();
    }, timeoutDuration);

    try {
        console.log(`Validating fossa token: ${token}`);
        const response = await fetch(`https://api.fossabot.com/v2/customapi/validate/${token}`, { signal: controller.signal });
        console.log(`Valid token: ${token}`);
        clearTimeout(timeoutId);

        // If fetch completes before timeout
        const total = response.headers.get("x-ratelimit-total") ?? "N/A";
        const remaining = response.headers.get("x-ratelimit-remaining") ?? "N/A";
        const resetTimestamp = response.headers.get("x-ratelimit-reset");
        let resetMessage = "Please try again later.";
        let timeUntilReset = -1;

        if (resetTimestamp) {
            const resetTime = parseInt(resetTimestamp, 10) * 1000;
            const now = Date.now();
            timeUntilReset = Math.max(0, Math.ceil((resetTime - now) / 1000));

            if (timeUntilReset > 0) {
                resetMessage = `Please try again in ${timeUntilReset} seconds.`;
            }
        }
        if (response.status === 429) {
            console.log(
                `Rate limit hit for token ending with ...${token.slice(-4)}. Status: 429. Remaining: ${remaining}/${total}. Resets in: ${timeUntilReset >= 0 ? timeUntilReset + "s" : "N/A"}`,
            );

            const headers = { "x-ratelimit-total": total, "x-ratelimit-remaining": remaining, "x-ratelimit-reset": resetTimestamp ?? "" };
            return c.text(`Rate limit exceeded. ${resetMessage} (Remaining: ${remaining}/${total})`, 429, headers);
        }
        if (response.status !== 200) {
            console.error(`Fossabot API validation failed for token ending with ...${token.slice(-4)}. Status: ${response.status}`);
            // return c.text(`Something went wrong. ${resetMessage}`, response.status as ContentfulStatusCode);
        }
        // If validation is successful (status 200)
        return next();
    } catch (error: any) {
        clearTimeout(timeoutId);
        if (error.name === "AbortError") {
            console.error(`Fossabot API validation timed out for token ending with ...${token.slice(-4)}.`);
        } else {
            console.error(`Fossabot API validation failed for token ending with ...${token.slice(-4)}.`);
        }
        return next();
    }
};
