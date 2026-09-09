# Shorts Cross-Promotion App — Implementation Plan

## Context

The goal is a new mobile app (iOS + Android) where creators submit links to their own YouTube Shorts or Instagram Reels, other users browse those links in a scrollable in-app feed and watch them, and everything (users, submissions, reports) is fully manageable by admins. The working directory (`d:\project\App`) is currently empty — this is a from-scratch greenfield build, so this plan defines the whole project rather than modifying existing code.

Key decisions already made with the user:
- **No re-hosting of video files.** The app stores only the submitted link + metadata and plays it through the platform's own official embed (YouTube iframe / Instagram embed via WebView). This is what keeps the app itself from copying copyrighted video content.
- **No credits/points economy** — just an open, shared feed anyone can browse.
- **Manual "tap to play" instead of autoplay.** The user specifically asked for a Play button rather than videos auto-starting, partly hoping this reduces platform-policy risk. It doesn't remove that risk (see Risks below), but it's better UX regardless, so the feed is built around explicit user-initiated play.
- **Mobile:** React Native (TypeScript), via Expo.
- **Backend:** Supabase (Postgres + RLS, Supabase Auth, Storage, Edge Functions).
- **Admin:** a separate custom-built web dashboard (React + Vite), not just the raw Supabase Studio console.

**Real risk to go in with eyes open on** (flagged now, detailed in §8): YouTube's and Instagram's Terms of Service restrict organizing "watch my video for views" exchanges regardless of whether playback is manual or automatic — a tap-to-play button reduces neither this ToS exposure nor App Store's "wrapper app" review risk by much, though it does slightly help both. Get legal/ToS review in parallel with development, not after building.

---

## 1. Data Model (Supabase / Postgres)

Four tables under RLS, `uuid` PKs, `auth.users` as identity source.

**`profiles`** (1:1 with `auth.users`, auto-created via `handle_new_user()` trigger on signup): `id`, `display_name`, `email`, `phone`, `instagram_handle`, `youtube_handle`, `avatar_url`, `bio`, `role` (`user`/`moderator`/`admin`), `is_banned`, `banned_reason`, `banned_at`, `created_at`/`updated_at`.

