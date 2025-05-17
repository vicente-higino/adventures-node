import { OpenAPIRoute } from "chanfana";
import { Env, FossaHeaders } from "../types";
import { Context } from "hono";
import { increaseBalanceWithChannelID, updateUserAdventureStats } from "db";
import { runGroupAdventure } from "adventures";
import { formatSilver, limitMessageLength, limitAdvMessage } from "../utils/misc";
import { Mutex } from "async-mutex";
const mutex = new Mutex();
export class AdventureEnd extends OpenAPIRoute {
    schema = { request: { headers: FossaHeaders }, responses: {} };

    async handle(c: Context<Env>) {
        // Get validated data
        const data = await this.getValidatedData<typeof this.schema>();
        const prisma = c.get("prisma");
        const channelLogin = data.headers["x-fossabot-channellogin"];
        const channelProviderId = data.headers["x-fossabot-channelproviderid"];
        const userProviderId = data.headers["x-fossabot-message-userproviderid"];
        const userLogin = data.headers["x-fossabot-message-userlogin"];
        const userDisplayName = data.headers["x-fossabot-message-userdisplayname"];
        const lockName = `AdventureEndLock-${channelProviderId}`;
        const adv = await prisma.adventure.findFirst({
            where: { channelProviderId: channelProviderId, name: { not: "DONE" } },
            orderBy: { createdAt: "desc" },
        });
        if (!adv) {
            return c.text("No adventure found, try starting one first.");
        }
        const timeDiff = Date.now() - adv.createdAt.getTime();
        const timeLimit = 1000 * 60 * 2; // 2 minutes
        // const canEndAdv =
        // 	players.find((p) => p.user.providerId === userProviderId) ?? false;
        if (timeDiff < timeLimit && adv.name !== userProviderId) {
            return c.text(`@${userDisplayName}, only the owner can end the adventure in the first 2 minutes.`);
        }
        const locked = mutex.isLocked();
        if (locked) {
            return c.text("");
        }
        await mutex.acquire();
        const players = await prisma.player.findMany({
            where: { adventureId: adv.id },
            include: { user: { select: { displayName: true, providerId: true, balances: true } } },
        });
        const advResults = runGroupAdventure(players.map(p => p.user.displayName));

        // Get the payout rate from the adventure or default to 1.3 if not set
        const payoutRate = adv.payoutRate || 1.3;
        const formattedPayoutRate = payoutRate.toFixed(2);

        // Combine player data with adventure results
        const combinedResults = players.map(player => ({ ...player, result: advResults.results.find(r => r.player === player.user.displayName) }));

        // Filter winners and losers using the combined data
        const winners = combinedResults.filter(p => p.result?.outcome === "win");
        const losers = combinedResults.filter(p => p.result?.outcome === "lose");

        if (winners.length > 0) {
            const promises = [];
            const resultArr = [];

            // Convert winner operations to promises
            for (const p of winners) {
                // Use the dynamic payout rate instead of hardcoded 1.3
                const winAmount = Math.ceil(p.buyin * payoutRate);
                const profit = Math.ceil(p.buyin * (payoutRate - 1));

                promises.push(
                    increaseBalanceWithChannelID(prisma, channelProviderId, p.user.providerId, winAmount),
                    updateUserAdventureStats(prisma, channelLogin, channelProviderId, p.user.providerId, {
                        wagerAmount: p.buyin,
                        winAmount: winAmount,
                        didWin: true,
                    }),
                );
                resultArr.push({ displayName: p.user.displayName, profit: profit });
            }

            // Sort results by profit descending
            resultArr.sort((a, b) => b.profit - a.profit);

            // Format the sorted results for display
            const formattedResults = resultArr.map(r => `@${r.displayName} (+${formatSilver(r.profit)} silver)`);
            let joinedResults = formattedResults.join(", ");

            // Add loser stat updates to promises
            promises.push(
                ...losers.map(p =>
                    updateUserAdventureStats(prisma, channelLogin, channelProviderId, p.user.providerId, {
                        wagerAmount: p.buyin,
                        winAmount: 0,
                        didWin: false,
                    }),
                ),
            );

            // Add adventure cleanup operations
            promises.push(
                prisma.adventure.deleteMany({ where: { channelProviderId: channelProviderId, id: { not: adv.id }, name: "DONE" } }),
                prisma.adventure.update({ where: { id: adv.id }, data: { name: "DONE" } }),
            );

            await Promise.all(promises);

            // Compose the message and limit advResults.message
            const base = ` The adventure ended with a ${formattedPayoutRate}x payout rate! Survivors are: ${joinedResults}.`;
            let advMsg = limitAdvMessage(base, advResults.message);
            let message = `${advMsg}${base}`;
            // Final fallback in case of edge case overflow
            message = limitMessageLength(message);

            return c.text(message);
        }

        // All players lost case
        const promises = [
            ...players.map(p =>
                updateUserAdventureStats(prisma, channelLogin, channelProviderId, p.user.providerId, {
                    wagerAmount: p.buyin,
                    winAmount: 0,
                    didWin: false,
                }),
            ),
            prisma.adventure.deleteMany({ where: { channelProviderId: channelProviderId, id: { not: adv.id }, name: "DONE" } }),
            prisma.adventure.update({ where: { id: adv.id }, data: { name: "DONE" } }),
        ];

        await Promise.all(promises);
        mutex.release();
        // Compose the message and limit advResults.message
        const base = " The adventure ended! No survivors. All players lost their silver.";
        let advMsg = limitAdvMessage(base, advResults.message);
        let message = `${advMsg}${base}`;
        // Final fallback in case of edge case overflow
        message = limitMessageLength(message);

        return c.text(message);
    }
}
