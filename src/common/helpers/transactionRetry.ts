import { Prisma } from "@prisma/client";

interface TransactionRetryOptions {
    maxAttempts?: number;
    retryUniqueConflicts?: boolean;
}

function prismaErrorCode(error: unknown): string | undefined {
    if (error instanceof Prisma.PrismaClientKnownRequestError) return error.code;
    if (error && typeof error === "object" && "code" in error && typeof error.code === "string") return error.code;
    return undefined;
}

/** Retries the whole serializable unit, never a partially committed operation. */
export async function withTransactionRetry<T>(operation: () => Promise<T>, options: TransactionRetryOptions = {}): Promise<T> {
    const maxAttempts = options.maxAttempts ?? 3;
    if (!Number.isSafeInteger(maxAttempts) || maxAttempts < 1) throw new RangeError("maxAttempts must be a positive integer");

    for (let attempt = 1; ; attempt += 1) {
        try {
            return await operation();
        } catch (error) {
            const code = prismaErrorCode(error);
            const retryable = code === "P2034" || (options.retryUniqueConflicts === true && code === "P2002");
            if (!retryable || attempt >= maxAttempts) throw error;
        }
    }
}
