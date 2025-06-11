export * from "./adventureLeaderboard";
export * from "./duelLeaderboard";
export * from "./fishLeaderboard";
export * from "./silverLeaderboard";

export interface LeaderboardResult {
    formattedLeaderboard: string[];
    metricDisplay: string;
}
