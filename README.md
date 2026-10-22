# OutNYC Admin

Admin area for OutNYC, an app where people sign in with Google, get AI-made walking plans of real NYC places, and vote 👍/👎 on them. Both apps use the same Supabase database.

## Pages

| Page          | What you can do                                                                                                                                                   |
| ------------- | ----------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| `/`           | Dashboard: users, plans, votes, engagement, costs & limits, demand, top plans and users. Filter by this month, past week, past 2 weeks, all time or custom dates. |
| `/users`      | **Read** users/profiles: name, photo, join date, plans made, votes given, admin yes/no.                                                                           |
| `/plans`      | **Read** AI-generated plans: list and search.                                                                                                                     |
| `/plans/new`  | **Create** a plan.                                                                                                                                                |
| `/plans/[id]` | **Read** one plan (with its prompt and AI model), **update** it, or **delete** it.                                                                                |
| `/votes`      | **Read** upvotes/downvotes, filtered by vote, user or plan.                                                                                                       |

## Run locally

Add `NEXT_PUBLIC_SUPABASE_URL` and `NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY` to `.env.local`, then:

```bash
npm install
npm run dev -- -p 3001
```

Built with Next.js 16, Supabase and Tailwind CSS 4.
