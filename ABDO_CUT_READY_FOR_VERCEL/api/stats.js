const { getServerCounts } = require('./_utils/db');
require('dotenv').config();

module.exports = async (req, res) => {
  res.setHeader('Content-Type', 'application/json');
  res.setHeader('Cache-Control', 'no-store');

  try {
    const counts = await getServerCounts();
    const limitHyperserve = parseInt(process.env.SERVER_LIMIT_HYPERSERVE || '15', 10);
    const limitCloudinary = parseInt(process.env.SERVER_LIMIT_CLOUDINARY || '15', 10);

    const stats = {
      hyperserve: {
        name: 'سيرفر 1',
        count: counts.hyperserve,
        limit: limitHyperserve,
        isLimitReached: counts.hyperserve >= limitHyperserve,
        status: process.env.HYPERSERVE_API_KEY
          ? (counts.hyperserve >= limitHyperserve ? 'limit_reached' : 'connected')
          : 'ready',
        storage: null,
        bandwidth: null,
        configured: Boolean(process.env.HYPERSERVE_API_KEY)
      },
      cloudinary: {
        name: 'سيرفر 2',
        count: counts.cloudinary,
        limit: limitCloudinary,
        isLimitReached: counts.cloudinary >= limitCloudinary,
        status: (process.env.CLOUDINARY_CLOUD_NAME && process.env.CLOUDINARY_API_KEY)
          ? (counts.cloudinary >= limitCloudinary ? 'limit_reached' : 'connected')
          : 'ready',
        storage: null,
        bandwidth: null,
        configured: Boolean(process.env.CLOUDINARY_CLOUD_NAME && process.env.CLOUDINARY_API_KEY)
      },
      totalCount: counts.total
    };

    // Attempt to fetch Cloudinary usage stats if API Secret is provided
    if (process.env.CLOUDINARY_CLOUD_NAME && process.env.CLOUDINARY_API_KEY && process.env.CLOUDINARY_API_SECRET) {
      try {
        const cloudinary = require('cloudinary').v2;
        cloudinary.config({
          cloud_name: process.env.CLOUDINARY_CLOUD_NAME,
          api_key: process.env.CLOUDINARY_API_KEY,
          api_secret: process.env.CLOUDINARY_API_SECRET
        });
        const usage = await cloudinary.api.usage();
        if (usage) {
          if (usage.storage && usage.storage.usage !== undefined) {
            const mb = (usage.storage.usage / (1024 * 1024)).toFixed(1);
            stats.cloudinary.storage = `${mb} MB`;
          }
          if (usage.bandwidth && usage.bandwidth.usage !== undefined) {
            const mb = (usage.bandwidth.usage / (1024 * 1024)).toFixed(1);
            stats.cloudinary.bandwidth = `${mb} MB`;
          }
        }
      } catch (e) {
        console.warn('Could not fetch Cloudinary usage:', e.message);
      }
    }

    // Attempt to fetch Hyperserve usage stats if API Key is provided
    if (process.env.HYPERSERVE_API_KEY) {
      try {
        const url = `${process.env.HYPERSERVE_API_URL || 'https://api.hyperserve.io/v1'}/usage`;
        const r = await fetch(url, {
          headers: { Authorization: `Bearer ${process.env.HYPERSERVE_API_KEY}` }
        });
        if (r.ok) {
          const hUsage = await r.json();
          if (hUsage.storage) stats.hyperserve.storage = hUsage.storage;
          if (hUsage.bandwidth) stats.hyperserve.bandwidth = hUsage.bandwidth;
        }
      } catch (e) {
        console.warn('Could not fetch Hyperserve usage:', e.message);
      }
    }

    return res.status(200).json(stats);
  } catch (err) {
    console.error('Error generating stats:', err);
    return res.status(500).json({ error: 'تعذر جلب إحصائيات السيرفرات' });
  }
};
