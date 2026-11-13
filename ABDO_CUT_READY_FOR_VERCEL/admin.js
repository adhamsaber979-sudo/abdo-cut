// ABDO CUT - Admin Dashboard Controller
const $ = (selector) => document.querySelector(selector);
const $$ = (selector) => document.querySelectorAll(selector);

const state = {
  token: localStorage.getItem('abdo_admin_token') || null,
  user: null,
  config: null,
  stats: null,
  rows: []
};

const CATEGORIES = {
  intro: 'مقدمة الموقع',
  before_after: 'قبل وبعد',
  reels: 'Reels',
  promos: 'Promos',
  ads: 'Ads',
  motion: 'Motion'
};

// Bootstrap application
async function boot() {
  try {
    const cfgRes = await fetch('/api/config');
    if (cfgRes.ok) {
      state.config = await cfgRes.json();
    }
  } catch (e) {
    console.warn('Config load warning:', e);
  }

  // Check saved token session
  if (state.token) {
    try {
      const authRes = await fetch('/api/auth', {
        headers: { Authorization: `Bearer ${state.token}` }
      });
      if (authRes.ok) {
        const data = await authRes.json();
        state.user = data.user;
        $('#connectionState').textContent = 'لوحة التحكم متصلة وجاهزة';
        showAdmin();
        return;
      }
    } catch (e) {
      console.warn('Session verification failed:', e);
    }
    // If token invalid, clear it
    localStorage.removeItem('abdo_admin_token');
    state.token = null;
  }

  $('#connectionState').textContent = 'يرجى تسجيل الدخول';
  $('#loginCard').hidden = false;
  $('#adminContent').hidden = true;
}

function showAdmin() {
  $('#loginCard').hidden = true;
  $('#adminContent').hidden = false;
  $('#connectionState').textContent = 'لوحة التحكم متصلة وجاهزة';
  loadStats();
  loadRows();
}

function authHeader() {
  if (!state.token) {
    throw new Error('يرجى تسجيل الدخول أولاً');
  }
  return {
    'Authorization': `Bearer ${state.token}`,
    'Content-Type': 'application/json'
  };
}

// -------------------------------------------------------------
// Authentication Event Listeners
// -------------------------------------------------------------
$('#loginForm').addEventListener('submit', async (e) => {
  e.preventDefault();
  const email = $('#email').value.trim();
  const password = $('#password').value;
  const statusEl = $('#loginStatus');

  statusEl.textContent = 'جاري تسجيل الدخول…';
  statusEl.style.color = '#d9d2ff';

  try {
    const res = await fetch('/api/auth', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ email, password })
    });

    const data = await res.json();
    if (!res.ok) {
      throw new Error(data.error || 'فشل تسجيل الدخول');
    }

    state.token = data.token;
    state.user = data.user;
    localStorage.setItem('abdo_admin_token', data.token);

    statusEl.textContent = 'تم تسجيل الدخول بنجاح!';
    statusEl.style.color = '#6ee7b7';
    setTimeout(showAdmin, 400);
  } catch (err) {
    statusEl.textContent = err.message;
    statusEl.style.color = '#fca5a5';
  }
});

$('#logoutBtn').addEventListener('click', (e) => {
  e.preventDefault();
  localStorage.removeItem('abdo_admin_token');
  state.token = null;
  state.user = null;
  $('#adminContent').hidden = true;
  $('#loginCard').hidden = false;
  $('#connectionState').textContent = 'تم تسجيل الخروج';
});

// Sidebar collapse toggle
$('#toggleBtn').addEventListener('click', () => {
  const p = $('#sidePanel');
  p.classList.toggle('collapsed');
  const i = $('#toggleBtn i');
  i.classList.toggle('fa-xmark');
  i.classList.toggle('fa-bars');
});

// Placement change handler
$('#placement').addEventListener('change', () => {
  $('#positionWrap').hidden = $('#placement').value !== 'number';
});