**`videos`**: `id`, `submitted_by` (FK profiles), `platform` (`youtube`/`instagram`), `original_url`, `platform_video_id`, `canonical_url`, `thumbnail_url`, `title`, `author_name`, `status` (`pending`/`approved`/`rejected`/`flagged`), `rejection_reason`, `moderated_by`, `moderated_at`, `view_count_in_app` (in-app impressions only — **not** the real platform view count, don't imply otherwise in UI copy), `report_count`, `is_deleted`, timestamps. Unique on `(platform, platform_video_id)`. Index on `(status, created_at desc)` for the feed/queue, and on `submitted_by`.

**`reports`**: `id`, `video_id`, `reported_by`, `reason` (`broken_link`/`spam`/`inappropriate`/`not_own_content`/`other`), `notes`, `status` (`open`/`reviewed`/`dismissed`), `created_at`. Unique on `(video_id, reported_by)`. Trigger increments `videos.report_count` and auto-flips `status` to `flagged` past a threshold (e.g. 3 reports).

**Roles:** use `profiles.role` directly (simplest at this scale) rather than a separate admin table.

**RLS**, via a shared `is_admin()` `SECURITY DEFINER` function:
- `profiles`: anyone reads any profile; a user updates only their own row (role/ban fields excluded from self-edit); admin bypasses.
- `videos`: public reads `status='approved' AND is_deleted=false`; owner also reads/updates their own row while `status='pending'`; admin full access; deletes are soft (`is_deleted=true`) except hard-delete reserved for admin cleanup.
- `reports`: owner reads their own; admin reads/updates all; insert by the reporting user only.
- `avatars` storage bucket: user writes only to their own `{uid}/...` path; public read.

## 2. Auth

Supabase Auth, email + password for MVP (phone OTP flagged as an easy later add, not MVP — needs an SMS provider). RN client uses `@supabase/supabase-js` with `AsyncStorage` for session persistence, wrapped in an `AuthProvider` context. First-time users are routed to a mandatory "Complete your profile" screen (display name required) before they can submit videos. Require `email_confirmed_at` before allowing submissions (spam control), though browsing the feed doesn't need it. Standard `resetPasswordForEmail` flow with a custom URL scheme for deep-linking back into the app.

## 3. Mobile App (React Native / Expo)

**Navigation:** React Navigation — root switches `AuthStack` vs `MainTabs` on session state.

**Data layer:** TanStack Query for all reads (`useInfiniteQuery` for the feed), Supabase client directly for mutations, no Redux needed.

Screens:
- `AuthStack`: Welcome, SignUp, Login, ForgotPassword, CompleteProfile.
- `MainTabs`: **Feed**, **Submit** (paste link → validate → metadata preview → confirm), **My Videos** (own submissions, status, and **in-app view count per video** — see §4), **Profile** (view/edit profile, handles, avatar, settings/logout).
- Supplementary: `VideoReportScreen` (modal), optional `UserPublicProfileScreen`.

## 4. Feed Mechanics

**Pagination:** cursor-based (keyset on `created_at, id`), via a Postgres RPC (`get_feed_page`), not offset pagination.

**List/pager:** `FlatList` (or `react-native-pager-view`) in vertical, paging/snap mode; `onViewableItemsChanged` tracks which single item is "active." Only the active item ± 1 mounts a live player; others show a static thumbnail — this keeps memory/WebView count sane.

**Manual play (per user's decision):** the active feed item shows a thumbnail with a centered Play button rather than auto-starting. Tapping it starts playback for that item only.

**Auto-advance after playback ends:**
- **YouTube:** `react-native-youtube-iframe` exposes real player-state events (`onChangeState` → `'ended'`). On end, auto-advance the pager to the next item.
- **Instagram:** no official RN SDK; embedding is a WebView loading Instagram's oEmbed HTML. Instagram's embedded player does **not** reliably expose an "ended" event — this is a genuine platform limitation. Mitigation: show a persistent "swipe up for next" affordance on Instagram items, plus a generous safety-timer (e.g. 30s) that auto-advances if the user hasn't acted, so nobody gets stuck. Document this asymmetry as a known limitation.

**View counting:** increment `videos.view_count_in_app` only after the user has actually tapped play and watched a few seconds — debounced/batched, not one write per scroll tick. This counter is what's surfaced back to the submitter on their **My Videos** screen (per-video view count, and optionally a total across all their submissions) so they can see how much traction each of their videos got inside the app. Never present this number as the creator's real YouTube/Instagram view count — label it clearly (e.g. "In-app views") since it will differ from the real platform count.

## 5. URL Validation & Metadata

**Client-side, on paste:** regex-detect platform + extract ID immediately (YouTube `/shorts/<11-char-id>` or standard video URLs; Instagram `/reel(s)?/<shortcode>`). Reject unrecognized URLs before any network call.

**Metadata fetch, via a single Supabase Edge Function (`fetch-video-metadata`)** that re-validates server-side (don't trust the client alone) and proxies:
- **YouTube oEmbed** — public, free, no key needed. Low risk, build first.
- **Instagram oEmbed** — requires a **Meta Graph API access token and app review** for the `oembed_read` permission; the old fully-public oEmbed endpoint is increasingly restricted. **This is a real project risk and potential blocker** — register the Meta Developer App and kick off review in Phase 0, since approval can take days to weeks and isn't guaranteed. If approval doesn't land in time, ship with a fallback: allow Instagram submissions without a fetched thumbnail (generic placeholder card), relying on the live embed to render once played.

**Rate limiting:** enforce max submissions/user/day via a Postgres trigger or the Edge Function (RLS alone can't express a rolling count).

## 6. Admin Web Dashboard

**Stack:** React + Vite + TypeScript + shadcn/ui + TanStack Query/Table + React Router — a small internal SPA, not Next.js (no public/SEO need).

**Auth:** same Supabase Auth pool, but gate dashboard entry on `profiles.role in ('admin','moderator')`; admins are provisioned manually (SQL/Studio), not via self-signup.

**Privileged writes go through Supabase Edge Functions**, never the service-role key in the browser bundle — each function re-checks `is_admin()` server-side. Narrow, purpose-built functions: `admin-ban-user`, `admin-delete-user`, `admin-moderate-video`, `admin-delete-video`.

**Screens:**
- Stats home (user/submission counts, platform split, reports open).
- User management: search/sort, view/edit, ban/unban, delete.
- Video moderation queue: filter by status, inline preview, approve/reject(+reason)/flag/delete, bulk actions.
- Reports/abuse queue: linked to the video and reporter, mark reviewed/dismissed.
- **Audit log** (`admin_actions` table, written by every Edge Function mutation): who did what to whom, when — needed once moderation decisions get questioned.

## 7. Project Structure

Monorepo, using npm workspaces at the root — **with `apps/mobile` deliberately excluded from the workspace**:

```
/App
├── apps/
│   ├── mobile/        # Expo RN app — standalone npm project, its own node_modules
│   └── admin/         # Vite React admin dashboard — npm workspace member
├── packages/
│   └── shared/        # shared TS types + URL-parsing logic (used by admin + Edge Functions)
├── supabase/
│   ├── migrations/    # schema, RLS, triggers
│   └── functions/     # fetch-video-metadata, admin-ban-user, admin-delete-user, admin-moderate-video, admin-delete-video
└── package.json        # workspaces: ["apps/admin", "packages/*"] — mobile is NOT listed
```

**Why mobile is excluded from the workspace:** npm workspaces hoist dependencies to the root `node_modules`. Metro (React Native's bundler) doesn't reliably resolve hoisted dependencies without extra config, and this caused a broken install during setup (packages present in `package.json` but missing from disk). Keeping `apps/mobile` as a fully standalone npm project with its own local `node_modules` avoids this entirely and matches Expo's officially supported setup. `apps/admin` (a normal Vite web app) hoists fine and stays in the workspace.

Run the mobile app with `npm run dev` (or `npm start`) from inside `apps/mobile` — not from the repo root. Root-level `npm run dev` runs the **admin** dashboard; `npm run mobile` from the root is a convenience alias that delegates into `apps/mobile`.

Shared TS types (`supabase gen types typescript`) are consumed by the admin app and Edge Functions via `packages/shared`; the mobile app duplicates what it needs locally since it isn't a workspace member.

## 8. Risks to Go In Aware Of

- **Platform ToS risk:** YouTube/Instagram both restrict organizing artificial/incentivized view exchanges. Manual tap-to-play helps UX and review optics slightly but does **not** remove this exposure — it's about the app's purpose, not the play trigger. Views played via embed also aren't guaranteed to count toward the creator's real platform total (both platforms apply their own fraud/dwell-time heuristics). Get legal/ToS review early, in parallel with build.
- **App Store review risk (Guideline 4.2, "Minimum Functionality"):** apps that read as a thin wrapper around embedded third-party content are a recurring rejection pattern. Mitigate with genuinely native value beyond the embeds (profiles, submission/curation flow, polished native UI, push notifications) and expect to budget time for a possible appeal/resubmission cycle.
- **Google Play UGC policy:** requires a report mechanism (have it) and a block/mute-user mechanism (**not currently in scope** — recommend adding a simple "block user" feature before submission).
- **No ownership verification:** nothing currently confirms a submitter actually owns the YouTube/Instagram account they're linking — anyone could submit anyone's public video. This is a moderation and impersonation-complaint risk; OAuth-based "verify you own this channel" is a possible future phase, explicitly out of MVP scope for now.
- **Instagram embed "ended" event gap** (§4) — accepted limitation, mitigated with a swipe affordance + safety timer.

## 9. Phase Order (no time estimates)

0. **Foundations** — monorepo scaffold, Supabase project, Expo app scaffold, admin app scaffold, CI lint/typecheck, **start the Meta Developer App / oEmbed review process immediately** (longest, least-controllable lead time in the project).
1. **Backend + auth** — migrations, RLS, `handle_new_user`, Supabase Auth config, RN auth screens, admin login + role gate.
2. **Profile + submission** — edit-profile + avatar upload, `fetch-video-metadata` function (YouTube first, Instagram behind a flag pending Meta approval), URL validators, Submit screen, My Videos.
3. **Feed** — cursor pagination RPC, windowed pager, manual-play UI, YouTube auto-advance-on-end, Instagram swipe/timer fallback, view counting, report flow.
4. **Admin panel** — stats, user management, moderation queue, reports queue, audit log.
5. **Store submission prep** — ToS/legal review, add block-user feature if pursuing Play, App Store review notes emphasizing native value-add, privacy policy/data-safety forms covering the PII collected (email, phone, Instagram/YouTube handles), submit to both stores with buffer for an iOS rejection/appeal cycle.

### Critical files (first ones to create)
- `supabase/migrations/0001_init_schema.sql` — tables, RLS, `is_admin()`, triggers
- `supabase/functions/fetch-video-metadata/index.ts` — YouTube/Instagram oEmbed proxy
- `apps/mobile/src/lib/supabaseClient.ts` — RN Supabase client + session persistence
- `apps/mobile/src/screens/FeedScreen.tsx` — pager, windowed player mounting, manual play + auto-advance logic
- `apps/admin/src/pages/VideoModeration.tsx` — moderation queue UI
- `packages/shared/src/urlParsers.ts` — YouTube/Instagram URL detection, shared by mobile + Edge Function

## Verification

Since this is a from-scratch build, "verification" here means the milestones to confirm at each phase rather than testing an existing system:
1. After Phase 1: sign up / log in a real test user in the RN app against the live Supabase project; confirm a `profiles` row is auto-created and RLS blocks a second test user from editing the first's profile.
2. After Phase 2: submit a real YouTube Shorts URL end-to-end and confirm metadata/thumbnail comes back via the Edge Function; attempt an Instagram URL and confirm the fallback behaves correctly if Meta approval isn't yet granted.
3. After Phase 3: run the feed with several approved test videos, confirm manual play works, YouTube auto-advances on end, and the Instagram swipe/timer fallback triggers correctly.
4. After Phase 4: as an admin test account, ban a user and moderate a video from the dashboard, and confirm those changes are reflected immediately in the mobile app (RLS-enforced).
5. Before Phase 5: run through Apple's and Google's UGC/review guidelines checklist against the actual built app, not just this plan, since review policy specifics can shift.
