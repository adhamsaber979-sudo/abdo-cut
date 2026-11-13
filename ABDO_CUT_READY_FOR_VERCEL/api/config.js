require('dotenv').config();

module.exports = async (req, res) => {
  res.setHeader('Content-Type', 'application/json');
  res.setHeader('Cache-Control', 'no-store');

  const supabaseUrl = process.env.SUPABASE_URL || '';
  const supabaseAnonKey = process.env.SUPABASE_ANON_KEY || '';
  const hasSupabase = Boolean(supabaseUrl && supabaseAnonKey);

  res.status(200).json({
    authMode: hasSupabase ? 'supabase' : 'local',
    supabaseUrl,
    supabaseAnonKey,
    serverLimits: {
      hyperserve: parseInt(process.env.SERVER_LIMIT_HYPERSERVE || '10', 10),
      cloudinary: parseInt(process.env.SERVER_LIMIT_CLOUDINARY || '10', 10)
    },
    servers: ['hyperserve', 'cloudinary']
  });
};