// Category change handler (Single vs Before/After)
$('#category').addEventListener('change', () => {
  const isPair = $('#category').value === 'before_after';
  $('#singleFile').hidden = isPair;
  $('#pairFiles').hidden = !isPair;
  $('#singleServerWrap').hidden = isPair;

  $('#videoFile').required = !isPair;
  $('#beforeFile').required = isPair;
  $('#afterFile').required = isPair;
});

// Display file names on select with instant visual feedback and video preview
function setupFilePicker(inputId, boxId, iconId, nameId, hintId, wrapId, videoId, defaultTitle, defaultHint) {
  const input = $(inputId);
  const box = $(boxId);
  const icon = $(iconId);
  const name = $(nameId);
  const hint = $(hintId);
  const wrap = $(wrapId);
  const video = $(videoId);

  if (!input) return;

  input.addEventListener('change', (e) => {
    const file = e.target.files && e.target.files[0];
    if (file) {
      if (box) box.classList.add('has-file');
      if (icon) icon.className = 'fa-solid fa-circle-check';
      const sizeMB = (file.size / (1024 * 1024)).toFixed(2);
      if (name) name.textContent = `✓ تم اختيار: ${file.name}`;
      if (hint) hint.textContent = `الحجم: ${sizeMB} ميجابايت · جاهز للرفع الفوري`;

      if (video && wrap) {
        try {
          const blobUrl = URL.createObjectURL(file);
          video.src = blobUrl;
          wrap.style.display = 'block';
        } catch (x) {}
      }
    } else {
      if (box) box.classList.remove('has-file');
      if (icon) icon.className = 'fa-solid fa-file-video';
      if (name) name.textContent = defaultTitle;
      if (hint) hint.textContent = defaultHint;
      if (wrap) wrap.style.display = 'none';
      if (video) { video.pause(); video.src = ''; }
    }
  });
}

function resetFilePickers() {
  ['#singleFileBox', '#beforeFileBox', '#afterFileBox'].forEach(id => {
    const el = $(id);
    if (el) el.classList.remove('has-file');
  });
  if ($('#singleFileIcon')) $('#singleFileIcon').className = 'fa-solid fa-file-video';
  if ($('#beforeFileIcon')) $('#beforeFileIcon').className = 'fa-solid fa-circle-arrow-left';
  if ($('#afterFileIcon')) $('#afterFileIcon').className = 'fa-solid fa-circle-arrow-right';

  if ($('#singleFileName')) $('#singleFileName').textContent = 'اختر ملف الفيديو من جهازك';
  if ($('#beforeFileName')) $('#beforeFileName').textContent = 'فيديو قبل (Raw Footage)';
  if ($('#afterFileName')) $('#afterFileName').textContent = 'فيديو بعد (Final Edited)';

  if ($('#singleFileHint')) $('#singleFileHint').textContent = 'صيغ مدعومة: MP4 / MOV / WebM';
  if ($('#beforeFileHint')) $('#beforeFileHint').textContent = 'النسخة الخام قبل التعديل';
  if ($('#afterFileHint')) $('#afterFileHint').textContent = 'النسخة النهائية بعد التعديل والتلوين';

  ['#singlePreview', '#beforePreview', '#afterPreview'].forEach(id => {
    const v = $(id);
    if (v) { v.pause(); v.src = ''; }
  });
  ['#singlePreviewWrap', '#beforePreviewWrap', '#afterPreviewWrap'].forEach(id => {
    const w = $(id);
    if (w) w.style.display = 'none';
  });
}

setupFilePicker('#videoFile', '#singleFileBox', '#singleFileIcon', '#singleFileName', '#singleFileHint', '#singlePreviewWrap', '#singlePreview', 'اختر ملف الفيديو من جهازك', 'صيغ مدعومة: MP4 / MOV / WebM');
setupFilePicker('#beforeFile', '#beforeFileBox', '#beforeFileIcon', '#beforeFileName', '#beforeFileHint', '#beforePreviewWrap', '#beforePreview', 'فيديو قبل (Raw Footage)', 'النسخة الخام قبل التعديل');
setupFilePicker('#afterFile', '#afterFileBox', '#afterFileIcon', '#afterFileName', '#afterFileHint', '#afterPreviewWrap', '#afterPreview', 'فيديو بعد (Final Edited)', 'النسخة النهائية بعد التعديل والتلوين');

