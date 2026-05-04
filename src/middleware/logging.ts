import logger from "@/logger";
import { FossaHeaders, HonoEnv } from "@/types";
import { Context, Next } from "hono";

export const customLogger = (message: string, ...rest: string[]) => {
    logger.info(message);
    for (const item of rest) logger.info(item);
}

export const loggingMiddleware = async (c: Context<HonoEnv>, next: Next) => {
    try {
        const headers = FossaHeaders.safeParse(c.req.header());
        if (headers.success) {
            logger.debug({ ...headers.data }, "Request headers");
        }
        return next();
    } catch (error) {
        logger.error(error, "Error in logging middleware");
        return next();
    }
};
