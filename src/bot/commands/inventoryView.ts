export type InventoryView = { mode: "tickets" } | { mode: "loot"; page: number } | { mode: "invalid" };

export function parseInventoryView(params: readonly string[]): InventoryView {
    if (params.length === 0) return { mode: "tickets" };
    if (params[0].toLowerCase() !== "loot" || params.length > 2) return { mode: "invalid" };
    if (params.length === 1) return { mode: "loot", page: 1 };

    const page = Number(params[1]);
    return Number.isSafeInteger(page) && page >= 1 ? { mode: "loot", page } : { mode: "invalid" };
}