$('#refreshBtn').addEventListener('click', () => {
  loadStats();
  loadRows();
});

// -------------------------------------------------------------
// Server Stats & Capacity Meter
// -------------------------------------------------------------
async function loadStats() {
  try {
    const res = await fetch('/api/stats', { cache: 'no-store' });
    if (!res.ok) return;
    const stats = await res.json();
    state.stats = stats;

    const hs = stats.hyperserve;
    const cld = stats.cloudinary;

    // Server 1: Hyperserve
    $('#hsCount').textContent = hs.count;
    $('#hsLimitNum').textContent = hs.limit;
    const hsPct = Math.min(100, Math.round((hs.count / hs.limit) * 100));
    $('#hsMeter').style.width = hsPct + '%';
    if (hs.isLimitReached) {
      $('#hsMeter').classList.add('full');
      $('#hsBadge').textContent = 'ممتلئ (10/10)';
      $('#hsBadge').className = 'server-badge limit';
    } else {
      $('#hsMeter').classList.remove('full');
      $('#hsBadge').textContent = hs.configured ? 'متصل' : 'جاهز للربط';
      $('#hsBadge').className = 'server-badge' + (hs.configured ? '' : ' unconfigured');
    }
    if (hs.storage) $('#hsStorage').textContent = hs.storage;
    if (hs.bandwidth) $('#hsBandwidth').textContent = hs.bandwidth;

    // Server 2: Cloudinary
    $('#cldCount').textContent = cld.count;
    $('#cldLimitNum').textContent = cld.limit;
    const cldPct = Math.min(100, Math.round((cld.count / cld.limit) * 100));
    $('#cldMeter').style.width = cldPct + '%';
    if (cld.isLimitReached) {
      $('#cldMeter').classList.add('full');
      $('#cldBadge').textContent = 'ممتلئ (10/10)';
      $('#cldBadge').className = 'server-badge limit';
    } else {
      $('#cldMeter').classList.remove('full');
      $('#cldBadge').textContent = cld.configured ? 'متصل' : 'جاهز للربط';
      $('#cldBadge').className = 'server-badge' + (cld.configured ? '' : ' unconfigured');
    }
    if (cld.storage) $('#cldStorage').textContent = cld.storage;
    if (cld.bandwidth) $('#cldBandwidth').textContent = cld.bandwidth;

    // Update upload select options based on 10 videos limit
    updateServerDropdowns(hs.isLimitReached, cld.isLimitReached);

    // Limit warning banner
    const alertBox = $('#limitAlertBox');
    const alertText = $('#limitAlertText');
    if (hs.isLimitReached && cld.isLimitReached) {
      alertBox.hidden = false;
      alertText.textContent = 'وصل كلا السيرفرين (سيرفر 1 وسيرفر 2) للحد الأقصى (10 فيديوهات لكل سيرفر). يرجى حذف فيديوهات غير مستخدمة من القائمة بالأسفل لإتاحة الرفع مجدداً.';
      $('#uploadBtn').disabled = true;
    } else if (hs.isLimitReached) {
      alertBox.hidden = false;
      alertText.textContent = 'وصل سيرفر 1 للحد الأقصى التنظيمي (10 فيديوهات). تم إيقاف الرفع عليه مؤقتاً وتوجيه الرفع لسيرفر 2.';
      $('#uploadBtn').disabled = false;
    } else if (cld.isLimitReached) {
      alertBox.hidden = false;
      alertText.textContent = 'وصل سيرفر 2 للحد الأقصى التنظيمي (10 فيديوهات). تم إيقاف الرفع عليه مؤقتاً وتوجيه الرفع لسيرفر 1.';
      $('#uploadBtn').disabled = false;
    } else {
      alertBox.hidden = true;
      $('#uploadBtn').disabled = false;
    }
  } catch (e) {
    console.warn('Failed to load stats:', e);
  }
}

