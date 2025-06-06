import { z } from "zod";

/**
 * Creates a user ID parameter that transforms "Error" strings to null
 * @param description Optional description for the parameter
 * @param required Whether the parameter is required (defaults to false)
 * @returns A string schema with transformation
 */
export function createUserIdParam(description = "User id") {
    return z.string({ description }).transform(data => {
        return data.includes("Error") ? null : data;
    });
}
