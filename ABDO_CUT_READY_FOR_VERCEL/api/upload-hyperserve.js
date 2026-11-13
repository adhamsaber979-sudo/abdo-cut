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

  let body = req.body;
  if (typeof body === 'string') {
    try { body = JSON.parse(body); } catch (e) { body = {}; }
  }
  const { action, videoId, filename, resolutions } = body || {};

  // Check Hyperserve server limit (15 videos)
  const counts = await getServerCounts();
  const limit = parseInt(process.env.SERVER_LIMIT_HYPERSERVE || '15', 10);
  if (counts.hyperserve >= limit) {
    return res.status(400).json({
      error: `وصل سيرفر 1 للحد الأقصى التنظيمي (${limit} فيديوهات). يرجى استخدام سيرفر 2 أو حذف فيديوهات قديمة.`
    });
  }

  const apiKey = process.env.HYPERSERVE_API_KEY;
  const baseUrl = process.env.HYPERSERVE_API_URL || 'https://api.hyperserve.io/api/video';

  if (!apiKey) {
    return res.status(503).json({
      error: 'مفتاح API الخاص بـ Hyperserve (HYPERSERVE_API_KEY) غير معين في المتغيرات البيئية. يرجى إضافته في ملف .env أو إعدادات Vercel.'
    });
  }

  // Action 1: Create Upload Session
  if (action === 'create' || !action) {
    try {
      const response = await fetch(baseUrl, {
        method: 'POST',
        headers: {
          'X-API-KEY': apiKey,
          'Content-Type': 'application/json'
        },
        body: JSON.stringify({
          filename: filename || 'video.mp4',
          isPublic: true,
          resolutions: resolutions || ['480p', '1080p']
        })
      });

      const data = await response.json();
      if (!response.ok) {
        throw new Error(data.message || data.error || 'تعذر بدء الرفع على Hyperserve');
      }

      return res.status(200).json(data);
    } catch (err) {
      console.error('Hyperserve create upload error:', err);
      return res.status(502).json({ error: 'خطأ في الاتصال مع سيرفر Hyperserve: ' + err.message });
    }
  }

  // Action 2: Complete Upload Session
  if (action === 'complete') {
    if (!videoId) {
      return res.status(400).json({ error: 'معرف الفيديو مطلوب لإكمال الرفع' });
    }

    const videoUrl = `https://cdn.hyperserve.io/${videoId}/1080p.mp4`;
    const posterUrl = `https://cdn.hyperserve.io/${videoId}/poster.jpg`;

    return res.status(200).json({
      success: true,
      video_url: videoUrl,
      poster_url: posterUrl,
      public_id: videoId
    });
  }

  return res.status(400).json({ error: 'إجراء غير معروف' });
};
