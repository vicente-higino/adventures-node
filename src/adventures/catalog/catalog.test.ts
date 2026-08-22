import { describe, expect, it } from "vitest";
import { atlantisAdventures } from "../atlantis";
import { customAdventures } from "../custom";
import { cyberpunkAdventures } from "../cyberpunk";
import { dinoAdventures } from "../dino";
import { egyptAdventures } from "../egypt";
import { fantasyAdventures } from "../fantasy";
import { heroAdventures } from "../hero";
import { horrorAdventures } from "../horror";
import { mythologicalAdventures } from "../mythological";
import { pirateAdventures } from "../pirate";
import { postApocAdventures } from "../postApoc";
import { sciFiAdventures } from "../sciFi";
import { spyAdventures } from "../spy";
import { steampunkAdventures } from "../steampunk";
import { westAdventures } from "../west";
import {
    ADVENTURE_CHECKS,
    LEGACY_REGULAR_ENCOUNTER_WEIGHT,
    LEGACY_REGULAR_THEME_WEIGHTS,
    adventureCatalog,
    raidAdventureCatalog,
    regularAdventureCatalog,
    regularAdventureCatalogByTheme,
    selectAdventureAtStart,
    selectRaidAdventure,
    selectRegularAdventure,
} from ".";

function sequenceRandom(...values: number[]): () => number {
    let index = 0;
    return () => {
        const value = values[index];
        index += 1;
        if (value === undefined) throw new Error("Test random sequence was exhausted.");
        return value;
    };
}

const legacyRegularAdventures = [
    ...fantasyAdventures,
    ...sciFiAdventures,
    ...cyberpunkAdventures,
    ...mythologicalAdventures,
    ...postApocAdventures,
    ...pirateAdventures,
    ...steampunkAdventures,
    ...heroAdventures,
    ...horrorAdventures,
    ...westAdventures,
    ...spyAdventures,
    ...egyptAdventures,
    ...atlantisAdventures,
    ...dinoAdventures,
];

describe("adventure catalog", () => {
    it("adapts all 50 regular and 10 raid definitions without mixing the catalogs", () => {
        expect(regularAdventureCatalog).toHaveLength(50);
        expect(raidAdventureCatalog).toHaveLength(10);
        expect(adventureCatalog).toHaveLength(60);
        expect(regularAdventureCatalog.every(entry => entry.kind === "regular" && entry.themeId !== "special")).toBe(true);
        expect(raidAdventureCatalog.every(entry => entry.kind === "raid" && entry.themeId === "special")).toBe(true);
    });

    it("assigns unique, versioned IDs and non-empty titles", () => {
        const ids = adventureCatalog.map(entry => entry.id);
        expect(new Set(ids).size).toBe(adventureCatalog.length);

        for (const entry of adventureCatalog) {
            expect(entry.id).toMatch(/^[a-z]+(?:-[a-z]+)*(?:\.[a-z0-9]+(?:-[a-z0-9]+)*)+\.v1$/);
            expect(entry.title.trim()).not.toBe("");
            expect(entry.contentVersion).toBe(1);
        }
    });

    it("gives every encounter exactly three valid choices from all 12 checks", () => {
        const allowedChecks = new Set<string>(ADVENTURE_CHECKS);
        const usedChecks = new Set<string>();

        for (const entry of adventureCatalog) {
            expect(entry.approaches).toHaveLength(3);
            expect(new Set(entry.approaches.map(approach => approach.id)).size).toBe(3);
            expect(new Set(entry.approaches.map(approach => approach.check)).size).toBe(3);

            for (const approach of entry.approaches) {
                expect(approach.id).toMatch(/^[a-z]+(?:-[a-z]+)*$/);
                expect(approach.label.trim()).not.toBe("");
                expect(allowedChecks.has(approach.check)).toBe(true);
                usedChecks.add(approach.check);
            }
        }

        expect(usedChecks).toEqual(allowedChecks);
    });

    it("keeps the original prose functions and objects intact", () => {
        expect(regularAdventureCatalog.map(entry => entry.legacyAdventure)).toEqual(legacyRegularAdventures);
        expect(raidAdventureCatalog.map(entry => entry.legacyAdventure)).toEqual(customAdventures);

        for (const entry of adventureCatalog) {
            expect(entry.description).toBe(entry.legacyAdventure.description);
            expect(entry.winMessages).toBe(entry.legacyAdventure.winMessages);
            expect(entry.loseMessages).toBe(entry.legacyAdventure.loseMessages);
        }
    });

    it("marks every custom encounter as grouped and supplies non-empty group endings", () => {
        for (const entry of raidAdventureCatalog) {
            expect(entry.presentationMode).toBe("grouped");
            expect(entry.endWin?.("Alice").trim()).not.toBe("");
            expect(entry.endLose?.("Bob").trim()).not.toBe("");
        }
    });

    it("makes the explicit legacy weights match the regular definition counts", () => {
        expect(LEGACY_REGULAR_ENCOUNTER_WEIGHT).toBe(50);
        expect(LEGACY_REGULAR_THEME_WEIGHTS).toHaveLength(14);

        for (const { themeId, weight } of LEGACY_REGULAR_THEME_WEIGHTS) {
            expect(regularAdventureCatalogByTheme[themeId]).toHaveLength(weight);
        }
    });
});

describe("adventure catalog selection", () => {
    it("selects regular boundary slots without ever returning a raid", () => {
        const first = selectRegularAdventure(sequenceRandom(0, 0));
        const atlantis = selectRegularAdventure(sequenceRandom(0.8, 0));
        const last = selectRegularAdventure(sequenceRandom(0.999999, 0.999999));

        expect(first.id).toBe("fantasy.forgotten-lore.v1");
        expect(atlantis.themeId).toBe("atlantis");
        expect(last.id).toBe("dinosaur.nightfall.v1");
        expect([first, atlantis, last].every(entry => entry.kind === "regular")).toBe(true);
    });

    it("selects raids independently", () => {
        expect(selectRaidAdventure(() => 0).id).toBe("special.bear-trap-forest.v1");
        expect(selectRaidAdventure(() => 0.999999).id).toBe("special.goblin-market.v1");
    });

    it("uses the legacy 12-player raid threshold when choosing a scenario at start", () => {
        const regular = selectAdventureAtStart({ partySize: 11, random: sequenceRandom(0, 0) });
        const raid = selectAdventureAtStart({ partySize: 12, random: () => 0 });

        expect(regular.kind).toBe("regular");
        expect(raid.kind).toBe("raid");
    });

    it("rejects invalid random sources instead of selecting an out-of-range entry", () => {
        expect(() => selectRegularAdventure(() => 1)).toThrow(RangeError);
        expect(() => selectRaidAdventure(() => -0.1)).toThrow(RangeError);
    });
});
