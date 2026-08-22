export type SeedPart = string | number | bigint;

const UINT32_RANGE = 0x1_0000_0000;

/** Stable FNV-1a hash used only for deterministic game randomness, never security. */
export function deriveSeed(...parts: readonly SeedPart[]): number {
    const value = parts.map(part => String(part)).join("\u001f");
    let hash = 0x811c9dc5;

    for (let index = 0; index < value.length; index += 1) {
        hash ^= value.charCodeAt(index);
        hash = Math.imul(hash, 0x01000193);
    }

    return hash >>> 0;
}

/** Mulberry32: compact, repeatable, and suitable for non-cryptographic game rolls. */
export function createSeededRandom(...parts: readonly SeedPart[]): () => number {
    let state = deriveSeed(...parts);

    return () => {
        state = (state + 0x6d2b79f5) >>> 0;
        let value = state;
        value = Math.imul(value ^ (value >>> 15), value | 1);
        value ^= value + Math.imul(value ^ (value >>> 7), value | 61);
        return ((value ^ (value >>> 14)) >>> 0) / UINT32_RANGE;
    };
}

export function createPlayerRandom(adventureSeed: SeedPart, playerId: SeedPart, stream: SeedPart = "default"): () => number {
    return createSeededRandom("adventure-rpg-v1", adventureSeed, playerId, stream);
}

export function randomInt(random: () => number, minimum: number, maximum: number): number {
    if (!Number.isInteger(minimum) || !Number.isInteger(maximum) || maximum < minimum) {
        throw new RangeError("randomInt requires integer bounds with maximum >= minimum");
    }

    return minimum + Math.floor(random() * (maximum - minimum + 1));
}

export function rollPlayerD20(adventureSeed: SeedPart, playerId: SeedPart): number {
    return randomInt(createPlayerRandom(adventureSeed, playerId, "d20"), 1, 20);
}

export function pickSeeded<T>(values: readonly T[], ...seedParts: readonly SeedPart[]): T {
    if (values.length === 0) throw new RangeError("Cannot pick from an empty collection");
    const index = randomInt(createSeededRandom(...seedParts), 0, values.length - 1);
    return values[index];
}

export interface WeightedValue<T> {
    readonly value: T;
    readonly weight: number;
}

export function pickWeightedSeeded<T>(values: readonly WeightedValue<T>[], ...seedParts: readonly SeedPart[]): T {
    if (values.length === 0) throw new RangeError("Cannot pick from an empty collection");
    if (values.some(entry => !Number.isFinite(entry.weight) || entry.weight <= 0))
        throw new RangeError("All weights must be finite and greater than zero");

    const totalWeight = values.reduce((total, entry) => total + entry.weight, 0);
    let cursor = createSeededRandom(...seedParts)() * totalWeight;

    for (const entry of values) {
        cursor -= entry.weight;
        if (cursor < 0) return entry.value;
    }

    return values[values.length - 1].value;
}
