This is a [Next.js](https://nextjs.org) project bootstrapped with [`create-next-app`](https://nextjs.org/docs/app/api-reference/cli/create-next-app).

## Getting Started

First, run the development server:

```bash
npm run dev
# or
yarn dev
# or
pnpm dev
# or
bun dev
```

Open [http://localhost:3000](http://localhost:3000) with your browser to see the result.

You can start editing the page by modifying `app/page.tsx`. The page auto-updates as you edit the file.

This project uses [`next/font`](https://nextjs.org/docs/app/building-your-application/optimizing/fonts) to automatically optimize and load [Geist](https://vercel.com/font), a new font family for Vercel.

## Task Management App

A real-time task management dashboard built with Next.js, Supabase, and TailwindCSS. Supports role-based access (Admin, Manager, Employee) with optimistic UI updates and live collaboration.

## Features

- **Role-based access control**
  - Admin: manage users and roles
  - Manager: create, edit, delete tasks; assign to employees; view employee task tracking
  - Employee: view assigned tasks; update status; add comments

- **Real-time UI updates**
  - Live task updates via Supabase subscriptions
  - Optimistic updates with rollback on errors
  - Per-task loading indicators

- **Task management**
  - Priority levels: Normal / 🚨 BOMBE (urgent)
  - Status tracking: To Do / In Progress / Done
  - Due dates and overdue indicators
  - Comments and notifications

- **Responsive UI**
  - Built with TailwindCSS and shadcn/ui components
  - Dark mode support via CSS variables
  - Mobile-friendly layouts

## Quick Start

### 1. Clone and install

```bash
git clone https://github.com/alae-eddinee/task-management.git
cd task-management
npm install
```

### 2. Supabase setup

- Create a new project at [supabase.com](https://supabase.com)
- Run the SQL from `supabase-schema.sql` in your Supabase SQL editor
- Enable Row Level Security (RLS) policies are included in the schema

### 3. Environment variables

Create `.env.local`:

```env
NEXT_PUBLIC_SUPABASE_URL=YOUR_SUPABASE_URL
NEXT_PUBLIC_SUPABASE_ANON_KEY=YOUR_SUPABASE_ANON_KEY
SUPABASE_SERVICE_ROLE_KEY=YOUR_SUPABASE_SERVICE_ROLE_KEY
```

### 4. Run

```bash
npm run dev
```

Open http://localhost:3000

### 5. Create your admin user

- Sign up as the first user
- In Supabase Dashboard > Authentication > Users, manually set that user’s `role` in the `profiles` table to `'admin'`
- Log out and log back in to see the Admin dashboard

## Project structure

```
src/
├── app/
│   ├── admin/      # Admin dashboard
│   ├── employee/   # Employee dashboard
│   ├── manager/    # Manager dashboard
│   └── login/
├── components/
│   ├── layout/     # Header, StatsCard, OnlineUsers
│   └── ui/        # shadcn/ui components
├── hooks/          # useAuth, useNotifications
├── lib/           # Supabase client
├── types/         # TypeScript definitions
└── middleware.ts  # Auth + role-based routing
```

## Tech stack

- **Framework**: Next.js 16 (App Router)
- **Backend**: Supabase (PostgreSQL, Auth, Realtime)
- **Styling**: TailwindCSS + CSS variables for theming
- **Components**: shadcn/ui
- **Icons**: Lucide React
- **Dates**: date-fns

## Development notes

- All mutations use optimistic updates with rollback
- Real-time subscriptions keep UI in sync across tabs/users
- Auth middleware protects routes and redirects by role
- ESLint + TypeScript configured

## License

MIT

## Learn More

To learn more about Next.js, take a look at the following resources:

- [Next.js Documentation](https://nextjs.org/docs) - learn about Next.js features and API.
- [Learn Next.js](https://nextjs.org/learn) - an interactive Next.js tutorial.

You can check out [the Next.js GitHub repository](https://github.com/vercel/next.js) - your feedback and contributions are welcome!

## Deploy on Vercel

The easiest way to deploy your Next.js app is to use the [Vercel Platform](https://vercel.com/new?utm_medium=default-template&filter=next.js&utm_source=create-next-app&utm_campaign=create-next-app-readme) from the creators of Next.js.

Check out our [Next.js deployment documentation](https://nextjs.org/docs/app/building-your-application/deploying) for more details.
