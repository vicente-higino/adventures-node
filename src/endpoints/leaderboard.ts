import { OpenAPIRoute } from "chanfana";
import { type HonoEnv, FossaHeaders } from "@/types";
import { getLeaderboard, leaderboardSchema } from "@/common/leaderboardHandler";
import type { Context } from "hono";

export class ConsolidatedLeaderboard extends OpenAPIRoute {
    schema = { request: { headers: FossaHeaders, params: leaderboardSchema }, responses: {} };
    handleValidationError(): Response {
        // Concise usage message
        const msg =
            "Usage: !leaderboard [duel-][wins|played|wagered|profit|streak] | fish[-silver|-avg|-fines|-rarity|-top|-treasure] | silver [-asc|-bottom] [amount] (default: silver, 5)";
        return new Response(msg, { status: 400 });
    }
    async handle(c: Context<HonoEnv>) {
        const data = await this.getValidatedData<typeof this.schema>();
        const prisma = c.get("prisma");
        const channelProviderId = data.headers["x-fossabot-channelproviderid"];

        const result = await getLeaderboard(prisma, channelProviderId, data.params);

        if (typeof result === "string") {
            return c.text(result, { status: 400 });
        }

        if (result.formattedLeaderboard.length === 0) {
            return c.text(`No data found for leaderboard.`);
        }

        const direction = data.params.sortBy.includes("-asc") ? "Bottom" : "Top";
        return c.text(
            `${result.leaderboardType} ${direction} ${data.params.amount} By ${result.metricDisplay.replace(/_/g, " ")}:$(newline)${result.formattedLeaderboard.join(" | ")}`,
        );
    }
}