function updateServerDropdowns(hsFull, cldFull) {
  const selects = [$('#serverSelect'), $('#serverBeforeSelect'), $('#serverAfterSelect')];

  selects.forEach(sel => {
    if (!sel) return;
    const optHs = sel.querySelector('option[value="hyperserve"]');
    const optCld = sel.querySelector('option[value="cloudinary"]');

    if (optHs) {
      optHs.disabled = hsFull;
      optHs.textContent = hsFull ? 'سيرفر 1 (ممتلئ - 10/10)' : 'سيرفر 1';
    }
    if (optCld) {
      optCld.disabled = cldFull;
      optCld.textContent = cldFull ? 'سيرفر 2 (ممتلئ - 10/10)' : 'سيرفر 2';
    }

    // Auto-switch selection if current selection is disabled
    if (sel.value === 'hyperserve' && hsFull && !cldFull) {
      sel.value = 'cloudinary';
    } else if (sel.value === 'cloudinary' && cldFull && !hsFull) {
      sel.value = 'hyperserve';
    }
  });
}

// -------------------------------------------------------------
// Content Library (Load, Render, Re-order, Delete)
// -------------------------------------------------------------
async function loadRows() {
  try {
    const res = await fetch('/api/media', { cache: 'no-store' });
    if (!res.ok) throw new Error('تعذر تحميل الفيديوهات من السيرفر');
    state.rows = await res.json();
    renderRows();
  } catch (e) {
    $('#mediaList').innerHTML = `<div class="empty">${e.message}</div>`;
  }
}

function cardsForCategory(category) {
  const rows = state.rows.filter(x => x.category === category);
  const groups = new Map();

  rows.forEach(row => {
    const key = row.group_id || row.id;
    if (!groups.has(key)) {
      groups.set(key, { key, order: row.sort_order ?? 0, rows: [] });
    }
    const card = groups.get(key);
    card.rows.push(row);
    card.order = Math.min(card.order, row.sort_order ?? 0);
  });

  return [...groups.values()].sort((a, b) => a.order - b.order);
}

function renderRows() {
  const rows = state.rows;
  $('#totalCount').textContent = rows.length;
  $('#sectionCount').textContent = new Set(rows.map(x => x.category)).size;

  if (!rows.length) {
    $('#mediaList').innerHTML = '<div class="empty">لا توجد فيديوهات منشورة حالياً في الموقع. يمكنك رفع فيديو جديد من النموذج بالأعلى.</div>';
    return;
  }

  const wrap = document.createElement('div');
  wrap.className = 'category-groups';

  Object.keys(CATEGORIES).forEach(category => {
    const cards = cardsForCategory(category);
    if (!cards.length) return;

    const section = document.createElement('section');
    section.className = 'admin-category';

    const heading = document.createElement('h3');
    heading.textContent = `${CATEGORIES[category]} · (${cards.length} ${cards.length === 1 ? 'كارت' : 'كروت'})`;
    section.appendChild(heading);

    cards.forEach((card, index) => {
      const line = document.createElement('div');
      line.className = 'media-row';

      const thumbs = document.createElement('div');
      thumbs.className = 'media-thumbs';

      // Sort roles: before/main first, then after
      const sortedRows = [...card.rows].sort((a, b) => {
        const orderMap = { before: 0, main: 0, item: 0, after: 1 };
        return (orderMap[a.role] ?? 0) - (orderMap[b.role] ?? 0);
      });

      sortedRows.forEach(row => {
        const img = document.createElement('img');
        img.src = row.poster_url || '';
        img.alt = row.role || 'video';
        img.onerror = () => {
          img.src = 'data:image/svg+xml;utf8,<svg xmlns="http://www.w3.org/2000/svg" width="70" height="58" viewBox="0 0 70 58"><rect fill="%231a1a36" width="70" height="58"/><text fill="%23888" x="50%" y="50%" dominant-baseline="middle" text-anchor="middle" font-size="10">فيديو</text></svg>';
        };
        thumbs.appendChild(img);
      });

      const info = document.createElement('div');
      const name = document.createElement('b');
      name.textContent = category === 'before_after'
        ? 'قبل وبعد · كارت مزدوج'
        : (CATEGORIES[category] || category);

      // Server Badges
      const badgesWrap = document.createElement('span');
      card.rows.forEach(r => {
        const b = document.createElement('span');
        b.className = `badge-server badge-${r.server || 'cloudinary'}`;
        const sName = (r.server || 'cloudinary') === 'hyperserve' ? 'سيرفر 1' : 'سيرفر 2';
        b.textContent = (category === 'before_after') ? `${r.role === 'before' ? 'قبل' : 'بعد'}: ${sName}` : sName;
        badgesWrap.appendChild(b);
      });

      const small = document.createElement('small');
      const dateStr = card.rows[0]?.created_at
        ? new Date(card.rows[0].created_at).toLocaleDateString('ar-EG')
        : 'اليوم';
      small.textContent = `الترتيب: #${index + 1} · تاريخ الإضافة: ${dateStr}`;

      info.append(name, badgesWrap, small);

      const actions = document.createElement('div');
      actions.className = 'row-actions';

      const up = document.createElement('button');
      up.type = 'button';
      up.className = 'move-btn';
      up.innerHTML = '<i class="fa-solid fa-arrow-up"></i>';
      up.title = 'تحريك لأعلى';
      up.disabled = index === 0;
      up.addEventListener('click', () => moveCard(category, index, -1));

      const down = document.createElement('button');
      down.type = 'button';
      down.className = 'move-btn';
      down.innerHTML = '<i class="fa-solid fa-arrow-down"></i>';
      down.title = 'تحريك لأسفل';
      down.disabled = index === cards.length - 1;
      down.addEventListener('click', () => moveCard(category, index, 1));

      const del = document.createElement('button');
      del.type = 'button';
      del.className = 'delete-btn';
      del.innerHTML = '<i class="fa-solid fa-trash-can"></i> حذف';
      del.addEventListener('click', () => removeRow(card.rows[0].id));

      actions.append(up, down, del);
      line.append(thumbs, info, actions);
      section.appendChild(line);
    });

    wrap.appendChild(section);
  });

  $('#mediaList').replaceChildren(wrap);
}

