# JAMU Survivors' Club

The private website of the JAMU class of 2016: plan cottage weekends, vote on dates, split the bills, and keep the memories. Iva is no longer with us. (She's fine.)

## Pages
- **Home**: the reigning monarch and heir, the next trip with a countdown, stats, a random quote.
- **The Gang**: everyone's card with nicknames, trip counts and crowns.
- **Next Trip**: cottage address with navigation (Google Maps / Mapy.cz), date voting, who's coming, and the crowning ceremony at the end.
- **Archive**: past trips as tickets. Anyone can add one.
- **After the Trip**: photo album link, who paid for what, and who owes whom.

## How it's built
Plain HTML, CSS and JavaScript, hosted free on GitHub Pages. Data lives in a free Supabase database (one table, `records`). Without Supabase settings the site runs in demo mode in your browser.

- `config.js`: Supabase connection and the shared login e-mail
- `members.js`: the gang, nicknames and the little one-liners (edit freely)
- `app.js`: all pages and logic
- `style.css`: the look
- `supabase.sql` + `SETUP.md`: database setup, step by step
