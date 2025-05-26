import { Context } from "hono";
import { FossaHeaders, HonoEnv } from "@/types"; // Import Env
import { z } from "zod";
import { OpenAPIRoute } from "chanfana";
import { getUserById } from "@/twitch/api"; // Ensure getUserById is imported
import { findOrCreateBalance } from "@/db"; // Ensure findOrCreateBalance is imported
import { getUserSilverString } from "@/common/userSilver";
import { createUserIdParam } from "@/utils/params";
export class Point extends OpenAPIRoute {
    override schema = { request: { headers: FossaHeaders, params: z.object({ userId: createUserIdParam() }) }, responses: {} };
    override handleValidationError(errors: z.ZodIssue[]): Response {
        const msg = "Usage: !silver [username]";
        return new Response(msg, { status: 400 });
    }
    override async handle(c: Context<HonoEnv>) {
        // Get validated data
        const data = await this.getValidatedData<typeof this.schema>();
        const prisma = c.get("prisma");

        const channelLogin = data.headers["x-fossabot-channellogin"];
        const channelProviderId = data.headers["x-fossabot-channelproviderid"];
        let userProviderId = data.headers["x-fossabot-message-userproviderid"];
        let userLogin = data.headers["x-fossabot-message-userlogin"];
        let userDisplayName = data.headers["x-fossabot-message-userdisplayname"];
        if (data.params.userId && data.params.userId !== data.headers["x-fossabot-message-userproviderid"]) {
            const user = await getUserById(c, prisma, data.params.userId); // Pass prisma
            userProviderId = user?.id ?? data.headers["x-fossabot-message-userproviderid"];
            userLogin = user?.login ?? data.headers["x-fossabot-message-userlogin"];
            userDisplayName = user?.displayName ?? data.headers["x-fossabot-message-userdisplayname"];
        }
        const result = await getUserSilverString({
            prisma,
            channelLogin,
            channelProviderId,
            userProviderId,
            userLogin,
            userDisplayName
        });
        return c.text(result);
    }
}
