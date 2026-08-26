import { describe, expect, it } from "vitest";
import { formatAdventureChatResult, joinAdventureChatMessages, type AdventureChatPlayerResult } from "./adventureMessages";

function player(index: number, overrides: Partial<AdventureChatPlayerResult> = {}): AdventureChatPlayerResult {
    return {
        displayName: `Player${index}`,
        roll: 12,
        modifier: 1,
        total: 13,
        chancePercent: 55,
        success: true,
        criticalCode: null,
        narrative: `Player${index} crossed the dangerous passage.`,
        profit: 30,
        streakBonus: 0,
        streak: 1,
        ...overrides,
    };
}

describe("RPG adventure chat rendering", () => {
    it("uses legacy-style prose and user reward formatting without repeating checks", () => {
        const messages = formatAdventureChatResult({
            title: "The Black Reef",
            intro: "A storm closes in.",
            payoutRate: 1.4,
            presentationMode: "individual",
            players: [
                player(1, {
                    roll: 20,
                    total: 21,
                    criticalCode: "critical-success",
                    lootName: "Tideworn Compass",
                    lootEquipped: true,
                }),
                player(2, {
                    roll: 1,
                    modifier: -1,
                    total: 0,
                    chancePercent: 45,
                    success: false,
                    criticalCode: "critical-failure",
                    profit: 0,
                    streakBonus: 25,
                    streak: 3,
                    statusName: "Cursed",
                }),
            ],
        });
        const rendered = messages[0];

        expect(messages).toHaveLength(1);
        expect(rendered).toContain("The Black Reef. A storm closes in.");
        expect(rendered).toContain("Player1 crossed the dangerous passage. Player2 crossed the dangerous passage.");
        expect(rendered).not.toContain("20+1=21");
        expect(rendered).not.toContain("(55%)");
        expect(rendered).toContain("The adventure ended with a 1.40x payout rate!");
        expect(rendered).toContain(
            "Survivors are: @Player1 (+30 silver, critical success, found and equipped Tideworn Compass).",
        );
        expect(rendered).toContain("@Player2 (+25 silver bonus, 3-lose streak, critical failure, now Cursed).");
        expect(rendered.match(/@Player1/g)).toHaveLength(1);
        expect(rendered.match(/@Player2/g)).toHaveLength(1);
        expect(rendered.match(/critical success/g)).toHaveLength(1);
        expect(rendered.match(/critical failure/g)).toHaveLength(1);
        expect(rendered).not.toContain("Adventure progress");
        expect(rendered).not.toContain("XP");
        expect(rendered).not.toMatch(/[⚔🎲🏆✅❌✨⚠💰🛟⭐|]/u);
        expect(rendered).not.toMatch(/—|--/u);
        expect(messages.every(message => message.length <= 1440)).toBe(true);
        expect(joinAdventureChatMessages(messages)).toBe(rendered);
        expect(joinAdventureChatMessages(messages)).not.toContain("$(newline)");
        expect(joinAdventureChatMessages(["First sentence.", "Second sentence."])).toBe("First sentence. Second sentence.");
    });

    it("shows converted unusable loot beside the player's existing reward info", () => {
        const messages = formatAdventureChatResult({
            title: "The Black Reef",
            intro: "A storm closes in.",
            payoutRate: 1.4,
            presentationMode: "individual",
            players: [player(1, { roll: 20, criticalCode: "critical-success", lootSilverBonus: 50 })],
        });

        expect(messages[0]).toContain("@Player1 (+30 silver, +50 silver loot bonus, critical success)");
        expect(messages[0]).not.toContain("found loot");
    });

    it("combines a player's payout, critical, loot, and status without repeating their name", () => {
        const messages = formatAdventureChatResult({
            title: "Primeval Crossing",
            intro: "The party enters the forest.",
            payoutRate: 1.4,
            presentationMode: "individual",
            players: [
                player(1, {
                    displayName: "v_cn_t",
                    profit: 1,
                    streakBonus: 1,
                    streak: 7,
                    roll: 20,
                    criticalCode: "critical-success",
                    lootName: "Fire Starter",
                    lootEquipped: true,
                    statusName: "Inspired",
                }),
            ],
        });

        expect(messages[0]).toContain(
            "@v_cn_t (+1 silver, +1 silver bonus, 7-win streak, critical success, found and equipped Fire Starter, now Inspired).",
        );
        expect(messages[0].match(/@v_cn_t/g)).toHaveLength(1);
    });

    it("orders payouts from highest to lowest total silver reward", () => {
        const messages = formatAdventureChatResult({
            title: "Treasure Run",
            intro: "The party returns.",
            payoutRate: 1.4,
            presentationMode: "individual",
            players: [
                player(1, { displayName: "Lowest", profit: 100 }),
                player(2, { displayName: "Highest", profit: 80, streakBonus: 30, streak: 4 }),
                player(3, { displayName: "Middle", profit: 105 }),
                player(4, { displayName: "RecoveryLow", success: false, profit: 0, streakBonus: 10, streak: 3 }),
                player(5, { displayName: "RecoveryHigh", success: false, profit: 0, streakBonus: 30, streak: 4 }),
            ],
        });
        const rewards = messages[0].slice(messages[0].indexOf("Survivors are:"));

        expect(rewards.indexOf("@Highest")).toBeLessThan(rewards.indexOf("@Middle"));
        expect(rewards.indexOf("@Middle")).toBeLessThan(rewards.indexOf("@Lowest"));
        expect(rewards.indexOf("@RecoveryHigh")).toBeLessThan(rewards.indexOf("@RecoveryLow"));
    });

    it("switches large parties to a bounded grouped summary", () => {
        const messages = formatAdventureChatResult({
            title: "Raid Night",
            intro: "The gate opens.",
            payoutRate: 1.5,
            presentationMode: "grouped",
            epilogue: "The survivors return before dawn.",
            players: Array.from({ length: 40 }, (_, index) => player(index + 1, { success: index % 2 === 0 })),
        });

        expect(messages).toHaveLength(1);
        expect(messages[0]).not.toContain("20/40 survived");
        expect(messages[0]).not.toContain("(55%)");
        expect(messages[0]).toContain("The adventure ended with a 1.50x payout rate!");
        expect(messages[0]).toContain("Survivors are:");
        expect(messages[0]).toContain("@Player39 (+30 silver)");
        expect(messages[0]).not.toContain("Adventure progress");
        expect(messages[0]).not.toContain("XP");
        expect(messages[0]).not.toContain("$(newline)");
        expect(messages[0].length).toBeGreaterThan(450);
        expect(messages.every(message => message.length <= 1440)).toBe(true);
    });

    it("places a critical failure beside the player's status when there is no recovery entry", () => {
        const messages = formatAdventureChatResult({
            title: "The Ancient Portal",
            intro: "The portal opens.",
            payoutRate: 1.36,
            presentationMode: "individual",
            players: [
                player(1, {
                    displayName: "v_cn_t",
                    roll: 1,
                    total: 1,
                    success: false,
                    criticalCode: "critical-failure",
                    profit: 0,
                    statusName: "Rattled",
                }),
            ],
        });

        expect(messages[0]).toContain("@v_cn_t (critical failure, now Rattled).");
        expect(messages[0].match(/critical failure/g)).toHaveLength(1);
    });

    it("keeps granted loot and statuses visible for large, long-named parties", () => {
        const players = Array.from({ length: 30 }, (_, index) =>
            player(index + 1, {
                displayName: `VeryLongDisplayName${index + 1}`,
                success: index % 2 === 0,
                streakBonus: index % 2 === 0 ? 0 : 25,
                lootName: index < 5 ? `Relic With A Deliberately Long Name ${index + 1}` : undefined,
                statusName: index >= 5 && index < 10 ? `Lingering Condition With A Long Name ${index + 1}` : undefined,
            }),
        );
        const messages = formatAdventureChatResult({
            title: "Crowded Raid",
            intro: "Every hero reaches the final chamber.",
            payoutRate: 1.3,
            presentationMode: "grouped",
            players,
        });

        expect(messages).toHaveLength(1);
        expect(messages[0]).toContain("Survivors are:");
        expect(messages[0]).toContain("Relic With A Deliberately Long Name 1");
        expect(messages[0]).toContain("Lingering Condition With A Long Name 6");
        expect(messages[0]).not.toContain("Adventure progress");
        expect(messages[0]).not.toContain("XP");
        expect(messages[0]).not.toContain("$(newline)");
        expect(messages[0]).not.toMatch(/[⚔🎲🏆✅❌✨⚠💰🛟⭐|]/u);
        expect(messages[0]).not.toMatch(/—|--/u);
        expect(messages[0].length).toBeGreaterThan(450);
        expect(messages.every(message => message.length <= 1440)).toBe(true);
    });

    it("uses the Fossabot limit instead of the former 450-byte budget", () => {
        const displayName = "N".repeat(10);
        const longRewardName = "R".repeat(35);
        const messages = formatAdventureChatResult({
            title: "The Last Gate",
            intro: "The party enters.",
            payoutRate: 1.4,
            presentationMode: "individual",
            players: [
                player(1, { displayName, profit: 30, streakBonus: 10, lootName: longRewardName, statusName: longRewardName }),
                player(2, { displayName: `${displayName}a`, success: false, profit: 0, streakBonus: 25, statusName: longRewardName }),
                player(3, { displayName: `${displayName}b`, success: false, profit: 0, streakBonus: 25 }),
                player(4, { displayName: `${displayName}c`, success: false, profit: 0, streakBonus: 25 }),
            ],
        });

        expect(messages).toHaveLength(1);
        expect(messages[0]).toContain("The Last Gate");
        expect(messages[0]).toContain("The adventure ended with a 1.40x payout rate!");
        expect(messages[0]).not.toContain("$(newline)");
        expect(messages[0]).not.toContain("XP");
        expect(messages[0].length).toBeGreaterThan(450);
        expect(messages[0].length).toBeLessThanOrEqual(1440);
    });
});
