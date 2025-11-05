# 📚 xGuru : Zero-Cost SaaS Platform

##

---

## 🔧 TECH STACK OVERVIEW

### Frontend (UI)

* **Framework:** Next.js (App Router)
* **Auth:** NextAuth.js (Role-based)
* **Styling:** TailwindCSS + Shadcn UI + Framer Motion
* **State Management:** React Context / Zustand
* **Routing:** Role-based layout system
* **Media Player:** Custom YouTube iFrame-based player with limited controls

### Backend

* **API Framework:** Next.js Route Handlers / Optional Nest.js in API routes
* **Database:** NeonDB (PostgreSQL)
* **Storage:** Supabase (for metadata, image thumbnails, etc.)
* **Cache:** Upstash Redis (for course & user metadata caching)
* **Queue (Optional):** Upstash Queue / Supabase Edge Functions

### Dev Tools

* **Monorepo Tool:** Turborepo (Admin, Instructor, Student apps)
* **Deployment:** Vercel (serverless frontend & backend)
* **Security:** Cloudflare (DDoS, Firewall, Content protection)

### External APIs

* **YouTube Data API v3** (for playlist, video management)
* **YouTube Live Streaming API**

---

## 🔍 UNIQUE SELLING PROPOSITION (USP)

* ✅ **True YouTube-based Course SaaS**: Uses instructors' own YouTube (free forever), but everything feels native.
* ✅ **Custom Secure Player**: Looks nothing like YouTube but uses its infra.
* ✅ **No video hosting cost**, yet allows paid + protected video delivery.
* ✅ **Zero Setup for Instructors**: Just connect YouTube once.
* ✅ **Live Classes + Recordings** in the same UI.
* ✅ **Super Admin Role** for managing users, abuse, content review.
* ✅ **Indian-rooted global branding** (like Vedantu meets Teachable)

---

## 🌈 UI/UX FLOW (Detailed)

### 👨‍🏫 Instructor Portal

#### Dashboard

* Clean sidebar with:

  * **Create Course**
  * **My Courses** (Uploaded / Live)
  * **Live Sessions**
  * **Earnings (future)**

#### Create Course UI

* Step-by-step wizard:

  1. Course Title, Description, Tags, Thumbnail Upload
  2. Choose Course Type:

     * Full Pre-recorded (upload all videos)
     * Full Live (future sessions only)
     * Hybrid (upload + live in same course)
  3. For each module:

     * Upload or Schedule Live
  4. Assign YouTube Playlist (one-time authorization)

#### Live Class Scheduling

* Google Calendar-like date & time selection
* Broadcast directly to connected YouTube Live

---

### 👨‍🏫 Student Portal

#### Homepage

* Hero Section + Search Bar + Filter by Category / Language
* Cards for:

  * **Trending Courses**
  * **Live Now**
  * **Popular Instructors**

#### Course Detail Page

* Banner + Info
* Access to enrolled students only
* **Custom Player**:

  * Limited controls: Pause/Play, Quality, Speed
  * Right-click disabled
  * Prevent screen recording using overlay + Cloudflare rules

#### My Courses

* Tabs: Upcoming | In Progress | Completed

---

### 👮 Super Admin Portal

#### Dashboard

* Total Users, Courses, Abuse Flags
* Review Reported Content
* Activate/Deactivate Courses or Users
* Role Management

#### Permissions

* View All Data
* Approve Courses
* Block Users
* Promote Users to Instructor

---

## 🔄 Backend & Process Flow

### Roles: Student, Instructor, Super Admin

* Implemented via NextAuth session callback and JWT token

### Core Flow: Instructor Uploads → Student Views

1. Instructor uploads or schedules class (UI)
2. System:

   * Saves metadata to NeonDB
   * Adds YouTube video to assigned Playlist
   * Caches course info in Upstash
3. Student Enrolls:

   * Enrolled info stored in Neon
   * Access via secure route guard
   * Player loads only if token matches enrollment

---

## 🔐 SECURITY MEASURES

* **Custom YouTube Player Wrapper**

  * No share/download button
  * iFrame sandboxed
  * Cloudflare security headers

* **Role-based Page Access**

  * Middleware + session tokens via NextAuth

* **API Rate Limiting (Upstash)**

  * Prevent abuse from scraping bots

* **Signed URLs for resources (future)**

  * If move from YouTube to private CDN
---

## 🧐 CACHING STRATEGY

* **Course Cards (Homepage):**

  * Cache in Redis (Upstash) with TTL

* **Live Classes:**

  * Invalidate Redis after each new session

* **Enrollments:**

  * DB reads only if Redis miss

---

## 🤔 Future-Proof Additions

* 💸 Paid Course Support (Stripe/Razorpay)
* 📈 Analytics (Views, Drop-off, Engagement)
* 📄 PDF, Resource Downloads (Supabase Storage)
* 🚀 Migration to Private CDN if required
* 🤝 Marketplace-like Instructor Discovery
* ✨ AI-based Auto Thumbnail / Tag Suggestions
* 🧳 Language-based Course Filtering & Subtitles
* ⏱ Auto Reminder Emails for Live Sessions

---
