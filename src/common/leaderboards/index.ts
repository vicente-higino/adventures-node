export * from "./adventureLeaderboard";
export * from "./duelLeaderboard";
export * from "./fishLeaderboard";
export * from "./silverLeaderboard";
export type LeaderboardType = "Adventure" | "Duel" | "RPS" | "Fish" | "Silver";

export type LeaderboardResult =
    | {
        error: true;
        reason: string;
    }
    | {
        error?: false;
        formattedLeaderboard: string[];
        metricDisplay: string;
        leaderboardType: LeaderboardType;
    };