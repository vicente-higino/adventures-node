# Adventures Bot

A Twitch adventure and fishing game bot built with Node.js,
Hono, Prisma, and Twurple.

## Features

- Adventure and fishing minigames with leaderboards
- Silver (points) system with duels, giving, and stats
- Provider support (Twitch)
- Persistent storage with PostgreSQL (via Prisma)
- Extensible adventure scenarios

## Setup

1. **Install dependencies:**

    ```bash
    npm install
    ```

2. **Configure environment variables:**

    - Copy `.env.example` to `.env` and fill in required values:
        ```
        TWITCH_CLIENT_ID=your_client_id
        TWITCH_CLIENT_SECRET=your_client_secret
        DATABASE_URL=postgresql://user:pass@host:port/db
        COOLDOWN_FISHING_IN_HOURS=1
        COOLDOWN_ADVENTURE_IN_HOURS=1
        ADVENTURE_RPG_ENABLED=false
        ```

3. **Run database migrations:**

    ```bash
    npm run db:deploy
    ```

    For the adventure RPG migration, drain every old application replica before
    deploying the migration. Start the new build with `ADVENTURE_RPG_ENABLED=false`,
    verify it is healthy, then set the flag to `true`. New-version replicas can
    resolve both legacy and RPG adventures, but old binaries must not run against
    the new adventure constraints. Ambiguous legacy runs created by concurrency
    races are cancelled without an automatic refund so they can be reconciled
    manually without minting silver.

4. **Start the development server:**
    ```bash
    npm run dev
    ```

## Usage

- The bot exposes HTTP endpoints for adventure, fishing, points, duels, and
  stats.
- Integrate with chat platforms using webhooks or custom integrations.

### Adventure loot and statuses

- `!adv <silver> [raid]` keeps the classic start, join, and wager flow. Join
  confirmations show that player's current odds for the active adventure.
- A new player starts at 50%. Only the strongest equipped item matching the
  adventure theme applies: common loot adds 5%, uncommon 10%, and rare 15%.
- Critical successes find and automatically equip loot and grant Inspired
  (+10%) for the next adventure. Critical failures grant a theme-flavoured
  -5% status for the next adventure. Only one temporary status applies.
- Success odds are capped at 75%. Multiplier adventures start at their balanced
  base odds and accept up to +15% total from loot/status: 2x ranges from 50% to
  65%, 3x from 30% to 45%, 4x from 25% to 40%, and 5x from 20% to 35%. Common,
  uncommon, and rare matching loot add 5%, 10%, and 15%; Inspired adds 10%,
  subject to the same +15% total limit.
- Adventure tickets never activate automatically. During an active adventure,
  use `!advupgrade [2x|3x|4x|5x]`; without an argument it consumes the highest
  usable ticket owned by the caller.
- Adventures can also roll these payouts naturally. The combined 2x-or-higher
  chance remains 2.5%: 2x is 2.25%, 3x is 0.20%, 4x is 0.04%, and 5x is 0.01%.
- When an Adventure Ticket drops, its weighted multiplier is 90% for 2x, 8%
  for 3x, 1.6% for 4x, and 0.4% for 5x. These weights are also stored in each
  redeemable's synced config.
- `!char` shows gear, status, and record. `!inv loot` lists adventure loot;
  `!equip` and `!unequip` allow manual changes after automatic equipping.
- Resolution uses the legacy-style narrative and survivor list, adding compact
  critical, loot, status, streak, and recovery information. `!advlast` shows
  the last persisted result without checks or XP progression.

## Scripts

- `npm run dev` - Start development server with hot reload
- `npm run build` - Build for production
- `npm run start` - Run built server
- `npm run test` - Run tests

## License

MIT
