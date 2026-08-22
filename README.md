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

### Adventure RPG

- `!adv <silver> [approach]` starts or joins the persisted scenario shown in
  chat. Each scenario offers three approaches tied to one of 12 checks.
- Characters list the 18 class names with `!class help`, choose one with
  `!class <name>`, inspect their profile with `!adventurer`, and manage loot
  with `!inv loot`, `!equip`, and `!unequip`.
- Checks use a seeded d20 against DC 11. Class, gear, status, and party bonuses
  are bounded to -4 through +4; payout-aware success odds stay between 30% and
  70% (a 2x adventure is capped at 55%).
- Resolution sends one legacy-style chat message with narrative, payouts,
  criticals, loot, statuses, and recovery bonuses. `!advlast` shows the last
  persisted result.

## Scripts

- `npm run dev` - Start development server with hot reload
- `npm run build` - Build for production
- `npm run start` - Run built server
- `npm run test` - Run tests

## License

MIT
