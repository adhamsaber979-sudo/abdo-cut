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
  reels: 'شبكة الريلز',
  before_after: 'قبل وبعد',
  promos: 'البروموهات',
  ads: 'الإعلانات',
  motion: 'الموشن جرافيك',
  intro: 'مقدمة الموقع'
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
  loadPricingSettings();
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

// Interactive Visual Site Layout Picker & Category Controller
function setupCategoryForm() {
  const categorySelect = $('#category');
  if (!categorySelect) return;

  function syncFormVisibility() {
    const val = categorySelect.value;
    const isPair = (val === 'reels_top' || val === 'reels_bottom' || val === 'before_after');

    if ($('#singleFile')) $('#singleFile').hidden = isPair;
    if ($('#pairFiles')) $('#pairFiles').hidden = !isPair;
    if ($('#singleServerWrap')) $('#singleServerWrap').hidden = isPair;
    if ($('#ratioWrap')) $('#ratioWrap').hidden = false;

    if ($('#videoFile')) $('#videoFile').required = !isPair;
    if ($('#beforeFile')) $('#beforeFile').required = isPair;
    if ($('#afterFile')) $('#afterFile').required = isPair;

    const ratioEl = $('#ratio');
    if (ratioEl && !ratioEl.dataset.userModified) {
      if (val === 'promos') {
        ratioEl.value = '16 / 9';
      } else if (val === 'reels_top' || val === 'reels' || val === 'reels_bottom' || val === 'ads') {
        ratioEl.value = '9 / 16';
      }
    }
  }

  if ($('#ratio')) {
    $('#ratio').addEventListener('change', () => {
      $('#ratio').dataset.userModified = 'true';
    });
  }

  categorySelect.addEventListener('change', syncFormVisibility);
  syncFormVisibility();
}

setupCategoryForm();

// Display file names on select with instant visual feedback, dimension detection, duration & video preview
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
      if (hint) hint.textContent = `الحجم: ${sizeMB} ميجابايت · جاري فحص ومعاينة الفيديو…`;

      if (video && wrap) {
        try {
          // Explicitly slice into video/mp4 Blob if MIME type is missing or generic (e.g. Android WhatsApp media)
          const videoBlob = (file.type && file.type.startsWith('video/'))
            ? file
            : file.slice(0, file.size, 'video/mp4');

          const blobUrl = URL.createObjectURL(videoBlob);
          video.muted = true;
          video.defaultMuted = true;
          video.playsInline = true;
          video.setAttribute('playsinline', '');
          video.setAttribute('webkit-playsinline', '');
          video.preload = 'auto';
          video.src = blobUrl;
          wrap.style.display = 'block';
          video.load();

          const handleMetadata = () => {
            const dur = video.duration;
            let durFormatted = '';
            if (dur && isFinite(dur) && dur > 0) {
              const mins = Math.floor(dur / 60);
              const secs = Math.floor(dur % 60).toString().padStart(2, '0');
              durFormatted = `${mins}:${secs}`;
              file._detectedDuration = durFormatted;
            }

            const w = video.videoWidth;
            const h = video.videoHeight;
            let rStr = '9 / 16';
            if (w && h) {
              rStr = `${w} / ${h}`;
              const numeric = w / h;
              if (Math.abs(numeric - 9 / 16) < 0.08) rStr = '9 / 16';
              else if (Math.abs(numeric - 16 / 9) < 0.08) rStr = '16 / 9';
              else if (Math.abs(numeric - 1.0) < 0.08) rStr = '1 / 1';
              else if (Math.abs(numeric - 4 / 5) < 0.08) rStr = '4 / 5';

              file._detectedRatio = rStr;
              file._detectedWidth = w;
              file._detectedHeight = h;
            }

            // Seek slightly forward so mobile browsers decode and render the first frame (prevents black screen!)
            try {
              if (video.currentTime === 0) {
                video.currentTime = 0.05;
              }
            } catch (x) {}

            const durationText = durFormatted ? `⏱️ المدة: ${durFormatted} دقيقة` : '⏱️ تم التعرف على الفيديو';
            const dimText = (w && h) ? `📐 الأبعاد: ${w}×${h} (${rStr})` : '';
            const sizeText = `💾 الحجم: ${sizeMB} ميجابايت`;
            if (hint) {
              hint.textContent = [durationText, dimText, sizeText].filter(Boolean).join(' · ') + ' · جاهز للرفع الفوري';
            }
          };

          video.onloadedmetadata = handleMetadata;
          video.onloadeddata = () => {
            try {
              if (video.currentTime === 0) video.currentTime = 0.05;
            } catch (x) {}
          };
          video.onerror = () => {
            if (hint) hint.textContent = `💾 الحجم: ${sizeMB} ميجابايت · جاهز للرفع الفوري`;
          };
        } catch (x) {
          if (hint) hint.textContent = `💾 الحجم: ${sizeMB} ميجابايت · جاهز للرفع الفوري`;
        }
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

  if ($('#singleFileHint')) $('#singleFileHint').textContent = 'جميع الصيغ والأحجام مدعومة (MP4, MOV, WebM, MKV...) بأي دقة ومساحة';
  if ($('#beforeFileHint')) $('#beforeFileHint').textContent = 'النسخة الخام قبل التعديل (أي صيغة أو مساحة)';
  if ($('#afterFileHint')) $('#afterFileHint').textContent = 'النسخة النهائية بعد التعديل والتلوين (أي صيغة أو مساحة)';

  ['#singlePreview', '#beforePreview', '#afterPreview'].forEach(id => {
    const v = $(id);
    if (v) { v.pause(); v.src = ''; }
  });
  ['#singlePreviewWrap', '#beforePreviewWrap', '#afterPreviewWrap'].forEach(id => {
    const w = $(id);
    if (w) w.style.display = 'none';
  });
}

