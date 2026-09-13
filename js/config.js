/*
 * Supabase-Konfiguration.
 *
 * SUPABASE_URL:        Dashboard -> Project Settings -> Data API -> "Project URL"
 * SUPABASE_ANON_KEY:   Dashboard -> Project Settings -> API Keys -> "anon" / "publishable" Key
 *                       (NIEMALS den "service_role"/secret Key hier eintragen!)
 *
 * Der anon/publishable Key ist bewusst öffentlich im Client sichtbar - er
 * gewährt selbst KEINEN Zugriff, sondern nur zusammen mit einer gültigen
 * Login-Session (siehe supabase/migrations/0001_init.sql, Row Level Security).
 */
const SUPABASE_URL = '';
const SUPABASE_ANON_KEY = '';
