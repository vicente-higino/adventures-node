import { describe, expect, it } from "vitest";
import {
    ADVENTURE_TICKET_DROP_TABLE,
    ADVENTURE_TICKET_MULTIPLIERS,
    getAdventureTicketCode,
    getAdventureTicketMultiplier,
    redeemables,
} from "./redeemables";

describe("adventure multiplier tickets", () => {
    it("defines one explicit ticket for every multiplier from 2x through 5x", () => {
        expect(ADVENTURE_TICKET_MULTIPLIERS).toEqual([2, 3, 4, 5]);
        expect(ADVENTURE_TICKET_MULTIPLIERS.map(getAdventureTicketCode)).toEqual(["adventure_2x", "adventure_3x", "adventure_4x", "adventure_5x"]);
        expect(redeemables.filter(redeemable => redeemable.type === "START_ADVENTURE_MULTIPLIER").map(redeemable => redeemable.code)).toEqual([
            "adventure_2x",
            "adventure_3x",
            "adventure_4x",
            "adventure_5x",
        ]);
    });

    it("parses only supported ticket codes", () => {
        expect(getAdventureTicketMultiplier("adventure_5x")).toBe(5);
        expect(getAdventureTicketMultiplier("adventure_1x")).toBeUndefined();
        expect(getAdventureTicketMultiplier("adventure_6x")).toBeUndefined();
    });

    it("weights higher multiplier drops as increasingly rare", () => {
        expect(ADVENTURE_TICKET_DROP_TABLE).toEqual([
            { multiplier: 2, weight: 225 },
            { multiplier: 3, weight: 20 },
            { multiplier: 4, weight: 4 },
            { multiplier: 5, weight: 1 },
        ]);
        const totalWeight = ADVENTURE_TICKET_DROP_TABLE.reduce((total, ticket) => total + ticket.weight, 0);
        expect(ADVENTURE_TICKET_DROP_TABLE.map(ticket => ticket.weight / totalWeight)).toEqual([0.9, 0.08, 0.016, 0.004]);

        const syncedConfigs = redeemables.filter(redeemable => redeemable.type === "START_ADVENTURE_MULTIPLIER").map(redeemable => redeemable.config);
        expect(syncedConfigs).toEqual([
            { multiplier: 2, dropWeight: 225 },
            { multiplier: 3, dropWeight: 20 },
            { multiplier: 4, dropWeight: 4 },
            { multiplier: 5, dropWeight: 1 },
        ]);
    });
});
