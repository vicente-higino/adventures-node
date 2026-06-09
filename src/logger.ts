import pino from "pino";
import pretty from "pino-pretty";

const logger =
    process.env.NODE_ENV === "development"
        ? pino({ level: process.env.LOG_LEVEL || "info" }, pretty({ colorize: true, singleLine: false }))
        : pino({ level: process.env.LOG_LEVEL || "info", transport: { target: "pino-pretty", options: { colorize: true } } });

export default logger;
