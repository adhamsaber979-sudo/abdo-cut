const { verifyAuthAsync } = require('./_utils/auth');
const { getSiteSettings, saveSiteSettings } = require('./_utils/db');

module.exports = async (req, res) => {
  res.setHeader('Content-Type', 'application/json');
  res.setHeader('Cache-Control', 'no-store');

  // GET is public so visitors and the website can render active section prices
  if (req.method === 'GET') {
    try {
      const settings = await getSiteSettings();
      return res.status(200).json({ success: true, settings });
    } catch (err) {
      console.error('Error fetching settings:', err);
      return res.status(500).json({ error: 'تعذر جلب إعدادات الأسعار' });
    }
  }

  // Updating prices requires admin auth
  if (req.method === 'POST' || req.method === 'PATCH') {
    try {
      await verifyAuthAsync(req);
    } catch (authErr) {
      return res.status(401).json({ error: authErr.message || 'غير مصرح لك بتنفيذ هذه العملية' });
    }

    let body = req.body;
    if (typeof body === 'string') {
      try { body = JSON.parse(body); } catch (e) { body = {}; }
    }
    body = body || {};

    const { pricing } = body;
    if (!pricing || typeof pricing !== 'object') {
      return res.status(400).json({ error: 'بيانات الأسعار غير صالحة' });
    }

    try {
      const saved = await saveSiteSettings({ pricing });
      return res.status(200).json({ success: true, settings: saved });
    } catch (err) {
      console.error('Error saving settings:', err);
      return res.status(500).json({ error: err.message || 'فشل حفظ إعدادات الأسعار' });
    }
  }

  res.setHeader('Allow', 'GET, POST, PATCH');
  return res.status(405).json({ error: 'Method Not Allowed' });
};
