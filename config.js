// Connect the site to the shared database (Supabase).
// Leave the two Supabase values empty to run in DEMO MODE:
// everything then saves only in your own browser, and the password is "jamu2016".
window.JAMU_CONFIG = {
  supabaseUrl: '',      // Supabase → Project Settings → API → Project URL
  supabaseAnonKey: '',  // Supabase → Project Settings → API → "anon public" key
  groupEmail: 'gang@jamu-trips.cz', // the e-mail of the shared user you created in Supabase
  demoPassword: 'jamu2016'
};