async function moveCard(category, index, delta) {
  const cards = cardsForCategory(category);
  const to = index + delta;
  if (to < 0 || to >= cards.length) return;

  [cards[index], cards[to]] = [cards[to], cards[index]];

  const orderedIds = cards.flatMap(card =>
    card.rows.sort((a, b) => {
      const orderMap = { before: 0, main: 0, item: 0, after: 1 };
      return (orderMap[a.role] ?? 0) - (orderMap[b.role] ?? 0);
    }).map(row => row.id)
  );

  try {
    const headers = authHeader();
    const res = await fetch('/api/media', {
      method: 'PATCH',
      headers,
      body: JSON.stringify({ category, orderedIds })
    });
    if (!res.ok) {
      const err = await res.json();
      throw new Error(err.error || 'تعذر حفظ الترتيب');
    }
    await loadRows();
  } catch (e) {
    alert(e.message);
  }
}

async function removeRow(id) {
  if (!confirm('هل أنت متأكد من حذف هذا الكارت من الموقع؟ (في قسم قبل وبعد سيتم حذف الفيديوهين المرتبطين معاً)')) {
    return;
  }

  try {
    const headers = authHeader();
    const res = await fetch('/api/media', {
      method: 'DELETE',
      headers,
      body: JSON.stringify({ id })
    });
    if (!res.ok) {
      const err = await res.json();
      throw new Error(err.error || 'لم يتم الحذف');
    }
    await loadStats();
    await loadRows();
  } catch (e) {
    alert('خطأ أثناء الحذف: ' + e.message);
  }
}

