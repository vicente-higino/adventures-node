import { Bool, jsonResp, Num, OpenAPIRoute, Str } from "chanfana";
import { z } from "zod";
import { Env } from "../types";
import { PrismaD1 } from "@prisma/adapter-d1";
import { PrismaClient } from "@prisma/client";
import { Context } from "hono";

export class PointList extends OpenAPIRoute {
    schema = { request: {}, responses: {} };

    async handle(c: Context<Env>) {
        // Get validated data
        const data = await this.getValidatedData<typeof this.schema>();
        const adapter = new PrismaD1(c.env.DB);
        const prisma = new PrismaClient({ adapter });

        const balance = await prisma.balance.findMany({ include: { user: { select: { displayName: true } } } });

        return jsonResp(balance);
    }
}
