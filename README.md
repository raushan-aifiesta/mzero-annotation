# AI Fiesta — Annotation Platform

A modern data annotation platform built with Next.js and Supabase. Designed for Vision AI teams to label images for object detection, segmentation, and classification tasks.

## Features

- **Project Management** — Create and organize annotation projects with custom label configs
- **Image Annotation** — Canvas-based bounding box annotation with keyboard shortcuts
- **Multi-format Export** — Export annotations in JSON, COCO, or YOLO format
- **Real-time Progress** — Track annotation progress per project
- **Auth & RLS** — Supabase Auth with Row Level Security for data isolation
- **Dark UI** — Purpose-built dark interface optimized for annotation work

## Tech Stack

- **Frontend**: Next.js 15 (App Router), React, TypeScript, Tailwind CSS v4
- **Backend**: Supabase (PostgreSQL, Auth, Storage, RLS)

## Setup

### 1. Create a Supabase Project

Go to [supabase.com](https://supabase.com), create a project, then run the SQL in `supabase-schema.sql` in the SQL Editor.

### 2. Configure Environment

```bash
cp .env.example .env
```

Fill in your Supabase URL and anon key from the Supabase dashboard (Settings → API).

### 3. Install & Run

```bash
npm install
npm run dev
```

Open [http://localhost:3000](http://localhost:3000).

### 4. Create an Account

Sign up on the login page. For local dev, you can disable email confirmation in Supabase Auth settings.

## Keyboard Shortcuts (Annotation View)

| Key | Action |
|-----|--------|
| 1-9 | Select label |
| Delete/Backspace | Remove selected region |
| ⌘S / Ctrl+S | Save & next task |

## Project Structure

```
src/
├── app/
│   ├── (dashboard)/           # Authenticated pages with sidebar
│   │   ├── page.tsx           # Projects list
│   │   └── projects/
│   │       ├── new/           # Create project
│   │       └── [id]/
│   │           ├── page.tsx   # Project detail + tasks
│   │           ├── settings/  # Project settings
│   │           ├── export/    # Export annotations
│   │           └── annotate/[taskId]/  # Annotation interface
│   ├── login/                 # Auth page
│   └── auth/                  # OAuth callbacks
├── components/
│   ├── Sidebar.tsx
│   ├── TaskList.tsx
│   ├── TaskImporter.tsx
│   └── ImageAnnotator.tsx     # Canvas-based annotation engine
├── lib/
│   ├── supabase/
│   │   ├── client.ts          # Browser client
│   │   └── server.ts          # Server client
│   └── types.ts               # TypeScript types
└── middleware.ts              # Auth middleware
```