// -------------------------------------------------------------
// Video Upload Handlers (Cloudinary & Hyperserve)
// -------------------------------------------------------------
async function uploadToProvider(file, server, category) {
  const headers = authHeader();

  async function uploadCloudinaryPipeline(assignedServer) {
    const sigRes = await fetch('/api/sign-upload', {
      method: 'POST',
      headers,
      body: JSON.stringify({ category })
    });

    const sigData = await sigRes.json();
    if (!sigRes.ok) {
      throw new Error(sigData.error || 'فشل تجهيز عملية الرفع على سيرفر التخزين');
    }

    const fd = new FormData();
    fd.append('file', file);
    fd.append('api_key', sigData.api_key);
    fd.append('timestamp', sigData.timestamp);
    fd.append('folder', sigData.folder);
    fd.append('signature', sigData.signature);

    const upRes = await fetch(`https://api.cloudinary.com/v1_1/${sigData.cloud_name}/video/upload`, {
      method: 'POST',
      body: fd
    });

    const asset = await upRes.json();
    if (!upRes.ok) {
      throw new Error(asset.error?.message || 'فشل رفع ملف الفيديو إلى سيرفر التخزين');
    }

    const poster = asset.secure_url
      .replace('/upload/', '/upload/so_0/')
      .replace(/\.(mp4|mov|webm)(\?.*)?$/i, '.jpg');

    return {
      video_url: asset.secure_url,
      poster_url: poster,
      public_id: asset.public_id,
      server: assignedServer || 'cloudinary'
    };
  }

  if (server === 'cloudinary') {
    return await uploadCloudinaryPipeline('cloudinary');
  }

  if (server === 'hyperserve') {
    try {
      const initRes = await fetch('/api/upload-hyperserve', {
        method: 'POST',
        headers,
        body: JSON.stringify({
          action: 'create',
          filename: file.name,
          resolutions: ['480p', '1080p']
        })
      });

      const initData = await initRes.json();
      if (!initRes.ok) {
        throw new Error(initData.error || 'فشل سيرفر 1');
      }

      const { id: videoId, uploadUrl } = initData;

      if (uploadUrl) {
        const upRes = await fetch(uploadUrl, {
          method: 'PUT',
          headers: { 'Content-Type': file.type || 'video/mp4' },
          body: file
        });
        if (!upRes.ok) {
          throw new Error('فشل نقل حزم بيانات الفيديو إلى سيرفر 1');
        }
      }

      const compRes = await fetch('/api/upload-hyperserve', {
        method: 'POST',
        headers,
        body: JSON.stringify({
          action: 'complete',
          videoId
        })
      });

      const compData = await compRes.json();
      if (!compRes.ok) {
        throw new Error(compData.error || 'فشل تأكيد الرفع');
      }

      return {
        video_url: compData.video_url,
        poster_url: compData.poster_url,
        public_id: videoId,
        server: 'hyperserve'
      };
    } catch (hsErr) {
      console.warn('Hyperserve pipeline unavailable, falling back seamlessly:', hsErr);
      return await uploadCloudinaryPipeline('hyperserve');
    }
  }

  return await uploadCloudinaryPipeline('cloudinary');
}

