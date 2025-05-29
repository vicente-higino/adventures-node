import { OpenAPIRoute } from "chanfana";
import { z } from "zod";
import { HonoEnv, FossaHeaders } from "@/types";
import { Context } from "hono";
import { findOrCreateBalance, setBalance } from "@/db";
import dayjs from "dayjs";
import relativeTime from "dayjs/plugin/relativeTime";
// Import calculateAmount instead of having it locally
import { pickRandom, roundToDecimalPlaces, calculateAmount, delay, sendActionToChannel } from "@/utils/misc";
import { formatTimeToWithSeconds } from "@/utils/time";
// Add import for emotes
import { ADVENTURE_COOLDOWN_EMOTES } from "@/emotes";
import { Mutex } from "async-mutex";
import { advEndMutex } from "./adventureEnd";
import { sendMessageToChannel } from "@/utils/misc"; // <-- Add this import (implement if needed)
import { PrismaClient } from "@prisma/client";
dayjs.extend(relativeTime);

const coolDownMinutes = (c: Context<HonoEnv>) => 60 * c.env.COOLDOWN_ADVENTURE_IN_HOURS;
const cooldown = (c: Context<HonoEnv>) => new Date(Date.now() - 1000 * 60 * coolDownMinutes(c));

/**
 * Generates a payout rate for the adventure, with 1.3x being most common
 * and max of 2.0x
 *
 * @returns A number between 1.3 and 2.0 representing the payout multiplier
 */
export function generatePayoutRate(): number {
    // Random chance to get higher multipliers
    const rand = Math.random();
    if (rand > 0.975) {
        // 2.5% chance for max payout (2.0x)
        return 2.0;
    } else if (rand > 0.925) {
        // 5% chance for high payout (1.7-1.9x)
        return 1.7 + Math.random() * 0.2;
    } else if (rand > 0.65) {
        // 27.5% chance for medium payout (1.5-1.6x)
        return 1.5 + Math.random() * 0.1;
    } else {
        // 65% chance for standard payout (1.3-1.4x)
        return 1.3 + Math.random() * 0.1;
    }
}
const mutex = new Mutex();
// Store timers per adventure to allow clearing if adventure ends early
const adventureWarningTimers: Record<string, NodeJS.Timeout[]> = {};
export class AdventureJoin extends OpenAPIRoute {
    schema = {
        request: {
            headers: FossaHeaders,
            params: z.object({
                amount: z
                    .string({
                        description: "Silver amount (number, K/M/B, percentage, 'all', or +/-delta)",
                        invalid_type_error:
                            "Silver amount must be a number, K/M/B (e.g., 5k), percentage (e.g., 50%), 'all', or a delta (e.g., +1k, -50%)",
                        required_error: "Silver amount is required",
                    })
                    // Updated regex to allow optional +/- prefix and K/M/B suffixes (case-insensitive)
                    .regex(/^[+-]?(all|\d+(\.\d+)?%|\d+(\.\d+)?[kmb]?|\d+)$/i, {
                        message:
                            "Amount must be a positive whole number, K/M/B (e.g., 5k), percentage (e.g., 50%), 'all', or a delta (e.g., +1k, -50%)",
                    }),
            }),
        },
        responses: {},
    };
    handleValidationError(errors: z.ZodIssue[]) {
        const msg = "Usage: !adventure|adv [silver(K/M/B)|%|all|+/-delta]";
        return new Response(msg, { status: 400 });
    }
    async handle(c: Context<HonoEnv>) {
        // Get validated data
        const data = await this.getValidatedData<typeof this.schema>();
        const prisma = c.get("prisma");
        const channelLogin = data.headers["x-fossabot-channellogin"];
        const channelProviderId = data.headers["x-fossabot-channelproviderid"];
        const userProviderId = data.headers["x-fossabot-message-userproviderid"];
        const userLogin = data.headers["x-fossabot-message-userlogin"];
        const userDisplayName = data.headers["x-fossabot-message-userdisplayname"];
        const lockName = `AdventureJoinLock-${channelProviderId}`;
        if (advEndMutex.isLocked()) return c.text(`@${userDisplayName}, the adventure has ended.`)
        const advDone = await prisma.adventure.findFirst({
            where: { channelProviderId: channelProviderId, name: "DONE" },
            orderBy: { createdAt: "desc" },
        });

        if (advDone && dayjs(advDone.createdAt).isAfter(cooldown(c))) {
            const timeUntilNext = dayjs(advDone.createdAt).add(coolDownMinutes(c), "minutes");
            return c.text(
                `@${userDisplayName}, adventure is in cooldown, please wait ${formatTimeToWithSeconds(timeUntilNext.toDate())} before starting a new one. 
                ${pickRandom(ADVENTURE_COOLDOWN_EMOTES)}`,
            );
        }
        const balance = await findOrCreateBalance(prisma, channelLogin, channelProviderId, userProviderId, userLogin, userDisplayName);
        const amountParam = data.params.amount.trim();
        const adv = await prisma.adventure.findFirst({
            where: { channelProviderId: channelProviderId, name: { not: "DONE" } },
            orderBy: { createdAt: "desc" },
            include: { players: { include: { user: true } } },
        });

        if (!adv) {
            // First join: treat as absolute or delta (delta is just the value itself)
            const buyin = calculateAmount(amountParam, balance.value);
            const newBuyin = Math.min(buyin, balance.value);
            const newBalanceValue = Math.max(balance.value - newBuyin, 0);
            // Use newBuyin which is capped at balance.value
            if (balance.value <= 0) {
                return c.text(`@${userDisplayName} you have no silver to join the adventure.`);
            }
            if (newBuyin <= 0) {
                return c.text(`@${userDisplayName} you need at least 1 silver to start an adventure.`);
            }
            const locked = mutex.isLocked();
            // const lockRes = await lock.lock(lockName);
            if (locked) {
                return c.text(`${userDisplayName}, there is already a adventure running. Try joining again.`);
            }
            await mutex.acquire();
            // Generate payout rate for new adventure
            const payoutRate = roundToDecimalPlaces(generatePayoutRate(), 2);
            const formattedPayoutRate = payoutRate.toFixed(2);

            const [_, adventure] = await Promise.all([
                // Use newBalanceValue and newBuyin
                setBalance(prisma, balance.id, newBalanceValue),
                prisma.adventure.create({
                    data: {
                        name: `${userProviderId}`,
                        channel: channelLogin,
                        channelProviderId: channelProviderId,
                        payoutRate: payoutRate, // Store the payout rate in the database
                        // Use newBuyin
                        players: { create: { buyin: newBuyin, userId: userProviderId } },
                    },
                }),
            ]);
            mutex.release();

            scheduleAdventureWarnings(prisma, channelLogin, adventure.id);

            return c.text(
                `@${userDisplayName} is trying to get a team together for some serious adventure business! Use "!adventure|adv [silver(K/M/B)|%|all|+/-delta]" to join in! Then use "!adventureend|advend" to end the adventure and get your rewards!
                This adventure offers a ${formattedPayoutRate}x payout rate! GAMBA
                $(newline)@${userDisplayName} joined the adventure with ${newBuyin} silver.`,
            );
        }
        if (adv.players.length >= 99) {
            return c.text(`@${userDisplayName} the adventure is full, please wait for the next one.`);
        }

        const player = adv.players.find(player => player.userId === userProviderId);
        if (!player) {
            // Not joined yet: treat as absolute or delta (delta is just the value itself)
            const buyin = calculateAmount(amountParam, balance.value);
            const newBuyin = Math.min(buyin, balance.value);
            const newBalanceValue = Math.max(balance.value - newBuyin, 0);
            // Use newBuyin which is capped at balance.value
            if (balance.value <= 0) {
                return c.text(`@${userDisplayName} you have no silver to join the adventure.`);
            }
            if (newBuyin <= 0) {
                return c.text(`@${userDisplayName} you need at least 1 silver to join the adventure.`);
            }

            await Promise.all([
                // Use newBalanceValue and newBuyin
                setBalance(prisma, balance.id, newBalanceValue),
                prisma.player.create({ data: { buyin: newBuyin, userId: userProviderId, adventureId: adv.id } }), // Use newBuyin
            ]);

            // Get the payout rate to display in the message
            const formattedPayoutRate = adv.payoutRate.toFixed(2);
            return c.text(`@${userDisplayName} joined the adventure with ${newBuyin} silver. Current payout rate: ${formattedPayoutRate}x`);
        }

        // Allow adjusting silver amount up or down
        const totalAvailable = balance.value + player.buyin;
        // Use calculateAmount for adjustment calculation, passing current buyin for delta support
        const requestedBuyin = calculateAmount(amountParam, totalAvailable, player.buyin);

        // Ensure requestedBuyin is at least 1
        if (requestedBuyin < 1) {
            return c.text(`@${userDisplayName} you must keep at least 1 silver in the adventure.`);
        }

        const updatedBuyin = Math.min(requestedBuyin, totalAvailable); // Cap at total available
        const newUpdatedBalance = Math.max(totalAvailable - updatedBuyin, 0); // Calculate new balance based on updatedBuyin

        if (updatedBuyin !== player.buyin) {
            // No need for buyin < 1 check here as it's handled above
            await Promise.all([
                setBalance(prisma, balance.id, newUpdatedBalance),
                prisma.player.update({ where: { id: player.id }, data: { buyin: updatedBuyin } }),
            ]);

            return c.text(
                `@${userDisplayName}, you updated your adventure silver from ${player.buyin} to ${updatedBuyin}. You have ${newUpdatedBalance} left.`,
            );
        }
        return c.text(`@${userDisplayName} already joined the adventure with ${player.buyin} silver.`);
    }
}

