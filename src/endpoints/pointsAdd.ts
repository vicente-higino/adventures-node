import { OpenAPIRoute } from "chanfana";
import { z } from "zod";
import { HonoEnv, FossaHeaders } from "@/types";
import { Context } from "hono";
import { getUserById } from "@/twitch/api";
import { createUserIdParam } from "@/utils/params";
import { handleAddSilver } from "@/common/handleAddSilver";
import { prisma } from "@/prisma";

export class PointAdd extends OpenAPIRoute {
    schema = {
        request: {
            headers: FossaHeaders,
            params: z.object({
                userId: createUserIdParam(),
                add: z.number({ description: "Added amount", invalid_type_error: "Added amount must be a number" }).default(1),
            }),
        },
        responses: {},
    };
    handleValidationError(): Response {
        const msg = "Usage: !addsilver <username> <amount>";
        return new Response(msg, { status: 400 });
    }
    async handle(c: Context<HonoEnv>) {
        const data = await this.getValidatedData<typeof this.schema>();
        const channelLogin = data.headers["x-fossabot-channellogin"];
        const channelProviderId = data.headers["x-fossabot-channelproviderid"];
        const userProviderId = data.params.userId ?? data.headers["x-fossabot-message-userproviderid"];
        const username = data.headers["x-fossabot-message-userdisplayname"];

        const user = await getUserById(prisma, userProviderId);
        if (!user) {
            return c.text(`${username}, user not found`, { status: 404 });
        }
        const userDisplayName = user.displayName;
        const userLogin = user.login;

        const result = await handleAddSilver({
            channelLogin,
            channelProviderId,
            userProviderId,
            userLogin,
            userDisplayName,
            add: data.params.add,
            prefix: "!",
        });
        return c.text(result);
    }
}
