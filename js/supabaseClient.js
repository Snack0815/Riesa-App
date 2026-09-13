/* Initialisiert den Supabase-Client (Publishable/Anon Key, nie Service-Role). */
const supabaseClient = (SUPABASE_URL && SUPABASE_ANON_KEY)
  ? supabase.createClient(SUPABASE_URL, SUPABASE_ANON_KEY, {
      auth: { persistSession: true, autoRefreshToken: true }
    })
  : null;

function isSupabaseConfigured() {
  return !!supabaseClient;
}

async function getSession() {
  if (!supabaseClient) return null;
  const { data } = await supabaseClient.auth.getSession();
  return data.session;
}

async function signIn(email, password) {
  const { data, error } = await supabaseClient.auth.signInWithPassword({ email, password });
  if (error) throw error;
  return data.session;
}

async function signOut() {
  await supabaseClient.auth.signOut();
}

function onAuthChange(callback) {
  supabaseClient.auth.onAuthStateChange((_event, session) => callback(session));
}