setupFilePicker('#videoFile', '#singleFileBox', '#singleFileIcon', '#singleFileName', '#singleFileHint', '#singlePreviewWrap', '#singlePreview', 'اختر ملف الفيديو من جهازك', 'جميع الصيغ والأحجام مدعومة (MP4, MOV, WebM, MKV...) بأي دقة ومساحة');
setupFilePicker('#beforeFile', '#beforeFileBox', '#beforeFileIcon', '#beforeFileName', '#beforeFileHint', '#beforePreviewWrap', '#beforePreview', 'فيديو قبل (Raw Footage)', 'النسخة الخام قبل التعديل (أي صيغة أو مساحة)');
setupFilePicker('#afterFile', '#afterFileBox', '#afterFileIcon', '#afterFileName', '#afterFileHint', '#afterPreviewWrap', '#afterPreview', 'فيديو بعد (Final Edited)', 'النسخة النهائية بعد التعديل والتلوين (أي صيغة أو مساحة)');

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
      $('#hsBadge').textContent = 'ممتلئ (15/15)';
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
      $('#cldBadge').textContent = 'ممتلئ (15/15)';
      $('#cldBadge').className = 'server-badge limit';
    } else {
      $('#cldMeter').classList.remove('full');
      $('#cldBadge').textContent = cld.configured ? 'متصل' : 'جاهز للربط';
      $('#cldBadge').className = 'server-badge' + (cld.configured ? '' : ' unconfigured');
    }
    if (cld.storage) $('#cldStorage').textContent = cld.storage;
    if (cld.bandwidth) $('#cldBandwidth').textContent = cld.bandwidth;

    // Update upload select options based on 15 videos limit
    updateServerDropdowns(hs.isLimitReached, cld.isLimitReached);

    // Limit warning banner
    const alertBox = $('#limitAlertBox');
    const alertText = $('#limitAlertText');
    if (hs.isLimitReached && cld.isLimitReached) {
      alertBox.hidden = false;
      alertText.textContent = 'وصل كلا السيرفرين (سيرفر 1 وسيرفر 2) للحد الأقصى (15 فيديو لكل سيرفر). يرجى حذف فيديوهات غير مستخدمة من القائمة بالأسفل لإتاحة الرفع مجدداً.';
      $('#uploadBtn').disabled = true;
    } else if (hs.isLimitReached) {
      alertBox.hidden = false;
      alertText.textContent = 'وصل سيرفر 1 للحد الأقصى التنظيمي (15 فيديو). تم إيقاف الرفع عليه مؤقتاً وتوجيه الرفع لسيرفر 2.';
      $('#uploadBtn').disabled = false;
    } else if (cld.isLimitReached) {
      alertBox.hidden = false;
      alertText.textContent = 'وصل سيرفر 2 للحد الأقصى التنظيمي (15 فيديو). تم إيقاف الرفع عليه مؤقتاً وتوجيه الرفع لسيرفر 1.';
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
      optHs.textContent = hsFull ? 'سيرفر 1 (ممتلئ - 15/15)' : 'سيرفر 1';
    }
    if (optCld) {
      optCld.disabled = cldFull;
      optCld.textContent = cldFull ? 'سيرفر 2 (ممتلئ - 15/15)' : 'سيرفر 2';
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
      const firstRow = card.rows[0];
      const isFeatured = firstRow.role === 'featured' || firstRow.role === 'main' || firstRow.category === 'intro';
      const isPair = card.rows.length > 1 || firstRow.role === 'before' || firstRow.role === 'after' || firstRow.category === 'before_after';

      const titleRow = document.createElement('div');
      titleRow.style.display = 'flex';
      titleRow.style.alignItems = 'center';
      titleRow.style.flexWrap = 'wrap';
      titleRow.style.gap = '6px';

      const name = document.createElement('b');
      name.textContent = isPair ? 'مقارنة قبل وبعد (سلايدر فريم بفريم)' : (CATEGORIES[category] || category);

      // Distinct Visual Placement Badge
      const placementBadge = document.createElement('span');
      if (isFeatured || firstRow.category === 'reels_top') {
        placementBadge.className = 'badge-placement badge-placement-big';
        placementBadge.innerHTML = '<i class="fa-solid fa-crown"></i> 🌟 ريلز: قبل وبعد في الأعلى';
      } else if (category === 'before_after' || isPair) {
        placementBadge.className = 'badge-placement badge-placement-beforeafter';
        placementBadge.innerHTML = '<i class="fa-solid fa-arrows-left-right"></i> ⚖️ ريلز: قبل وبعد في الأسفل';
      } else if (category === 'reels') {
        placementBadge.className = 'badge-placement badge-placement-reels';
        placementBadge.innerHTML = `<i class="fa-solid fa-mobile-screen"></i> 📱 ريلز: شبكة الريلز (كارت #${index + 1})`;
      } else {
        placementBadge.className = 'badge-placement badge-placement-other';
        placementBadge.innerHTML = `<i class="fa-solid fa-film"></i> ${CATEGORIES[category] || category}`;
      }

      titleRow.append(name, placementBadge);

      // Server Badges
      const badgesWrap = document.createElement('span');
      card.rows.forEach(r => {
        const b = document.createElement('span');
        b.className = `badge-server badge-${r.server || 'cloudinary'}`;
        const sName = (r.server || 'cloudinary') === 'hyperserve' ? 'سيرفر 1' : 'سيرفر 2';
        b.textContent = isPair ? `${r.role === 'before' ? 'قبل' : 'بعد'}: ${sName}` : sName;
        badgesWrap.appendChild(b);
      });

      const small = document.createElement('small');
      const dateStr = card.rows[0]?.created_at
        ? new Date(card.rows[0].created_at).toLocaleDateString('ar-EG')
        : 'اليوم';
      small.textContent = `الترتيب بالقسم: #${index + 1} · تاريخ الإضافة: ${dateStr}`;

      // Quick 1-Click Placement Change Buttons
      const quickBtns = document.createElement('div');
      quickBtns.style.display = 'flex';
      quickBtns.style.gap = '6px';
      quickBtns.style.marginTop = '6px';
      quickBtns.style.flexWrap = 'wrap';

      if (category === 'reels' || category === 'before_after' || category === 'reels_top') {
        if (!isFeatured) {
          const toTopBtn = document.createElement('button');
          toTopBtn.type = 'button';
          toTopBtn.className = 'quick-switch-btn featured';
          toTopBtn.innerHTML = '<i class="fa-solid fa-crown"></i> 🌟 انقله لـ (قبل وبعد في الأعلى)';
          toTopBtn.addEventListener('click', () => changeCardPlacement(firstRow.id, 'reels', 'featured'));
          quickBtns.appendChild(toTopBtn);
        }
        if (isPair && category !== 'before_after') {
          const toBottomBtn = document.createElement('button');
          toBottomBtn.type = 'button';
          toBottomBtn.className = 'quick-switch-btn';
          toBottomBtn.innerHTML = '<i class="fa-solid fa-arrows-left-right"></i> ⚖️ انقله لـ (قبل وبعد في الأسفل)';
          toBottomBtn.addEventListener('click', () => changeCardPlacement(firstRow.id, 'before_after', 'before'));
          quickBtns.appendChild(toBottomBtn);
        }
        if (!isPair || isFeatured) {
          const toGridBtn = document.createElement('button');
          toGridBtn.type = 'button';
          toGridBtn.className = 'quick-switch-btn';
          toGridBtn.innerHTML = '<i class="fa-solid fa-mobile-screen"></i> 📱 انقله لـ (شبكة الريلز)';
          toGridBtn.addEventListener('click', () => changeCardPlacement(firstRow.id, 'reels', 'item'));
          quickBtns.appendChild(toGridBtn);
        }
      }

      info.append(titleRow, badgesWrap, small, quickBtns);

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

async function changeCardPlacement(id, category, role) {
  try {
    const headers = authHeader();
    const res = await fetch('/api/media', {
      method: 'PATCH',
      headers,
      body: JSON.stringify({
        action: 'update_placement',
        id,
        category,
        role
      })
    });
    if (!res.ok) {
      const err = await res.json();
      throw new Error(err.error || 'تعذر تحديث مكان الفيديو');
    }
    await loadStats();
    await loadRows();
  } catch (e) {
    alert('حدث خطأ: ' + e.message);
  }
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
async function uploadToProvider(file, server, category, roleLabel, onProgress) {
  const headers = authHeader();

  function uploadViaXhr(sigData, assignedServer) {
    return new Promise((resolve, reject) => {
      // Normalize Blob MIME type so mobile decoders and storage APIs accept it cleanly
      const uploadBlob = (file.type && file.type.startsWith('video/'))
        ? file
        : file.slice(0, file.size, 'video/mp4');

      let safeName = file.name || 'video.mp4';
      if (!/\.(mp4|mov|webm|mkv|avi|m4v|3gp|flv)$/i.test(safeName)) {
        safeName += '.mp4';
      }

      const fd = new FormData();
      fd.append('file', uploadBlob, safeName);
      fd.append('api_key', sigData.api_key);
      fd.append('timestamp', sigData.timestamp);
      fd.append('folder', sigData.folder);
      fd.append('signature', sigData.signature);

      const xhr = new XMLHttpRequest();
      xhr.open('POST', `https://api.cloudinary.com/v1_1/${sigData.cloud_name}/video/upload`);
      xhr.timeout = 300000; // 5 minutes max for high-resolution video uploads

      xhr.upload.onprogress = (evt) => {
        if (evt.lengthComputable && onProgress) {
          const pct = Math.round((evt.loaded / evt.total) * 100);
          onProgress(pct, evt.loaded, evt.total);
        }
      };

      xhr.onload = () => {
        if (xhr.status >= 200 && xhr.status < 300) {
          try {
            const asset = JSON.parse(xhr.responseText);
            let poster = asset.secure_url.replace('/upload/', '/upload/so_0/');
            if (asset.format) {
              poster = poster.replace(new RegExp(`\\.${asset.format}(\\?.*)?$`, 'i'), '.jpg');
            } else {
              poster = poster.replace(/\.[a-z0-9]+(\?.*)?$/i, '.jpg');
            }

            let detectedRatio = null;
            if (asset.width && asset.height) {
              const numeric = asset.width / asset.height;
              if (Math.abs(numeric - 9 / 16) < 0.08) detectedRatio = '9 / 16';
              else if (Math.abs(numeric - 16 / 9) < 0.08) detectedRatio = '16 / 9';
              else if (Math.abs(numeric - 1.0) < 0.08) detectedRatio = '1 / 1';
              else if (Math.abs(numeric - 4 / 5) < 0.08) detectedRatio = '4 / 5';
              else detectedRatio = `${asset.width} / ${asset.height}`;
            }

            resolve({
              video_url: asset.secure_url,
              poster_url: poster,
              public_id: asset.public_id,
              server: assignedServer || 'cloudinary',
              detected_ratio: detectedRatio
            });
          } catch (e) {
            reject(new Error('استجابة غير صحيحة من سيرفر التخزين'));
          }
        } else {
          let msg = `خطأ في سيرفر التخزين (${xhr.status})`;
          try {
            const errJson = JSON.parse(xhr.responseText);
            if (errJson.error && errJson.error.message) {
              msg = errJson.error.message;
            }
          } catch (x) {}
          reject(new Error(msg));
        }
      };

      xhr.onerror = () => {
        reject(new Error('انقطع الاتصال بسيرفر التخزين أثناء الرفع. تحقق من اتصال الإنترنت وحاول مجدداً.'));
      };

      xhr.ontimeout = () => {
        reject(new Error('استغرق رفع الفيديو وقتاً طويلاً وانتهت المهلة. يرجى التحقق من سرعة الإنترنت.'));
      };

      xhr.send(fd);
    });
  }

  async function uploadCloudinaryPipeline(assignedServer) {
    const sigRes = await fetch('/api/sign-upload', {
      method: 'POST',
      headers,
      body: JSON.stringify({ category })
    });

    if (!sigRes.ok) {
      let errText = 'فشل تجهيز عملية الرفع على سيرفر التخزين';
      try {
        const errData = await sigRes.json();
        errText = errData.error || errText;
      } catch (x) {}
      throw new Error(errText);
    }

    const sigData = await sigRes.json();
    return await uploadViaXhr(sigData, assignedServer);
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
      console.warn('Hyperserve pipeline unavailable, falling back seamlessly to Cloudinary:', hsErr);
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

  const catVal = $('#category').value;
  const isTop = catVal === 'reels_top';
  const isBottom = catVal === 'reels_bottom' || catVal === 'before_after';
  const isPair = isTop || isBottom;
  const isBig = isTop;

  let actualCat = catVal;
  if (isTop) actualCat = 'reels';
  if (isBottom) actualCat = 'before_after';

  const placement = $('#placement').value;
  const userRatio = $('#ratio') ? $('#ratio').value : 'auto';
  const btn = $('#uploadBtn');
  const statusEl = $('#uploadStatus');
  const progressBar = $('#progressBar');

  // Verify server limits before uploading
  if (state.stats) {
    if (!isPair) {
      const s = $('#serverSelect').value;
      if (s === 'hyperserve' && state.stats.hyperserve.isLimitReached) {
        statusEl.textContent = 'سيرفر 1 وصل للحد الأقصى (15 فيديو). اختر سيرفر 2.';
        return;
      }
      if (s === 'cloudinary' && state.stats.cloudinary.isLimitReached) {
        statusEl.textContent = 'سيرفر 2 وصل للحد الأقصى (15 فيديو). اختر سيرفر 1.';
        return;
      }
    }
  }

  const filesToUpload = isPair
    ? [
        { file: $('#beforeFile').files[0], role: isTop ? 'featured' : 'before', server: $('#serverBeforeSelect').value },
        { file: $('#afterFile').files[0], role: 'after', server: $('#serverAfterSelect').value }
      ]
    : [
        { file: $('#videoFile').files[0], role: 'item', server: $('#serverSelect').value }
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
      let roleLabel = 'الرئيسي';
      if (item.role === 'before') roleLabel = 'قبل';
      else if (item.role === 'after') roleLabel = 'بعد';
      else if (item.role === 'featured' || isBig) roleLabel = 'المميز في الأعلى';

      statusEl.textContent = `جاري تجهيز رفع فيديو (${roleLabel}) إلى ${sName}…`;

      const onProgress = (filePct, loadedBytes, totalBytes) => {
        const loadedMB = (loadedBytes / (1024 * 1024)).toFixed(1);
        const totalMB = (totalBytes / (1024 * 1024)).toFixed(1);
        const basePct = (i / filesToUpload.length) * 80 + 10;
        const currentContrib = (filePct / 100) * (80 / filesToUpload.length);
        const totalPct = Math.min(95, Math.round(basePct + currentContrib));

        progressBar.style.width = `${totalPct}%`;
        statusEl.textContent = `جاري رفع فيديو (${roleLabel}) إلى ${sName}: ${filePct}% (${loadedMB} / ${totalMB} ميجابايت)…`;
      };

      const uploadRes = await uploadToProvider(item.file, item.server, actualCat, roleLabel, onProgress);

      // Determine final ratio
      let finalRatio = userRatio;
      if (finalRatio === 'auto' || !finalRatio) {
        finalRatio = uploadRes.detected_ratio || (item.file && item.file._detectedRatio) || (actualCat === 'promos' ? '16 / 9' : '9 / 16');
      }

      uploadedResults.push({
        id: crypto.randomUUID(),
        video_url: uploadRes.video_url,
        poster_url: uploadRes.poster_url,
        public_id: uploadRes.public_id,
        server: uploadRes.server,
        category: actualCat,
        role: item.role,
        group_id: groupId,
        sort_order: 0,
        ratio: finalRatio
      });

      const pct = Math.round(((i + 1) / filesToUpload.length) * 80) + 10;
      progressBar.style.width = `${pct}%`;
    }

    statusEl.textContent = 'جاري ترتيب وحفظ البيانات في قاعدة البيانات…';

    // Compute order placement
    const existingCards = [];
    const grouped = {};
    state.rows.filter(x => x.category === actualCat).forEach(x => {
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

// -------------------------------------------------------------
// Category Pricing Management
// -------------------------------------------------------------
async function loadPricingSettings() {
  try {
    const res = await fetch('/api/settings');
    if (!res.ok) return;
    const data = await res.json();
    if (data && data.settings && data.settings.pricing) {
      const p = data.settings.pricing;
      ['reels', 'promos', 'ads', 'motion'].forEach(cat => {
        if (p[cat]) {
          if ($(`#price_${cat}`)) $(`#price_${cat}`).value = p[cat].price || '';
          if ($(`#per_${cat}`)) $(`#per_${cat}`).value = p[cat].per || '';
          if ($(`#order_${cat}`)) $(`#order_${cat}`).value = p[cat].order || '';
          updatePricingPreview(cat);
        }
      });
    }
  } catch (err) {
    console.warn('Could not load pricing settings:', err);
  }
}

function updatePricingPreview(cat) {
  const pr = $(`#price_${cat}`) ? $(`#price_${cat}`).value.trim() : '';
  const pe = $(`#per_${cat}`) ? $(`#per_${cat}`).value.trim() : '';
  const prevEl = $(`#prev_${cat}`);
  if (prevEl) {
    prevEl.textContent = pr && pe ? `${pr} ${pe}` : (pr || pe || 'السعر غير محدد');
  }
}

// Live preview listeners
['reels', 'promos', 'ads', 'motion'].forEach(cat => {
  const prEl = $(`#price_${cat}`);
  const peEl = $(`#per_${cat}`);
  if (prEl) prEl.addEventListener('input', () => updatePricingPreview(cat));
  if (peEl) peEl.addEventListener('input', () => updatePricingPreview(cat));
});

// Pricing form submit
if ($('#pricingForm')) {
  $('#pricingForm').addEventListener('submit', async (e) => {
    e.preventDefault();
    const btn = $('#savePricesBtn');
    const statusEl = $('#pricingStatus');

    btn.disabled = true;
    btn.innerHTML = '<i class="fa-solid fa-spinner fa-spin"></i> جاري الحفظ…';
    statusEl.textContent = '';

    const pricing = {
      reels: {
        price: $('#price_reels').value.trim(),
        per: $('#per_reels').value.trim(),
        order: $('#order_reels').value.trim(),
        orderText: 'عايز أطلب ' + ($('#order_reels').value.trim() || 'ريل')
      },
      promos: {
        price: $('#price_promos').value.trim(),
        per: $('#per_promos').value.trim(),
        order: $('#order_promos').value.trim(),
        orderText: 'عايز أطلب ' + ($('#order_promos').value.trim() || 'برومو')
      },
      ads: {
        price: $('#price_ads').value.trim(),
        per: $('#per_ads').value.trim(),
        order: $('#order_ads').value.trim(),
        orderText: 'عايز أطلب ' + ($('#order_ads').value.trim() || 'إعلان')
      },
      motion: {
        price: $('#price_motion').value.trim(),
        per: $('#per_motion').value.trim(),
        order: $('#order_motion').value.trim(),
        orderText: 'عايز أطلب ' + ($('#order_motion').value.trim() || 'فيديو موشن')
      }
    };

    try {
      const res = await fetch('/api/settings', {
        method: 'POST',
        headers: authHeader(),
        body: JSON.stringify({ pricing })
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error || 'فشل حفظ الأسعار');

      statusEl.textContent = 'تم حفظ أسعار الأقسام بنجاح! تم تحديث الموقع.';
      statusEl.style.color = '#6ee7b7';
      setTimeout(() => { statusEl.textContent = ''; }, 4000);
    } catch (err) {
      statusEl.textContent = 'خطأ: ' + err.message;
      statusEl.style.color = '#fca5a5';
    } finally {
      btn.disabled = false;
      btn.innerHTML = '<i class="fa-solid fa-floppy-disk"></i> حفظ وتحديث أسعار الأقسام';
    }
  });
}

// Run boot
boot().catch(e => {
  $('#connectionState').textContent = 'خطأ في الاتصال';
  $('#loginStatus').textContent = e.message;
  $('#loginCard').hidden = false;
});