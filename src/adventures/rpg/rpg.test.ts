import { describe, expect, it } from "vitest";
import {
    ADVENTURE_CATALOG,
    ADVENTURE_CHECKS,
    ADVENTURE_CLASSES,
    ADVENTURE_ITEMS,
    ADVENTURE_THEMES,
    calculateModifierBreakdown,
    clampModifier,
    createAdventureInstance,
    createPlayerRandom,
    formatAdventureClassNames,
    formatAdventureCheckModifiers,
    parseAdventureClass,
    payoutAwareChanceCap,
    renderAdventureDescription,
    renderAdventureOutcome,
    renderAdventureTemplate,
    resolveAdventureCheck,
    rollPlayerD20,
    selectThemeLoot,
    successChance,
    successChanceForModifier,
    validateAdventureCatalog,
    validateAdventureItems,
    validateAdventureTemplate,
} from ".";

describe("RPG checks and classes", () => {
    it("defines 12 unique checks", () => {
        expect(ADVENTURE_CHECKS).toHaveLength(12);
        expect(new Set(ADVENTURE_CHECKS)).toHaveLength(12);
    });

    it("defines 18 unique classes with two different proficiencies", () => {
        expect(ADVENTURE_CLASSES).toHaveLength(18);
        expect(new Set(ADVENTURE_CLASSES.map(definition => definition.code))).toHaveLength(18);
        for (const definition of ADVENTURE_CLASSES) {
            expect(definition.proficiencies).toHaveLength(2);
            expect(new Set(definition.proficiencies)).toHaveLength(2);
        }
    });

    it("parses class input without depending on casing or separators", () => {
        expect(parseAdventureClass("  GUN_Slinger ")?.code).toBe("gunslinger");
        expect(parseAdventureClass("Wizard")?.proficiencies).toEqual(["arcana", "knowledge"]);
        expect(parseAdventureClass("not-a-class")).toBeUndefined();
    });

    it("formats check modifiers consistently for character profiles", () => {
        expect(formatAdventureCheckModifiers(["might", "endurance"], 1)).toBe("Might +1, Endurance +1");
        expect(formatAdventureCheckModifiers(["arcana", "knowledge"], -1)).toBe("Arcana -1, Knowledge -1");
    });

    it("formats class help as names only", () => {
        const names = formatAdventureClassNames();
        expect(names.split(", ")).toHaveLength(18);
        expect(names).toContain("Warrior");
        expect(names).toContain("Diplomat");
        expect(names).not.toMatch(/[\[\]/+]/);
    });
});

describe("RPG probability rules", () => {
    it("clamps modifiers and maps them to exact 30-70 percent odds", () => {
        expect(clampModifier(-99)).toBe(-4);
        expect(clampModifier(99)).toBe(4);
        expect([-4, -3, -2, -1, 0, 1, 2, 3, 4].map(successChanceForModifier)).toEqual([30, 35, 40, 45, 50, 55, 60, 65, 70]);
    });

    it("applies the payout-aware ceiling", () => {
        expect(payoutAwareChanceCap(1.3)).toBe(70);
        expect(payoutAwareChanceCap(1.5)).toBe(65);
        expect(payoutAwareChanceCap(1.6)).toBe(60);
        expect(payoutAwareChanceCap(1.8)).toBe(55);
        expect(payoutAwareChanceCap(1.9)).toBe(55);
        expect(payoutAwareChanceCap(2)).toBe(55);
        expect(successChance(4, 2)).toBe(55);
        expect(successChance(1, 2)).toBe(55);
        expect(successChance(0, 2)).toBe(50);
        expect(successChance(-2, 2)).toBe(40);
    });

    it("returns a transparent clamped and payout-capped breakdown", () => {
        const breakdown = calculateModifierBreakdown(
            [
                { code: "class.ranger", label: "Ranger", source: "class", modifier: 1 },
                { code: "item.compass", label: "Compass", source: "item", modifier: 1 },
                { code: "status.inspired", label: "Inspired", source: "status", modifier: 1 },
                { code: "party.diverse", label: "Diverse party", source: "party", modifier: 2 },
            ],
            1.5,
        );

        expect(breakdown.rawTotal).toBe(5);
        expect(breakdown.clampedTotal).toBe(4);
        expect(breakdown.effectiveModifier).toBe(3);
        expect(breakdown.chancePercent).toBe(65);
        expect(breakdown.modifierWasClamped).toBe(true);
        expect(breakdown.payoutWasCapped).toBe(true);
        expect(breakdown.entries.reduce((total, entry) => total + entry.appliedModifier, 0)).toBe(3);
    });
});

