const crypto = require('crypto');
require('dotenv').config();

function verifyAuth(req) {
  const authHeader = req.headers.authorization || req.headers.Authorization;
  if (!authHeader) {
    throw new Error('غير مصرح لك: يرجى تسجيل الدخول أولاً');
  }

  const token = authHeader.replace(/^Bearer\s+/i, '').trim();
  if (!token) {
    throw new Error('رمز الدخول مفقود');
  }

  // 1. Check local admin token
  const expectedToken = crypto
    .createHmac('sha256', process.env.ADMIN_JWT_SECRET || 'abdo_cut_dev_secret_key_2026')
    .update(process.env.ADMIN_EMAIL || 'admin@abdocut.com')
    .digest('hex');

  if (token === expectedToken) {
    return { email: process.env.ADMIN_EMAIL || 'admin@abdocut.com', role: 'admin' };
  }

  // 2. Check Supabase token if Supabase is configured
  if (process.env.SUPABASE_URL && process.env.SUPABASE_SERVICE_ROLE_KEY) {
    try {
      const { createClient } = require('@supabase/supabase-js');
      const supabase = createClient(process.env.SUPABASE_URL, process.env.SUPABASE_SERVICE_ROLE_KEY);
      // Synchronous return placeholder or promise in async context
      return { token, supabase };
    } catch (e) {
      // ignore
    }
  }

  throw new Error('جلسة الدخول غير صالحة أو منتهية الصلاحية');
}

async function verifyAuthAsync(req) {
  const authHeader = req.headers.authorization || req.headers.Authorization;
  if (!authHeader) {
    throw new Error('غير مصرح لك: يرجى تسجيل الدخول أولاً');
  }

  const token = authHeader.replace(/^Bearer\s+/i, '').trim();
  if (!token) {
    throw new Error('رمز الدخول مفقود');
  }

  // 1. Check local admin token
  const expectedToken = crypto
    .createHmac('sha256', process.env.ADMIN_JWT_SECRET || 'abdo_cut_dev_secret_key_2026')
    .update(process.env.ADMIN_EMAIL || 'admin@abdocut.com')
    .digest('hex');

  if (token === expectedToken) {
    return { email: process.env.ADMIN_EMAIL || 'admin@abdocut.com', role: 'admin' };
  }

  // 2. Check Supabase token if Supabase is configured
  if (process.env.SUPABASE_URL && (process.env.SUPABASE_SERVICE_ROLE_KEY || process.env.SUPABASE_ANON_KEY)) {
    try {
      const { createClient } = require('@supabase/supabase-js');
      const cleanUrl = process.env.SUPABASE_URL.replace(/\/rest\/v1\/?$/i, '').replace(/\/+$/, '');
      const supabase = createClient(
        cleanUrl,
        process.env.SUPABASE_SERVICE_ROLE_KEY || process.env.SUPABASE_ANON_KEY
      );
      const { data: { user }, error } = await supabase.auth.getUser(token);
      if (!error && user) {
        return { email: user.email, id: user.id, role: 'admin' };
      }
    } catch (e) {
      // ignore
    }
  }

  throw new Error('جلسة الدخول غير صالحة أو منتهية الصلاحية');
}

module.exports = { verifyAuth, verifyAuthAsync };
