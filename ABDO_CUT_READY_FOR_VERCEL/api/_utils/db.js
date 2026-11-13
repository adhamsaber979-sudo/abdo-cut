const fs = require('fs');
const path = require('path');
require('dotenv').config();

const LOCAL_DB_PATH = path.join(__dirname, '../../data/media.json');

function getSupabaseClient() {
  if (process.env.SUPABASE_URL && (process.env.SUPABASE_SERVICE_ROLE_KEY || process.env.SUPABASE_ANON_KEY)) {
    const { createClient } = require('@supabase/supabase-js');
    const cleanUrl = process.env.SUPABASE_URL.replace(/\/rest\/v1\/?$/i, '').replace(/\/+$/, '');
    return createClient(
      cleanUrl,
      process.env.SUPABASE_SERVICE_ROLE_KEY || process.env.SUPABASE_ANON_KEY
    );
  }
  return null;
}

function readLocalDb() {
  try {
    if (!fs.existsSync(LOCAL_DB_PATH)) {
      fs.mkdirSync(path.dirname(LOCAL_DB_PATH), { recursive: true });
      fs.writeFileSync(LOCAL_DB_PATH, '[]', 'utf-8');
      return [];
    }
    const content = fs.readFileSync(LOCAL_DB_PATH, 'utf-8');
    return JSON.parse(content || '[]');
  } catch (err) {
    console.error('Error reading local db:', err);
    return [];
  }
}

function writeLocalDb(data) {
  try {
    fs.mkdirSync(path.dirname(LOCAL_DB_PATH), { recursive: true });
    fs.writeFileSync(LOCAL_DB_PATH, JSON.stringify(data, null, 2), 'utf-8');
  } catch (err) {
    console.error('Error writing local db:', err);
    throw new Error('فشل حفظ البيانات محلياً');
  }
}

async function getMediaRows() {
  const supabase = getSupabaseClient();
  if (supabase) {
    const { data, error } = await supabase
      .from('media')
      .select('*')
      .order('sort_order', { ascending: true })
      .order('created_at', { ascending: false });
    if (error) throw new Error('خطأ في قاعدة بيانات Supabase: ' + error.message);
    return data || [];
  }
  return readLocalDb().sort((a, b) => (a.sort_order ?? 0) - (b.sort_order ?? 0));
}

async function getServerCounts() {
  const rows = await getMediaRows();
  let hyperserve = 0;
  let cloudinary = 0;
  for (const row of rows) {
    const s = (row.server || '').toLowerCase();
    if (s === 'hyperserve') hyperserve++;
    else if (s === 'cloudinary') cloudinary++;
  }
  return { hyperserve, cloudinary, total: rows.length };
}

async function saveMediaRecords(records, orderedIds) {
  const supabase = getSupabaseClient();
  const counts = await getServerCounts();
  const limitHyperserve = parseInt(process.env.SERVER_LIMIT_HYPERSERVE || '10', 10);
  const limitCloudinary = parseInt(process.env.SERVER_LIMIT_CLOUDINARY || '10', 10);

  // Validate server limit for incoming records
  for (const r of records) {
    const s = (r.server || 'cloudinary').toLowerCase();
    if (s === 'hyperserve' && counts.hyperserve >= limitHyperserve) {
      throw new Error(`وصل سيرفر 1 إلى الحد الأقصى التنظيمي (${limitHyperserve} فيديوهات). يرجى اختيار سيرفر 2.`);
    }
    if (s === 'cloudinary' && counts.cloudinary >= limitCloudinary) {
      throw new Error(`وصل سيرفر 2 إلى الحد الأقصى التنظيمي (${limitCloudinary} فيديوهات). يرجى اختيار سيرفر 1.`);
    }
  }

  if (supabase) {
    // 1. Insert new records into Supabase
    const { error: insertError } = await supabase.from('media').insert(records);
    if (insertError) throw new Error('فشل إضافة السجل إلى Supabase: ' + insertError.message);

    // 2. Update sort order if orderedIds provided
    if (orderedIds && orderedIds.length) {
      for (let i = 0; i < orderedIds.length; i++) {
        await supabase
          .from('media')
          .update({ sort_order: i })
          .eq('id', orderedIds[i]);
      }
    }
    return records;
  }

  // Local fallback
  const db = readLocalDb();
  for (const r of records) {
    db.push(r);
  }
  if (orderedIds && orderedIds.length) {
    const idMap = new Map();
    db.forEach(item => idMap.set(item.id, item));
    orderedIds.forEach((id, idx) => {
      if (idMap.has(id)) {
        idMap.get(id).sort_order = idx;
      }
    });
  }
  writeLocalDb(db);
  return records;
}

