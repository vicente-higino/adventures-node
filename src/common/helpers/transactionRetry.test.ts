import { describe, expect, it, vi } from "vitest";
import { withTransactionRetry } from "./transactionRetry";

function codedError(code: string): Error & { code: string } {
    return Object.assign(new Error(code), { code });
}

describe("transaction retry", () => {
    it("retries serializable conflicts and returns the committed attempt", async () => {
        const operation = vi.fn().mockRejectedValueOnce(codedError("P2034")).mockResolvedValueOnce("committed");
        await expect(withTransactionRetry(operation)).resolves.toBe("committed");
        expect(operation).toHaveBeenCalledTimes(2);
    });

    it("only retries unique conflicts when creation opted in", async () => {
        const noRetry = vi.fn().mockRejectedValue(codedError("P2002"));
        await expect(withTransactionRetry(noRetry)).rejects.toThrow("P2002");
        expect(noRetry).toHaveBeenCalledTimes(1);

        const retry = vi.fn().mockRejectedValueOnce(codedError("P2002")).mockResolvedValueOnce("joined");
        await expect(withTransactionRetry(retry, { retryUniqueConflicts: true })).resolves.toBe("joined");
        expect(retry).toHaveBeenCalledTimes(2);
    });
});
