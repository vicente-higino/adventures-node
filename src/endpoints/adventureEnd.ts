import { OpenAPIRoute } from "chanfana";
import { HonoEnv, FossaHeaders } from "@/types";
import { Context } from "hono";
import { increaseBalanceWithChannelID, updateUserAdventureStats } from "@/db";
import { runGroupAdventure } from "@/adventures";
import { calculateWinStreakBonus, calculateLoseStreakBonus, formatSilver, limitMessageLength, limitAdvMessage } from "@/utils/misc";
import { Mutex } from "async-mutex";
export const advEndMutex = new Mutex();
interface ResultArrItem {
    displayName: string;
    profit: number;
    streakBonus: number;
    streak: number;
}
export class AdventureEnd extends OpenAPIRoute {
    schema = { request: { headers: FossaHeaders }, responses: {} };

    async handle(c: Context<HonoEnv>) {
        // Get validated data
        const data = await this.getValidatedData<typeof this.schema>();
        const prisma = c.get("prisma");
        const channelLogin = data.headers["x-fossabot-channellogin"];
        const channelProviderId = data.headers["x-fossabot-channelproviderid"];
        const userProviderId = data.headers["x-fossabot-message-userproviderid"];
        const userDisplayName = data.headers["x-fossabot-message-userdisplayname"];
        const adv = await prisma.adventure.findFirst({
            where: { channelProviderId: channelProviderId, name: { not: "DONE" } },
            orderBy: { createdAt: "desc" },
        });
        if (!adv) {
            return c.text("No adventure found, try starting one first.");
        }
        const timeDiff = Date.now() - adv.createdAt.getTime();
        const timeLimit = 1000 * 60 * 10;

        if (timeDiff < timeLimit && adv.name !== userProviderId) {
            return c.text(`@${userDisplayName}, only the owner can end the adventure in the first 10 minutes.`);
        }
        const locked = advEndMutex.isLocked();
        if (locked) {
            return c.text("");
        }
        const release = await advEndMutex.acquire();
        try {
            const players = await prisma.player.findMany({
                where: { adventureId: adv.id },
                include: { user: { select: { displayName: true, providerId: true, balances: true } } },
            });
            const advResults = runGroupAdventure(players.map(p => p.user.displayName));

            // Get the payout rate from the adventure or default to 1.3 if not set
            const payoutRate = adv.payoutRate || 1.3;
            const formattedPayoutRate = payoutRate.toFixed(2);

            // Combine player data with adventure results
            const combinedResults = players.map(player => ({
                ...player,
                result: advResults.results.find(r => r.player === player.user.displayName),
            }));

            // Filter winners and losers using the combined data
            const winners = combinedResults.filter(p => p.result?.outcome === "win");
            const losers = combinedResults.filter(p => p.result?.outcome === "lose");

            if (winners.length > 0) {
                let promises = [];
                const resultArr: ResultArrItem[] = [];

                // Convert winner operations to promises
                for (const p of winners) {
                    const winAmount = Math.ceil(p.buyin * payoutRate);
                    const profit = Math.ceil(p.buyin * (payoutRate - 1));

                    promises.push(
                        (async () => {
                            const stats = await updateUserAdventureStats(prisma, channelLogin, channelProviderId, p.user.providerId, {
                                wagerAmount: p.buyin,
                                winAmount: winAmount,
                                didWin: true,
                            });

                            const streakBonus = calculateWinStreakBonus(stats.newStreak, stats.streakWager);

                            await increaseBalanceWithChannelID(prisma, channelProviderId, p.user.providerId, winAmount + streakBonus);

                            resultArr.push({ displayName: p.user.displayName, profit: profit + streakBonus, streakBonus, streak: stats.newStreak });
                        })(),
                    );
                }

                const loserMessages: string[] = [];
                promises.push(
                    ...losers.map(async p => {
                        const stats = await updateUserAdventureStats(prisma, channelLogin, channelProviderId, p.user.providerId, {
                            wagerAmount: p.buyin,
                            winAmount: 0,
                            didWin: false,
                        });

                        const loseBonus = calculateLoseStreakBonus(stats.newStreak, stats.streakWager);
                        if (loseBonus > 0) {
                            await increaseBalanceWithChannelID(prisma, channelProviderId, p.user.providerId, loseBonus);
                            loserMessages.push(`@${p.user.displayName} (+${formatSilver(loseBonus)} silver bonus, ${stats.newStreak}x lose streak)`);
                        }
                    }),
                );

                await Promise.all(promises);

                promises = [];
                resultArr.sort((a, b) => b.profit - a.profit);
                const winnerMessages = resultArr.map(r => {
                    const streakMsg = r.streakBonus > 0 ? ` (+${formatSilver(r.streakBonus)} bonus, ${r.streak}x win streak)` : "";
                    return `@${r.displayName} (+${formatSilver(r.profit - r.streakBonus)}${streakMsg} silver)`;
                });
                const loseStreakMsg = loserMessages.length > 0 ? ` ${loserMessages.join(", ")}` : "";
                const joinedResults = `${winnerMessages.join(", ")}${loseStreakMsg}`;

                // Process losers with lose streak bonuses
                // await Promise.all(promises);
                // Add adventure cleanup operations
                promises.push(
                    prisma.adventure.deleteMany({ where: { channelProviderId: channelProviderId, id: { not: adv.id }, name: "DONE" } }),
                    prisma.adventure.update({ where: { id: adv.id }, data: { name: "DONE" } }),
                );

                await Promise.all(promises);
                // Compose the message and limit advResults.message
                const base = ` The adventure ended with a ${formattedPayoutRate}x payout rate! Survivors are: ${joinedResults}.`;
                const advMsg = limitAdvMessage(base, advResults.message);
                let message = `${advMsg}${base}`;
                // Final fallback in case of edge case overflow
                message = limitMessageLength(message);

                return c.text(message);
            }

            // All players lost case
            const promises = [];
            const loserMessages: string[] = [];

            promises.push(
                ...players.map(async p => {
                    const stats = await updateUserAdventureStats(prisma, channelLogin, channelProviderId, p.user.providerId, {
                        wagerAmount: p.buyin,
                        winAmount: 0,
                        didWin: false,
                    });

                    const loseBonus = calculateLoseStreakBonus(stats.newStreak, stats.streakWager);
                    if (loseBonus > 0) {
                        await increaseBalanceWithChannelID(prisma, channelProviderId, p.user.providerId, loseBonus);
                        loserMessages.push(`@${p.user.displayName} (+${formatSilver(loseBonus)} silver bonus, ${stats.newStreak}x lose streak)`);
                    }
                }),
            );

            promises.push(
                prisma.adventure.deleteMany({ where: { channelProviderId: channelProviderId, id: { not: adv.id }, name: "DONE" } }),
                prisma.adventure.update({ where: { id: adv.id }, data: { name: "DONE" } }),
            );

            await Promise.all(promises);

            // Compose the message and limit advResults.message
            const loseStreakMsg = loserMessages.length > 0 ? ` ${loserMessages.join(", ")}.` : "";
            const base = ` The adventure ended! No survivors. All players lost their silver. ${loseStreakMsg}`;
            const advMsg = limitAdvMessage(base, advResults.message);
            let message = `${advMsg}${base}`;
            // Final fallback in case of edge case overflow
            message = limitMessageLength(message);
            return c.text(message);
        } finally {
            release();
        }
    }
}
