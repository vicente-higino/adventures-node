import { describe, expect, it } from "vitest";
import { parseInventoryView } from "./inventoryView";

describe("inventory view parsing", () => {
    it("uses the ticket view by default", () => {
        expect(parseInventoryView([])).toEqual({ mode: "tickets" });
    });

    it("shows adventure loot only through the loot view", () => {
        expect(parseInventoryView(["loot"])).toEqual({ mode: "loot", page: 1 });
        expect(parseInventoryView(["LOOT", "3"])).toEqual({ mode: "loot", page: 3 });
    });

    it("rejects the old page-only syntax and invalid loot pages", () => {
        expect(parseInventoryView(["2"])).toEqual({ mode: "invalid" });
        expect(parseInventoryView(["loot", "0"])).toEqual({ mode: "invalid" });
        expect(parseInventoryView(["loot", "next"])).toEqual({ mode: "invalid" });
    });
});
