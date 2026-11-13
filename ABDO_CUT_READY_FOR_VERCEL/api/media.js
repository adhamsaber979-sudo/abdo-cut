const { verifyAuthAsync } = require('./_utils/auth');
const {
  getMediaRows,
  saveMediaRecords,
  updateMediaOrder,
  deleteMedia
} = require('./_utils/db');

module.exports = async (req, res) => {
  res.setHeader('Content-Type', 'application/json');
  res.setHeader('Cache-Control', 'no-store');

  // GET is public so visitors can view the portfolio
  if (req.method === 'GET') {
    try {
      const rows = await getMediaRows();
      return res.status(200).json(rows);
    } catch (err) {
      console.error('Error fetching media:', err);
      return res.status(500).json({ error: 'تعذر جلب بيانات الفيديوهات' });
    }
  }

  // All mutating actions require admin authorization
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

  if (req.method === 'POST') {
    const { records, orderedIds } = body;
    if (!records || !Array.isArray(records) || !records.length) {
      return res.status(400).json({ error: 'بيانات الفيديو غير مكتملة' });
    }

    try {
      const saved = await saveMediaRecords(records, orderedIds);
      return res.status(201).json({ success: true, count: saved.length });
    } catch (err) {
      console.error('Error saving media:', err);
      return res.status(400).json({ error: err.message || 'فشل حفظ الفيديو' });
    }
  }

  if (req.method === 'PATCH') {
    const { category, orderedIds } = body;
    if (!category || !orderedIds || !Array.isArray(orderedIds)) {
      return res.status(400).json({ error: 'بيانات الترتيب غير مكتملة' });
    }

    try {
      await updateMediaOrder(category, orderedIds);
      return res.status(200).json({ success: true });
    } catch (err) {
      console.error('Error updating order:', err);
      return res.status(500).json({ error: err.message || 'فشل حفظ الترتيب' });
    }
  }

  if (req.method === 'DELETE') {
    const { id } = body;
    if (!id) {
      return res.status(400).json({ error: 'معرّف الفيديو مطلوب للحذف' });
    }

    try {
      const deleted = await deleteMedia(id);
      return res.status(200).json({ success: true, deleted: deleted.length });
    } catch (err) {
      console.error('Error deleting media:', err);
      return res.status(500).json({ error: err.message || 'فشل حذف الفيديو' });
    }
  }

  res.setHeader('Allow', 'GET, POST, PATCH, DELETE');
  return res.status(405).json({ error: 'Method Not Allowed' });
};
