export * from "./adventureLeaderboard";
export * from "./duelLeaderboard";
export * from "./fishLeaderboard";
export * from "./silverLeaderboard";
export type LeaderboardType = "Adventure" | "Duel" | "Fish" | "Silver";

export interface LeaderboardResult {
    formattedLeaderboard: string[];
    metricDisplay: string;
    leaderboardType: LeaderboardType;
}
