const crypto = require('crypto');
const { verifyAuthAsync } = require('./_utils/auth');
const { getServerCounts } = require('./_utils/db');
require('dotenv').config();

module.exports = async (req, res) => {
  res.setHeader('Content-Type', 'application/json');

  if (req.method !== 'POST') {
    res.setHeader('Allow', 'POST');
    return res.status(405).json({ error: 'Method Not Allowed' });
  }

  try {
    await verifyAuthAsync(req);
  } catch (authErr) {
    return res.status(401).json({ error: authErr.message || 'غير مصرح لك' });
  }

  // Check Cloudinary server limit (10 videos)
  const counts = await getServerCounts();
  const limit = parseInt(process.env.SERVER_LIMIT_CLOUDINARY || '10', 10);
  if (counts.cloudinary >= limit) {
    return res.status(400).json({
      error: `وصل سيرفر 2 للحد الأقصى التنظيمي (${limit} فيديوهات). يرجى استخدام سيرفر 1 أو حذف فيديوهات قديمة.`
    });
  }

  const cloudName = process.env.CLOUDINARY_CLOUD_NAME;
  const apiKey = process.env.CLOUDINARY_API_KEY;
  const apiSecret = process.env.CLOUDINARY_API_SECRET;

  if (!cloudName || !apiKey || !apiSecret) {
    return res.status(503).json({
      error: 'بيانات اعتماد Cloudinary (CLOUDINARY_CLOUD_NAME, CLOUDINARY_API_KEY, CLOUDINARY_API_SECRET) غير مكتملة في المتغيرات البيئية.'
    });
  }

  let body = req.body;
  if (typeof body === 'string') {
    try { body = JSON.parse(body); } catch (e) { body = {}; }
  }
  const { category = 'general' } = body || {};
  const timestamp = Math.round(new Date().getTime() / 1000);
  const folder = `abdo-cut/${category}`;

  // Signature string for Cloudinary: sorted keys (folder, timestamp) + api_secret
  const toSign = `folder=${folder}&timestamp=${timestamp}${apiSecret}`;
  const signature = crypto.createHash('sha1').update(toSign).digest('hex');

  return res.status(200).json({
    signature,
    timestamp,
    folder,
    api_key: apiKey,
    cloud_name: cloudName
  });
};
