
export default function handler(req, res) {
  res.setHeader('Cache-Control', 'no-store');

  const supabaseUrl = process.env.VITE_SUPABASE_URL;
  const supabaseAnonKey = process.env.VITE_SUPABASE_ANON_KEY;

  if (!supabaseUrl || !supabaseAnonKey) {
    return res.status(500).json({
      error: 'Supabase environment variables are missing.'
    });
  }

  return res.status(200).json({
    supabaseUrl,
    supabaseAnonKey
  });
}