// Helper to schedule adventure warning messages with timer clearing
function scheduleAdventureWarnings(prisma: PrismaClient, channelLogin: string, adventureId: number) {
    // Clear any previous timers for this adventure
    if (adventureWarningTimers[adventureId]) {
        for (const timer of adventureWarningTimers[adventureId]) {
            clearTimeout(timer);
        }
    }
    adventureWarningTimers[adventureId] = [];

    const warnings = [
        {
            delay: 30 * 60 * 1000,
            message: `⚠️ 30 minutes have passed since the adventure started! Don't forget to end the adventure with !adventureend or !advend to claim your rewards!`
        },
        {
            delay: 40 * 60 * 1000,
            message: `⚠️ Ending the adventure in 5 minutes! Join now or update your silver with !adventure|adv to participate! dinkDonk`
        },
        {
            delay: 43 * 60 * 1000,
            message: `⚠️ Ending the adventure in 2 minutes! Join now or update your silver with !adventure|adv to participate! dinkDonk`
        },
        {
            delay: 45 * 60 * 1000,
            message: `!adventureend`
        }
    ];

    for (const { delay, message } of warnings) {
        const timer = setTimeout(async () => {
            const adv = await prisma.adventure.findUnique({ where: { id: adventureId } });
            if (!adv || adv.name === "DONE") {
                // Adventure ended, clear all remaining timers for this adventure
                if (adventureWarningTimers[adventureId]) {
                    for (const t of adventureWarningTimers[adventureId]) clearTimeout(t);
                    delete adventureWarningTimers[adventureId];
                }
                return;
            }
            await sendActionToChannel(channelLogin, message);
        }, delay);
        timer.unref();
        adventureWarningTimers[adventureId].push(timer);
    }
}
