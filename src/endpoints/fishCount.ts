import { OpenAPIRoute } from "chanfana";
import { z } from "zod";
import { type HonoEnv, FossaHeaders } from "@/types";
import type { Context } from "hono";
import { getUserById } from "@/twitch/api";
import { createUserIdParam } from "@/utils/params";
import { getFishCountSummary } from "@/common/fishCountSummary";

export class FishCount extends OpenAPIRoute {
    schema = { request: { headers: FossaHeaders, params: z.object({ userId: createUserIdParam() }) }, responses: {} };
    handleValidationError(): Response {
        const msg = "Usage: !fishcount [username]";
        return new Response(msg, { status: 400 });
    }
    async handle(c: Context<HonoEnv>) {
        const data = await this.getValidatedData<typeof this.schema>();
        const prisma = c.get("prisma");
        const channelLogin = data.headers["x-fossabot-channellogin"];
        const channelProviderId = data.headers["x-fossabot-channelproviderid"];
        let userProviderId = data.headers["x-fossabot-message-userproviderid"];
        let userLogin = data.headers["x-fossabot-message-userlogin"];
        let userDisplayName = data.headers["x-fossabot-message-userdisplayname"];
        if (data.params.userId && data.params.userId !== data.headers["x-fossabot-message-userproviderid"]) {
            const user = await getUserById(prisma, data.params.userId);
            userProviderId = user?.id ?? data.headers["x-fossabot-message-userproviderid"];
            userLogin = user?.login ?? data.headers["x-fossabot-message-userlogin"];
            userDisplayName = user?.displayName ?? data.headers["x-fossabot-message-userdisplayname"];
        }
        const summary = await getFishCountSummary({ prisma, channelLogin, channelProviderId, userProviderId, userLogin, userDisplayName });
        return c.text(summary);
    }
}
