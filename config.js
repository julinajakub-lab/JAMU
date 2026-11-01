// Connect the site to the shared database (Supabase).
// Leave the two Supabase values empty to run in DEMO MODE:
// everything then saves only in your own browser, and the password is "jamu2016".
window.JAMU_CONFIG = {
  supabaseUrl: 'https://bvfiiieclpaupmdcilgr.supabase.co',      // Supabase → Project Settings → API → Project URL
  supabaseAnonKey: 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6ImJ2ZmlpaWVjbHBhdXBtZGNpbGdyIiwicm9sZSI6ImFub24iLCJpYXQiOjE3OTM1MzQ0ODcsImV4cCI6MjEwOTExMDQ4N30.cLmx9nscHjrQ426u_r1p3zX6J-EpZ3N2HEYVHA21lmY',  // Supabase → Project Settings → API → "anon public" key
  groupEmail: 'jamu@2016.com', // the e-mail of the shared user you created in Supabase
  demoPassword: 'jamu2016'
};
