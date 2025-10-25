import { Context } from "hono";
import { FossaHeaders, HonoEnv } from "@/types";
import { z } from "zod";
import { OpenAPIRoute } from "chanfana";
import { createUserIdParam } from "@/utils/params";
import { handleDuelCancel } from "@/common/handleDuels";

export class DuelCancel extends OpenAPIRoute {
    schema = {
        request: {
            headers: FossaHeaders,
            params: z.object({
                challengedId: createUserIdParam("User id of the other player").optional(),
            }),
        },
        responses: {},
    };
    handleValidationError(): Response {
        const msg = "Usage: !cancelduel [username] OR !deny [username]";
        return new Response(msg, { status: 400 });
    }
    async handle(c: Context<HonoEnv>) {
        const data = await this.getValidatedData<typeof this.schema>();
        const channelProviderId = data.headers["x-fossabot-channelproviderid"];
        const currentUserId = data.headers["x-fossabot-message-userproviderid"];
        const userDisplayName = data.headers["x-fossabot-message-userdisplayname"];
        const { challengedId } = data.params;

        const result = await handleDuelCancel({
            channelProviderId,
            currentUserId,
            userDisplayName,
            challengedId,
        });
        return c.text(result);
    }
}
