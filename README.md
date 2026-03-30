# FLJ - Twitter Account Verification Platform

An open-source platform for verifying and rating Twitter/X accounts, with community-driven expose system, points ranking, and admin management tools.

## Features

- 🔍 **Account Search & Verification** - Search Twitter accounts and get AI-powered analysis
- 💥 **Expose System (爆料广场)** - Community-driven expose board with voting and categories
- 🏆 **Points & Ranking** - Tiered user system with points progression
- 🤖 **Telegram Auth** - Three-tier authentication (天龙人/居委会/匿名)
- 💰 **$FLJ Token Top-up** - BSC blockchain token utility for points
- 🛡️ **Admin Dashboard** - Full management panel with statistics, user management, and content moderation
- 🖼️ **Image Upload** - Evidence images for exposes with admin review
- 🌐 **i18n Support** - Chinese (zh/zh-tw), Japanese, English

## Tech Stack

- **Framework**: Next.js 14 (App Router)
- **Database**: PostgreSQL
- **AI**: xAI Grok API
- **Auth**: JWT + Telegram Bot
- **Styling**: Tailwind CSS
- **Deployment**: PM2 + Nginx

## Getting Started

### Prerequisites

- Node.js 18+
- PostgreSQL 14+
- Telegram Bot Token
- xAI API Key

### Installation

1. Clone the repository
```bash
git clone https://github.com/iam567/FLJopen.git
cd FLJopen
npm install
```

2. Set up environment variables
```bash
cp .env.example .env.local
# Edit .env.local with your credentials
```

3. Set up the database
```bash
# Create database and run migrations
psql -U postgres -c "CREATE DATABASE fljdb;"
psql -U postgres -d fljdb -f schema.sql
```

4. Run development server
```bash
npm run dev
```

## Environment Variables

See `.env.example` for all required environment variables.

## Project Structure

```
app/
├── api/          # API routes
├── admin/        # Admin dashboard
├── boom/         # Expose board
├── verify/       # Account verification
└── topup/        # Token top-up

lib/
├── db.ts         # Database connection
└── rank.ts       # User ranking logic
```

## Contributing

Pull requests are welcome! Please open an issue first to discuss major changes.

## License

MIT
