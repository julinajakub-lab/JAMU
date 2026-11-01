# Connecting the shared database (about 10 minutes)

Until this is done the site runs in **demo mode**: it works, but everything you click is saved only in your own browser and the password is `jamu2016`.

Supabase is free. Nobody needs a credit card.

## 1. Create the Supabase project
1. Go to <https://supabase.com> and click **Start your project**. Sign in with your GitHub account.
2. Click **New project**.
   - Name: `jamu`
   - Database password: click **Generate a password** (you won't need it for the website, but keep it somewhere).
   - Region: **Central EU (Frankfurt)**
3. Click **Create new project** and wait about 2 minutes until it's ready.

## 2. Create the table
1. In the left menu, open **SQL Editor**.
2. Click **New query**, paste the whole content of [`supabase.sql`](supabase.sql), and click **Run**. You should see "Success. No rows returned". This also creates the private photo storage (1 GB free, roughly 2,500 photos, since the site shrinks each photo before uploading).

## 3. Create the group login
1. Left menu → **Authentication** → **Users** → **Add user** → **Create new user**.
2. Email: `jamu@2016.com` (it doesn't need to be a real mailbox)
3. Password: the **group password** you want to give the gang.
4. Tick **Auto Confirm User**, then click **Create user**.

## 4. Stop strangers from signing up
1. Left menu → **Authentication** → **Sign In / Providers** (on some screens: **Providers** or **Settings**).
2. Turn **off** "Allow new users to sign up" and click **Save**.

## 5. Copy two values
1. Left menu → **Project Settings** (gear icon) → **API** (may be called **Data API** / **API Keys**).
2. Copy the **Project URL** and the **anon public** key.
3. Send both to Claude, or paste them into [`config.js`](config.js) yourself. (The anon key is designed to be public. Your data is protected by the group password.)

That's it. Reload the site and log in with the group password.

---

# Changing the group password later
Supabase → Authentication → Users → click the gang user → **Reset password** / **Update user**, and set the new password. Tell the gang.
