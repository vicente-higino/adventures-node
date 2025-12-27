import { Context } from "hono";
import { FossaHeaders, HonoEnv } from "@/types";
import { z } from "zod";
import { OpenAPIRoute } from "chanfana";
import { getUserById } from "@/twitch/api";
import { createUserIdParam } from "@/utils/params";
import { handleUpdateSilver } from "@/common/handleUpdateSilver";
import { prisma } from "@/prisma";

export class PointUpdate extends OpenAPIRoute {
    schema = {
        request: {
            headers: FossaHeaders,
            params: z.object({
                userId: createUserIdParam(),
                newBalance: z
                    .number({ description: "New balance", invalid_type_error: "New balance must be a number" })
                    .min(0, "Value must be positive")
                    .default(500),
            }),
        },
        responses: {},
    };
    handleValidationError(): Response {
        const msg = "Usage: !updatesilver <username> <new_balance>";
        return new Response(msg, { status: 400 });
    }
    async handle(c: Context<HonoEnv>) {
        const data = await this.getValidatedData<typeof this.schema>();
        const channelLogin = data.headers["x-fossabot-channellogin"];
        const channelProviderId = data.headers["x-fossabot-channelproviderid"];
        const username = data.headers["x-fossabot-message-userdisplayname"];
        const userProviderId = data.params.userId ?? data.headers["x-fossabot-message-userproviderid"];
        const user = await getUserById(prisma, userProviderId);
        if (!user) {
            return c.text(`${username}, user not found`, { status: 404 });
        }
        const userDisplayName = user.displayName;
        const userLogin = user.login;

        const result = await handleUpdateSilver({
            channelLogin,
            channelProviderId,
            userProviderId,
            userLogin,
            userDisplayName,
            newBalance: data.params.newBalance,
            prefix: "!",
        });
        return c.text(result);
    }
}
