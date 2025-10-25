import { OpenAPIRoute } from "chanfana";
import { HonoEnv, FossaHeaders } from "@/types";
import { Context } from "hono";
import { handleAdventureEnd } from "@/common/handleAdventure";


export class AdventureEnd extends OpenAPIRoute {
    schema = { request: { headers: FossaHeaders }, responses: {} };

    async handle(c: Context<HonoEnv>) {
        // Get validated data
        const data = await this.getValidatedData<typeof this.schema>();
        const channelLogin = data.headers["x-fossabot-channellogin"];
        const channelProviderId = data.headers["x-fossabot-channelproviderid"];
        const userProviderId = data.headers["x-fossabot-message-userproviderid"];
        const userDisplayName = data.headers["x-fossabot-message-userdisplayname"];
        const userLogin = data.headers["x-fossabot-message-userlogin"];
        const result = await handleAdventureEnd({
            channelLogin,
            channelProviderId,
            userProviderId,
            userLogin,
            userDisplayName,
        });
        return c.text(result);
    }
}
