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
     ```

3. **Run database migrations:**
   ```bash
   npm run db:deploy
   ```

4. **Start the development server:**
   ```bash
   npm run dev
   ```

## Usage

- The bot exposes HTTP endpoints for adventure, fishing, points, duels, and
  stats.
- Integrate with chat platforms using webhooks or custom integrations.

## Scripts

- `npm run dev` - Start development server with hot reload
- `npm run build` - Build for production
- `npm run start` - Run built server
- `npm run test` - Run tests

## License

MIT
