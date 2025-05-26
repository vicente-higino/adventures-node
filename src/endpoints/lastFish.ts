import { OpenAPIRoute } from "chanfana";
import { z } from "zod";
import { type HonoEnv, FossaHeaders } from "@/types";
import { Prisma, Rarity } from "@prisma/client";
import type { Context } from "hono";
import dayjs from "dayjs";
import relativeTime from "dayjs/plugin/relativeTime";
import { formatSize, formatWeight } from "@/utils/misc";
import { getUserByUsername } from "@/twitch/api"; // Import getUserByUsername

dayjs.extend(relativeTime);

interface ParsedArgs {
    channel: string | null;
    user: string | null;
    searchTerms: string[];
}

export class LastFish extends OpenAPIRoute {
    schema = { request: { headers: FossaHeaders, params: z.object({ query: z.string().optional() }) }, responses: {} };

    handleValidationError(errors: z.ZodIssue[]): Response {
        console.error("Validation errors:", errors);
        const msg = "Usage: !lastestfish [@username] [rarity|fishName]";
        return new Response(msg, { status: 400 });
    }

    async handle(c: Context<HonoEnv>) {
        const data = await this.getValidatedData<typeof this.schema>();
        const prisma = c.get("prisma");
        let channelProviderId = data.headers["x-fossabot-channelproviderid"];
        let channelName = data.headers["x-fossabot-channellogin"]; // Get channel name from headers for default messages
        // Decode the query from URL-encoded form
        const rawQuery = decodeURI(data.params.query ?? `$${channelName}`).trim();
        const queryParts = rawQuery.split("+").filter(part => part.length > 0); // Split and remove empty parts

        // List of valid rarities (canonical case)
        const rarities = Object.values(Rarity); // Use enum values

        const parsedArgs: ParsedArgs = { channel: null, user: null, searchTerms: [] };

        // Parse arguments
        for (const part of queryParts) {
            if (part.startsWith("$") && part.length > 1) {
                parsedArgs.channel = part.substring(1);
            } else if (part.startsWith("@") && part.length > 1) {
                parsedArgs.user = part.substring(1);
            } else {
                parsedArgs.searchTerms.push(part);
            }
        }

        const searchQuery = parsedArgs.searchTerms.join(" ");

        // Handle target channel if specified
        if (parsedArgs.channel) {
            const channelUser = await getUserByUsername(prisma, parsedArgs.channel);
            if (!channelUser) {
                return c.text(`Channel "${parsedArgs.channel}" not found.`);
            }
            channelProviderId = channelUser.id; // Override channelProviderId
            channelName = channelUser.displayName; // Update channelName for messages
        }

        const searchLower = searchQuery.toLowerCase();
        const rarityMatch = rarities.find(r => r.toLowerCase() === searchLower);

        // Build the where clause dynamically
        const where: Prisma.FishWhereInput = { channelProviderId }; // Use the potentially updated channelProviderId

        if (parsedArgs.user) {
            // Case-insensitive search for username
            // Ensure the user exists in the target channel context before adding the filter
            const targetUser = await prisma.user.findFirst({
                where: {
                    displayName: { equals: parsedArgs.user },
                    // Optionally add channelProviderId here if users are channel-specific in your model
                },
                select: { id: true }, // Just need to know if they exist
            });
            if (!targetUser) {
                return c.text(`User "${parsedArgs.user}" not found${parsedArgs.channel ? ` in channel "${channelName}"` : ""}.`);
            }
            // Add the user filter using the potentially case-corrected name if needed, or just the provided name
            where.user = { displayName: { equals: parsedArgs.user } };
        }

        if (searchQuery) {
            // Only filter by rarity/name if there's a search query part
            if (rarityMatch) {
                where.rarity = rarityMatch;
            } else {
                // Case-insensitive search for fish name if not a rarity
                where.name = { contains: searchQuery };
            }
        }

        const fish = await prisma.fish.findFirst({ where, orderBy: { createdAt: "desc" }, include: { user: { select: { displayName: true } } } });

        // Construct more specific "not found" messages
        let notFoundSubject = "";
        if (parsedArgs.user) {
            notFoundSubject += ` caught by "${parsedArgs.user}"`;
        }
        if (rarityMatch) {
            notFoundSubject += ` of rarity "${rarityMatch}"`;
        } else if (searchQuery) {
            notFoundSubject += ` named "${searchQuery}"`;
        }

        const channelContext = parsedArgs.channel ? ` in channel "${channelName}"` : ""; // Add channel context

        if (!fish) {
            if (notFoundSubject) {
                return c.text(`No fish${notFoundSubject}${channelContext} have been caught yet.`);
            } else if (parsedArgs.user) {
                // Only target user specified
                return c.text(`No fish caught by "${parsedArgs.user}"${channelContext} found.`);
            } else {
                // Only channel specified (or no query)
                return c.text(`No fish have been caught${channelContext} yet.`);
            }
        }

        const caughtAgo = dayjs(fish.createdAt).fromNow();
        const details = [
            `Name: ${fish.name}`,
            `Rarity: ${fish.rarity}`,
            `Caught by: ${fish.user?.displayName ?? fish.userId}`, // Use displayName from included user
            `Size: ${formatSize(parseFloat(fish.size))}`,
            `Weight: ${formatWeight(parseFloat(fish.weight))}`,
            `Value: ${fish.value} silver`,
            `Caught: ${caughtAgo}`,
        ].join(" | ");

        // Construct more specific "found" message label
        let label = "Latest";
        if (parsedArgs.user) {
            label += ` fish caught by ${parsedArgs.user}`;
            if (rarityMatch) label += ` of rarity ${rarityMatch}`;
            else if (searchQuery) label += ` named "${fish.name}"`; // Use actual fish name if matched via contains
        } else if (rarityMatch) {
            label += ` ${rarityMatch}`;
        } else if (searchQuery) {
            label += ` "${fish.name}"`; // Use actual fish name
        }

        return c.text(`${label} fish${channelContext}: ${details}`);
    }
}