async function updateMediaOrder(category, orderedIds) {
  const supabase = getSupabaseClient();
  if (supabase) {
    for (let i = 0; i < orderedIds.length; i++) {
      const { error } = await supabase
        .from('media')
        .update({ sort_order: i })
        .eq('id', orderedIds[i]);
      if (error) console.error('Error updating sort_order:', error);
    }
    return true;
  }

  const db = readLocalDb();
  const idMap = new Map();
  db.forEach(item => idMap.set(item.id, item));
  orderedIds.forEach((id, idx) => {
    if (idMap.has(id)) {
      idMap.get(id).sort_order = idx;
    }
  });
  writeLocalDb(db);
  return true;
}

async function deleteMedia(id) {
  const supabase = getSupabaseClient();
  let toDelete = [];

  if (supabase) {
    // Find record to check if it has a group_id (for before/after pairs)
    const { data: target } = await supabase
      .from('media')
      .select('*')
      .eq('id', id)
      .single();

    if (target && target.group_id) {
      const { data: group } = await supabase
        .from('media')
        .select('*')
        .eq('group_id', target.group_id);
      toDelete = group || [target];
      await supabase.from('media').delete().eq('group_id', target.group_id);
    } else if (target) {
      toDelete = [target];
      await supabase.from('media').delete().eq('id', id);
    }
  } else {
    const db = readLocalDb();
    const target = db.find(x => x.id === id);
    if (target && target.group_id) {
      toDelete = db.filter(x => x.group_id === target.group_id);
      const remaining = db.filter(x => x.group_id !== target.group_id);
      writeLocalDb(remaining);
    } else {
      toDelete = target ? [target] : [];
      const remaining = db.filter(x => x.id !== id);
      writeLocalDb(remaining);
    }
  }

  // Attempt to delete from external storage providers (Cloudinary / Hyperserve)
  for (const item of toDelete) {
    try {
      if (item.server === 'cloudinary' && item.public_id && process.env.CLOUDINARY_API_SECRET) {
        const cloudinary = require('cloudinary').v2;
        cloudinary.config({
          cloud_name: process.env.CLOUDINARY_CLOUD_NAME,
          api_key: process.env.CLOUDINARY_API_KEY,
          api_secret: process.env.CLOUDINARY_API_SECRET
        });
        await cloudinary.uploader.destroy(item.public_id, { resource_type: 'video' });
      } else if (item.server === 'hyperserve' && item.public_id && process.env.HYPERSERVE_API_KEY) {
        const url = `${process.env.HYPERSERVE_API_URL || 'https://api.hyperserve.io/v1'}/videos/${item.public_id}`;
        await fetch(url, {
          method: 'DELETE',
          headers: { Authorization: `Bearer ${process.env.HYPERSERVE_API_KEY}` }
        }).catch(() => {});
      }
    } catch (e) {
      console.warn(`Could not delete storage asset for ${item.id}:`, e.message);
    }
  }

  return toDelete;
}

module.exports = {
  getMediaRows,
  getServerCounts,
  saveMediaRecords,
  updateMediaOrder,
  deleteMedia
};