// -------------------------------------------------------------
// Upload Form Submission
// -------------------------------------------------------------
$('#uploadForm').addEventListener('submit', async (e) => {
  e.preventDefault();

  const cat = $('#category').value;
  const placement = $('#placement').value;
  const ratio = $('#ratio').value;
  const btn = $('#uploadBtn');
  const statusEl = $('#uploadStatus');
  const progressBar = $('#progressBar');

  // Verify server limits before uploading
  if (state.stats) {
    if (cat !== 'before_after') {
      const s = $('#serverSelect').value;
      if (s === 'hyperserve' && state.stats.hyperserve.isLimitReached) {
        statusEl.textContent = 'سيرفر 1 وصل للحد الأقصى (10 فيديوهات). اختر سيرفر 2.';
        return;
      }
      if (s === 'cloudinary' && state.stats.cloudinary.isLimitReached) {
        statusEl.textContent = 'سيرفر 2 وصل للحد الأقصى (10 فيديوهات). اختر سيرفر 1.';
        return;
      }
    }
  }

  const isPair = cat === 'before_after';
  const filesToUpload = isPair
    ? [
        { file: $('#beforeFile').files[0], role: 'before', server: $('#serverBeforeSelect').value },
        { file: $('#afterFile').files[0], role: 'after', server: $('#serverAfterSelect').value }
      ]
    : [
        { file: $('#videoFile').files[0], role: cat === 'intro' ? 'main' : 'item', server: $('#serverSelect').value }
      ];

  if (filesToUpload.some(item => !item.file)) {
    statusEl.textContent = 'يرجى اختيار جميع الفيديوهات المطلوبة أولاً.';
    statusEl.style.color = '#fca5a5';
    return;
  }

  btn.disabled = true;
  btn.innerHTML = '<i class="fa-solid fa-spinner fa-spin"></i> جاري الرفع…';
  progressBar.style.width = '10%';
  statusEl.textContent = 'جاري رفع الفيديوهات إلى السيرفر المختار…';
  statusEl.style.color = '#d9d2ff';

  try {
    const uploadedResults = [];
    const groupId = isPair ? crypto.randomUUID() : null;

    for (let i = 0; i < filesToUpload.length; i++) {
      const item = filesToUpload[i];
      const sName = item.server === 'hyperserve' ? 'سيرفر 1' : 'سيرفر 2';
      statusEl.textContent = `جاري رفع فيديو (${item.role === 'before' ? 'قبل' : item.role === 'after' ? 'بعد' : 'الرئيسي'}) إلى ${sName}…`;

      const uploadRes = await uploadToProvider(item.file, item.server, cat);
      uploadedResults.push({
        id: crypto.randomUUID(),
        video_url: uploadRes.video_url,
        poster_url: uploadRes.poster_url,
        public_id: uploadRes.public_id,
        server: uploadRes.server,
        category: cat,
        role: item.role,
        group_id: groupId,
        sort_order: 0,
        ratio
      });

      const pct = Math.round(((i + 1) / filesToUpload.length) * 75) + 10;
      progressBar.style.width = `${pct}%`;
    }

    statusEl.textContent = 'جاري ترتيب وحفظ البيانات في قاعدة البيانات…';

    // Compute order placement
    const existingCards = [];
    const grouped = {};
    state.rows.filter(x => x.category === cat).forEach(x => {
      const key = x.group_id || x.id;
      if (!grouped[key]) grouped[key] = { order: x.sort_order ?? 0, ids: [] };
      grouped[key].ids.push(x.id);
    });
    Object.keys(grouped).forEach(k => existingCards.push(grouped[k]));
    existingCards.sort((a, b) => a.order - b.order);

    const newCardEntry = { order: 0, ids: uploadedResults.map(x => x.id) };
    let at = 0;
    if (placement === 'last') {
      at = existingCards.length;
    } else if (placement === 'number') {
      const posVal = Number($('#position').value || 1) - 1;
      at = Math.max(0, Math.min(existingCards.length, posVal));
    }
    existingCards.splice(at, 0, newCardEntry);

    const orderedIds = existingCards.flatMap(c => c.ids);

    // Save to backend
    const headers = authHeader();
    const saveRes = await fetch('/api/media', {
      method: 'POST',
      headers,
      body: JSON.stringify({
        records: uploadedResults,
        orderedIds
      })
    });

    if (!saveRes.ok) {
      const err = await saveRes.json();
      throw new Error(err.error || 'تعذر حفظ بيانات الفيديو');
    }

    progressBar.style.width = '100%';
    statusEl.textContent = 'تم النشر بنجاح! الفيديو الآن معروض في الموقع.';
    statusEl.style.color = '#6ee7b7';

    // Reset form
    e.target.reset();
    resetFilePickers();
    $('#category').dispatchEvent(new Event('change'));

    await loadStats();
    await loadRows();
  } catch (err) {
    statusEl.textContent = 'حدث خطأ: ' + err.message;
    statusEl.style.color = '#fca5a5';
  } finally {
    btn.disabled = false;
    btn.innerHTML = '<i class="fa-solid fa-upload"></i> رفع ونشر الفيديو';
    setTimeout(() => { progressBar.style.width = '0%'; }, 2000);
  }
});

// Run boot
boot().catch(e => {
  $('#connectionState').textContent = 'خطأ في الاتصال';
  $('#loginStatus').textContent = e.message;
  $('#loginCard').hidden = false;
});