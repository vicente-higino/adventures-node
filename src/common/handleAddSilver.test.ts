import { beforeEach, describe, expect, it, vi } from "vitest";
import { increaseBalance, findOrCreateBalance } from "@/db";
import { handleAddSilver } from "./handleAddSilver";

vi.mock("@/bot", () => ({ getBotPrefix: () => "!" }));
vi.mock("@/db", () => ({
    findOrCreateBalance: vi.fn(),
    increaseBalance: vi.fn(),
}));
vi.mock("@/prisma", () => ({ prisma: {} }));

describe("handleAddSilver", () => {
    beforeEach(() => {
        vi.clearAllMocks();
        vi.mocked(findOrCreateBalance).mockResolvedValue({ id: 1 } as Awaited<ReturnType<typeof findOrCreateBalance>>);
        vi.mocked(increaseBalance).mockResolvedValue({ value: 50_000 } as Awaited<ReturnType<typeof increaseBalance>>);
    });

    it("subtracts a negative suffixed amount", async () => {
        const result = await handleAddSilver({
            channelLogin: "channel",
            channelProviderId: "channel-id",
            userProviderId: "user-id",
            userLogin: "user",
            userDisplayName: "User",
            add: "-50k",
        });

        expect(increaseBalance).toHaveBeenCalledWith(expect.anything(), 1, -50_000);
        expect(result).toBe("Updated @User silver to 50000.");
    });
});
