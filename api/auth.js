const crypto = require('crypto');
require('dotenv').config();

module.exports = async (req, res) => {
  res.setHeader('Content-Type', 'application/json');

  if (req.method === 'POST') {
    let body = req.body;
    if (typeof body === 'string') {
      try { body = JSON.parse(body); } catch (e) { body = {}; }
    }
    const { email, password } = body || {};
    const adminEmail = process.env.ADMIN_EMAIL || 'admin@abdocut.com';
    const adminPassword = process.env.ADMIN_PASSWORD || 'admin123';

    if (!email || !password) {
      return res.status(400).json({ error: 'يرجى إدخال البريد الإلكتروني وكلمة المرور' });
    }

    // Check credentials against configured admin
    if (email.trim().toLowerCase() === adminEmail.trim().toLowerCase() && password === adminPassword) {
      const token = crypto
        .createHmac('sha256', process.env.ADMIN_JWT_SECRET || 'abdo_cut_dev_secret_key_2026')
        .update(adminEmail)
        .digest('hex');

      return res.status(200).json({
        success: true,
        token,
        user: { email: adminEmail, role: 'admin' }
      });
    }

    return res.status(401).json({ error: 'البريد الإلكتروني أو كلمة المرور غير صحيحة' });
  }

  if (req.method === 'GET') {
    const { verifyAuth } = require('./_utils/auth');
    try {
      const user = verifyAuth(req);
      return res.status(200).json({ authenticated: true, user });
    } catch (e) {
      return res.status(401).json({ authenticated: false, error: e.message });
    }
  }

  res.setHeader('Allow', 'GET, POST');
  return res.status(405).json({ error: 'Method Not Allowed' });
};
