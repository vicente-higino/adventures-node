import { decreaseBalance, findOrCreateBalance, increaseBalance, increaseBalanceWithChannelID, updateUserRpsStats } from "@/db";
import boss from "@/db/boss";
import logger from "@/logger";
import { prisma } from "@/prisma";
import { getUserById } from "@/twitch/api";
import { RpsMove } from "@prisma/client";

type SubmitMoveResult =
    | { status: "error"; error: string }
    | { status: "canceled"; msg: string; channel: string }
    | { status: "pending" }
    | {
          status: "resolved";
          channelId: string;
          channel: string;
          round: number;
          moveA: RpsMove;
          moveB: RpsMove;
          playerA: string;
          playerB: string;
          scoreA: number;
          scoreB: number;
          matchEnd: boolean;
          winner: string | null;
          wager: number;
          winStreak: number;
      };

function resolveMove(a: RpsMove, b: RpsMove) {
    if (a === b) return "DRAW";
    if ((a === "ROCK" && b === "SCISSORS") || (a === "SCISSORS" && b === "PAPER") || (a === "PAPER" && b === "ROCK")) return "PLAYER_A";
    return "PLAYER_B";
}

type CancelRPSMatchResult = { status: "success"; msg: string } | { status: "error"; error: string };

export async function cancelRPS_Job(matchId: bigint) {
    const job = await boss.findJobs("rps-cancel", { data: { matchId: matchId.toString() }, queued: true });
    if (job.length > 0) {
        logger.debug({ jobId: job[0].id }, "Canceling scheduled RPS timeout job");
        await boss.cancel("rps-cancel", job[0].id);
    }
}

export async function cancelRPSMatch(matchId: bigint): Promise<CancelRPSMatchResult> {
    logger.debug({ matchId }, "cancelRPSMatch called");

    const match = await prisma.match.findUnique({
        where: { id: matchId },
        include: { rounds: { where: { roundNum: 1 }, include: { moves: true } } },
    });

    if (!match) {
        logger.warn({ matchId }, "Match not found for cancellation");
        return { status: "error", error: `Match ${matchId} not found` };
    }

    if (match.status === "CANCELLED" || match.status === "COMPLETE") {
        logger.warn({ matchId, status: match.status }, "Cannot cancel match with invalid status");
        return { status: "error", error: `Cannot cancel match with status: ${match.status}` };
    }

    logger.debug({ matchId, playerA: match.playerA, playerB: match.playerB, wager: match.wager }, "Match found, fetching users");

    // Fetch user information for both players and channel
    const [userA, userB, channel] = await Promise.all([
        getUserById(prisma, match.playerA),
        getUserById(prisma, match.playerB),
        getUserById(prisma, match.channel),
    ]);

    if (!userA || !userB || !channel) {
        logger.error({ matchId, userA: !!userA, userB: !!userB, channel: !!channel }, "Failed to fetch users for cancellation");
        return { status: "error", error: "Failed to fetch user information for match cancellation" };
    }

    // Check if playerB submitted in round 1 (their balance was deducted at that point)
    const firstRound = match.rounds[0];
    const playerBSubmittedRound1 = firstRound?.moves.some(m => m.player === match.playerB) ?? false;
    logger.debug({ matchId, playerBSubmittedRound1 }, "PlayerB submission status checked");

    // Refund playerA's wager
    await increaseBalanceWithChannelID(prisma, channel.id, match.playerA, match.wager);
    logger.debug({ matchId, playerA: userA.login, amount: match.wager }, "PlayerA wager refunded");

    // Refund playerB's wager if they submitted in round 1
    if (playerBSubmittedRound1) {
        await increaseBalanceWithChannelID(prisma, channel.id, match.playerB, match.wager);
        logger.debug({ matchId, playerB: userB.login, amount: match.wager }, "PlayerB wager refunded");
    }

    // Cancel the match
    await prisma.match.update({ where: { id: matchId }, data: { status: "CANCELLED" } });
    cancelRPS_Job(matchId);
    logger.info({ matchId }, "Match cancelled successfully");
    return { status: "success", msg: "Match cancelled and wagers refunded" };
}

export async function createMatch(channelId: string, playerA_id: string, playerB_id: string, wager: number) {
    logger.debug({ channelId, playerA_id, playerB_id, wager }, "createMatch called");

    if (wager < 0 || playerA_id === playerB_id) {
        logger.warn({ channelId, playerA_id, playerB_id, wager }, "Invalid match parameters - negative wager or same player");
        return null;
    }

    const match = await prisma.match.create({
        data: { channel: channelId, playerA: playerA_id, playerB: playerB_id, wager, rounds: { create: { roundNum: 1 } } },
    });

    logger.info({ matchId: match.id, channelId, playerA_id, playerB_id, wager }, "Match created successfully");
    return match;
}

