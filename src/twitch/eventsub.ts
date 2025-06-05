import { EventSubHttpListener, ReverseProxyAdapter } from "@twurple/eventsub-http";
import { apiClient } from "./api";
import env from "@/env";

export const listener = new EventSubHttpListener({
    apiClient,
    logger: { minLevel: "debug" }, // Set the log level to debug
    adapter: new ReverseProxyAdapter({
        hostName: env.TWTICH_EVENTSUB_PROXY_HOST, // The host name the server is available from
        port: env.TWTICH_EVENTSUB_PROXY_PORT, // The port to listen on, defaults to 8080
        // pathPrefix: "/eventsub/eventsub", // The path prefix to use for the webhook endpoint
        // usePathPrefixInHandlers: true, // Whether to use the path prefix in the handlers
    }),
    secret: env.TWTICH_EVENTSUB_SECRET,
});
listener.start();
