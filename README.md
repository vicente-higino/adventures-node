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
- Success odds are capped at 75%, with payout-aware caps down to 55% for high
  payouts. A rare matching item plus Inspired can reach 75% on a low-payout
  adventure, while a 2x adventure remains capped at 55%.
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