export async function submitMove(userId: string, move: RpsMove): Promise<SubmitMoveResult> {
    logger.debug({ userId, move }, "submitMove called");

    const match = await prisma.match.findFirst({
        where: { status: "ACTIVE", OR: [{ playerA: userId }, { playerB: userId }] },
        include: { rounds: { orderBy: { roundNum: "desc" }, take: 1, include: { moves: true } } },
    });

    if (!match) {
        logger.debug({ userId }, "No active match found");
        return { status: "error", error: "No active match" };
    }

    logger.debug({ matchId: match.id, userId }, "Active match found");

    const [userA, userB, channel] = await Promise.all([
        getUserById(prisma, match.playerA),
        getUserById(prisma, match.playerB),
        getUserById(prisma, match.channel),
    ]);
    if (!userA || !userB || !channel) {
        logger.error({ matchId: match.id, userA: !!userA, userB: !!userB, channel: !!channel }, "Failed to fetch users");
        return { status: "error", error: "Error fetching users" };
    }

    logger.debug({ playerA: userA.login, playerB: userB.login, channel: channel.login }, "Users fetched successfully");
    const round = match.rounds[0];

    try {
        await prisma.move.create({ data: { roundId: round.id, player: userId, move } });
        logger.debug({ roundId: round.id, userId, move }, "Move created successfully");
    } catch (e) {
        logger.warn({ roundId: round.id, userId, move, error: e }, "Move creation failed - already submitted");
        return { status: "error", error: "Move already submitted" };
    }

    if (userB.id == userId && round.roundNum === 1) {
        logger.debug({ userId, roundNum: round.roundNum }, "PlayerB on round 1, checking balance");
        const playerB_balance = await findOrCreateBalance(prisma, channel.login, channel.id, userB.id, userB.login, userB.displayName);
        logger.debug({ playerBBalance: playerB_balance.value, wager: match.wager }, "PlayerB balance retrieved");

        if (playerB_balance.value < match.wager) {
            logger.warn(
                { playerBId: userB.id, balance: playerB_balance.value, wager: match.wager, matchId: match.id },
                "PlayerB insufficient balance, canceling match",
            );
            const cancelResult = await cancelRPSMatch(match.id);
            if (cancelResult.status === "error") {
                logger.error({ matchId: match.id, error: cancelResult.error }, "Match cancellation failed");
                return { status: "error", error: `Match cancellation failed: ${cancelResult.error}` };
            }
            return {
                status: "canceled",
                msg: `@${userA.displayName}, match canceled: @${userB.displayName} don't have enough silver (${playerB_balance.value}) to play.`,
                channel: channel.login,
            };
        }
        logger.debug({ playerBId: userB.id, amount: match.wager }, "Deducting wager from playerB");
        await decreaseBalance(prisma, playerB_balance.id, match.wager);
    }

    // check if both moves are in
    const moves = await prisma.move.findMany({ where: { roundId: round.id } });
    logger.debug({ roundId: round.id, movesCount: moves.length }, "Moves for round");

    if (moves.length < 2) {
        logger.debug({ matchId: match.id, roundNum: round.roundNum }, "Waiting for second move");
        return { status: "pending" };
    }

    // resolve round
    const moveA = moves.find(m => m.player === match.playerA)?.move!;
    const moveB = moves.find(m => m.player === match.playerB)?.move!;
    const result = resolveMove(moveA, moveB);
    logger.debug({ roundNum: round.roundNum, moveA, moveB, result }, "Round resolved");

    await prisma.round.update({ where: { id: round.id }, data: { winner: result } });

    // compute score
    const rounds = await prisma.round.findMany({ where: { matchId: match.id } });

    let scoreA = 0,
        scoreB = 0;

    for (const r of rounds) {
        if (r.winner === "PLAYER_A") scoreA++;
        if (r.winner === "PLAYER_B") scoreB++;
    }
    logger.debug({ scoreA, scoreB }, "Match score computed");

    // check BO3 end
    let matchEnd = false;
    let winner = null;
    let statsWinner, statsLoser;
    if (scoreA === 2 || scoreB === 2) {
        matchEnd = true;
        winner = scoreA === 2 ? match.playerA : match.playerB;
        logger.info({ matchId: match.id, winner, scoreA, scoreB }, "Match completed");

        await increaseBalanceWithChannelID(prisma, channel.id, winner, match.wager * 2);
        logger.debug({ winnerId: winner, amount: match.wager * 2 }, "Winner balance increased");

        cancelRPS_Job(match.id);

        await prisma.match.update({ where: { id: match.id }, data: { status: "COMPLETE", winner, completedAt: new Date() } });

        // Update stats for winner
        statsWinner = await updateUserRpsStats(prisma, channel.login, channel.id, winner, {
            wagerAmount: match.wager,
            winAmount: match.wager * 2,
            didWin: true,
        });
        logger.debug({ userId: winner, didWin: true, statsA: statsWinner }, "Winner stats updated");

        // Update stats for loser
        const loser = winner === match.playerA ? match.playerB : match.playerA;
        statsLoser = await updateUserRpsStats(prisma, channel.login, channel.id, loser, { wagerAmount: match.wager, winAmount: 0, didWin: false });
        logger.debug({ userId: loser, didWin: false, statsB: statsLoser }, "Loser stats updated");
    } else {
        // next round
        logger.debug({ matchId: match.id, nextRound: round.roundNum + 1 }, "Creating next round");
        await prisma.round.create({ data: { matchId: match.id, roundNum: round.roundNum + 1 } });
    }
    const res = {
        status: "resolved",
        channelId: match.channel,
        channel: channel.login,
        round: round.roundNum,
        moveA,
        moveB,
        playerA: userA.displayName,
        playerB: userB.displayName,
        scoreA,
        scoreB,
        matchEnd,
        winner: winner ? (winner === match.playerA ? userA.displayName : userB.displayName) : null,
        wager: match.wager,
        winStreak: statsWinner?.rpsWinStreak ?? 0,
    } as const;
    logger.debug(res, "Match result prepared");
    return res;
}
