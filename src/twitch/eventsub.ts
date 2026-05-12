import { EventSubHttpListener, ReverseProxyAdapter } from "@twurple/eventsub-http";
import { apiClient } from "./api";
import env from "@/env";
import logger from "@/logger";
import { LogLevel } from "@twurple/chat";
import { assertNever } from "@/utils/misc";

export const listener = new EventSubHttpListener({
    apiClient,
    logger: {
        minLevel: env.LOG_LEVEL,
        custom: {
            log: (level, msg) => {
                switch (level) {
                    case LogLevel.INFO:
                        logger.info(msg);
                        break;
                    case LogLevel.DEBUG:
                        logger.debug(msg);
                        break;
                    case LogLevel.WARNING:
                        logger.warn(msg);
                        break;
                    case LogLevel.CRITICAL:
                        logger.fatal(msg);
                        break;
                    case LogLevel.ERROR:
                        logger.error(msg);
                        break;
                    case LogLevel.TRACE:
                        logger.trace(msg);
                        break;
                    default:
                        assertNever(level);
                }
            },
        },
    }, // Set the log level to debug
    adapter: new ReverseProxyAdapter({
        hostName: env.TWTICH_EVENTSUB_PROXY_HOST, // The host name the server is available from
        port: env.TWTICH_EVENTSUB_PROXY_PORT, // The port to listen on, defaults to 8080
        // pathPrefix: "/eventsub/eventsub", // The path prefix to use for the webhook endpoint
        // usePathPrefixInHandlers: true, // Whether to use the path prefix in the handlers
    }),
    secret: env.TWTICH_EVENTSUB_SECRET,
});
//check if is testing environment before starting listener
if (process.env.NODE_ENV !== "test") {
    listener.start();
}