describe("seeded resolution and loot", () => {
    it("produces stable per-adventure, per-player random streams", () => {
        expect(rollPlayerD20("adventure-42", "player-7")).toBe(rollPlayerD20("adventure-42", "player-7"));

        const first = createPlayerRandom("adventure-42", "player-7", "test");
        const second = createPlayerRandom("adventure-42", "player-7", "test");
        expect([first(), first(), first()]).toEqual([second(), second(), second()]);
    });

    it("resolves the same player identically regardless of surrounding player order", () => {
        const input = {
            adventureSeed: "reef-seed",
            playerId: "user-123",
            check: "survival" as const,
            payoutRate: 1.4,
            modifiers: [{ code: "class.ranger", label: "Ranger", source: "class" as const, modifier: 1 }],
        };
        expect(resolveAdventureCheck(input)).toEqual(resolveAdventureCheck(input));
        expect(resolveAdventureCheck(input).roll).toBeGreaterThanOrEqual(1);
        expect(resolveAdventureCheck(input).roll).toBeLessThanOrEqual(20);
    });

    it("selects deterministic theme loot", () => {
        expect(selectThemeLoot("pirate", "reef-seed", "user-123")).toEqual(selectThemeLoot("pirate", "reef-seed", "user-123"));
        expect(selectThemeLoot("pirate", "reef-seed", "user-123").theme).toBe("pirate");
    });
});

describe("RPG catalogs and templates", () => {
    it("covers every theme with bounded checks, a status, an encounter, and three items", () => {
        expect(ADVENTURE_THEMES).toHaveLength(14);
        expect(new Set(ADVENTURE_THEMES.map(theme => theme.code))).toHaveLength(14);
        expect(new Set(ADVENTURE_THEMES.map(theme => theme.criticalFailureStatus.code))).toHaveLength(14);

        for (const theme of ADVENTURE_THEMES) {
            expect(theme.relevantChecks.length).toBeGreaterThanOrEqual(3);
            expect(theme.relevantChecks.length).toBeLessThanOrEqual(5);
            expect(theme.criticalFailureStatus.modifier).toBe(-1);
            expect(ADVENTURE_CATALOG.some(adventure => adventure.theme === theme.code)).toBe(true);
            expect(ADVENTURE_ITEMS.filter(item => item.theme === theme.code).length).toBeGreaterThanOrEqual(3);
        }
    });

    it("has unique stable IDs and passes cross-catalog validation", () => {
        expect(new Set(ADVENTURE_CATALOG.map(adventure => adventure.id))).toHaveLength(ADVENTURE_CATALOG.length);
        expect(new Set(ADVENTURE_ITEMS.map(item => item.id))).toHaveLength(ADVENTURE_ITEMS.length);
        expect(validateAdventureCatalog()).toEqual([]);
        expect(validateAdventureItems()).toEqual([]);
    });

    it("creates deterministic persisted context and renders it without placeholders", () => {
        const input = {
            id: "instance-1",
            definitionId: "pirate.cursed-reef.v1",
            seed: "fixed-seed",
            payoutRate: 1.5,
            startedAt: "2026-08-22T00:00:00.000Z",
        };
        const first = createAdventureInstance(input);
        const second = createAdventureInstance(input);
        expect(first).toEqual(second);
        expect(renderAdventureDescription(first)).not.toMatch(/[{}]/);
        expect(renderAdventureOutcome(first, "navigate", "@Vicente", true)).toContain("@Vicente");
    });

    it("validates placeholders and rejects missing render values", () => {
        expect(validateAdventureTemplate("At {location}, {player} wins.")).toEqual([]);
        expect(validateAdventureTemplate("At {unknown}, someone wins.")).toContain("Unknown placeholders: unknown");
        expect(() => renderAdventureTemplate("{player} found {item}.", { player: "Ana" })).toThrow("Missing template value: item");
    });
});
