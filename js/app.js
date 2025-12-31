(() => {
  const $ = (q, r=document) => r.querySelector(q);
  const $$ = (q, r=document) => Array.from(r.querySelectorAll(q));

  const state = { lang: localStorage.getItem('lang') || 'ru', slide: 0 };

  const setText = () => {
    document.documentElement.lang = state.lang;
    $$('[data-i18n]').forEach(el => {
      const k = el.getAttribute('data-i18n');
      const v = window.I18N?.[state.lang]?.[k];
      if (typeof v === 'string') el.textContent = v.replace(/\\n/g, "\n");
    });
    $('#brandName').textContent = window.I18N[state.lang].brand_name.replace(/\\n/g, "\n");
    $('#brandTag').textContent = window.I18N[state.lang].brand_tag.replace(/\\n/g, "\n");

    $$('[data-lang]').forEach(btn => btn.classList.toggle('active', btn.dataset.lang === state.lang));
  };

  const setLang = (lang) => {
    state.lang = lang;
    localStorage.setItem('lang', lang);
    setText();
  };

  document.addEventListener('click', (e) => {
    const b = e.target.closest('[data-lang]');
    if (b) setLang(b.dataset.lang);
  });

  // Carousel (optional: exists only on the home page)
let go = null;

const track = $('#abilityTrack');
const dots = $('#abilityDots');
const carousel = $('#abilityCarousel');
const prevBtn = $('#prevSlide');
const nextBtn = $('#nextSlide');

if (track && dots) {
  const slides = $$('.slide', track);

  // Make ability slides clickable when data-href is provided
  slides.forEach((s) => {
    const href = s.getAttribute('data-href');
    if (!href) return;
    s.setAttribute('role', 'link');
    s.setAttribute('tabindex', '0');
    s.style.cursor = 'pointer';
    const open = () => { window.location.href = href; };
    s.addEventListener('click', open);
    s.addEventListener('keydown', (e) => {
      if (e.key === 'Enter' || e.key === ' ') {
        e.preventDefault();
        open();
      }
    });
  });

  const renderDots = () => {
    dots.innerHTML = '';
    slides.forEach((_, i) => {
      const d = document.createElement('button');
      d.className = 'dot' + (i === state.slide ? ' active' : '');
      d.addEventListener('click', () => go && go(i));
      dots.appendChild(d);
    });
  };

  go = (i) => {
    state.slide = (i + slides.length) % slides.length;
    track.style.transform = `translateX(${-state.slide * 100}%)`;
    renderDots();
  };

  if (prevBtn) prevBtn.addEventListener('click', () => go && go(state.slide - 1));
  if (nextBtn) nextBtn.addEventListener('click', () => go && go(state.slide + 1));

  let timer = null;
  const startTimer = () => {
    if (timer || slides.length <= 1) return;
    timer = setInterval(() => go && go(state.slide + 1), 7000);
  };
  const stopTimer = () => { if (timer) { clearInterval(timer); timer = null; } };

  // autoplay
  startTimer();
  setTimeout(() => { if (!timer && !document.hidden) startTimer(); }, 50);
  document.addEventListener('visibilitychange', () => { if (!document.hidden) startTimer(); });

  if (carousel) {
    ['mouseenter','focusin'].forEach(evt => carousel.addEventListener(evt, stopTimer));
    ['mouseleave','focusout'].forEach(evt => carousel.addEventListener(evt, startTimer));
  }
}

// Chat (demo)
  const fab = $('#chatFab');
  const panel = $('#chatPanel');
  const closeBtn = $('#chatClose');
  const input = $('#chatInput');
  const send = $('#chatSend');
  const body = $('#chatBody');

  // Some pages (e.g., tours) may not include the chat widget. Guard everything.
  const openChat = (open) => {
    if (!panel) return;
    panel.classList.toggle('open', open);
    if (open && input) setTimeout(() => input.focus(), 120);
  };

  // Buttons on tour pages: open chat (if the panel exists)
  if (panel) {
    $$('[data-open-chat]').forEach(btn =>
      btn.addEventListener('click', () => openChat(true))
    );
  }

  if (fab && panel) {
    fab.addEventListener('click', () => openChat(!panel.classList.contains('open')));
  }

  if (closeBtn) {
    closeBtn.addEventListener('click', () => openChat(false));
  }

  const addMsg = (who, text) => {
    if (!body) return;
    const d = document.createElement('div');
    d.className = 'msg ' + who;
    d.textContent = text;
    body.appendChild(d);
    body.scrollTop = body.scrollHeight;
  };

  // Web-chat -> n8n integration (falls back to demo mode if config is missing)
  const cfg = window.N8N_CONFIG || null;
  const hasWebhooks = Boolean(cfg && typeof cfg.sendUrl === 'string' && typeof cfg.pollUrl === 'string');

  const getOrMakeId = (key, makeFn) => {
    try {
      const v = localStorage.getItem(key);
      if (v) return v;
      const nv = makeFn();
      localStorage.setItem(key, nv);
      return nv;
    } catch (_) {
      return makeFn();
    }
  };

  const makeId = (prefix) => {
    const rnd = Math.random().toString(16).slice(2);
    const ts = Date.now().toString(16);
    return `${prefix}${ts}-${rnd}`;
  };

  const chatUserId = getOrMakeId('webchat_user_id', () => makeId('w'));
  const conversationId = getOrMakeId('webchat_conversation_id', () => makeId('c'));

  let cursor = 0;
  try { cursor = Number(localStorage.getItem('webchat_cursor') || 0) || 0; } catch (_) {}

  const saveCursor = (v) => {
    cursor = v;
    try { localStorage.setItem('webchat_cursor', String(v)); } catch (_) {}
  };


const loadSeen = () => {
  try {
    const raw = localStorage.getItem('webchat_seen_ids');
    const arr = raw ? JSON.parse(raw) : [];
    return new Set(Array.isArray(arr) ? arr : []);
  } catch (_) {
    return new Set();
  }
};

const saveSeen = (set) => {
  try {
    // Keep only last 200 to avoid storage bloat
    const arr = Array.from(set).slice(-200);
    localStorage.setItem('webchat_seen_ids', JSON.stringify(arr));
  } catch (_) {}
};

const makeMsgKey = (m) => {
  const id = m.id ?? m.messageId ?? m.message_id ?? '';
  const ts = getTs(m) || '';
  const txt = String(getText(m) || '').slice(0, 200);
  const role = (m.role || m.who || m.senderType || m.type || '').toString();
  return `${id}|${ts}|${role}|${txt}`;
};

let seen = loadSeen();

  const coerceMessages = (payload) => {
  // Accept: array, {messages:[]}, {items:[]}, {data:[]}, {data:{messages:[]}}, or a single message object
  if (!payload) return [];
  if (Array.isArray(payload)) return payload;
  if (Array.isArray(payload.messages)) return payload.messages;
  if (Array.isArray(payload.items)) return payload.items;
  if (Array.isArray(payload.data)) return payload.data;
  if (payload.data && Array.isArray(payload.data.messages)) return payload.data.messages;
  if (payload.data && Array.isArray(payload.data.items)) return payload.data.items;
  return [payload];
};

  const isMine = (m) => {
  // Determine whether a message is authored by the web-chat user.
  // We prioritize explicit role/sender fields over IDs to avoid filtering bot replies that may carry the same userId.
  const role = (m.role || m.who || m.senderType || m.type || m.author || m.fromType || '').toString().toLowerCase();
  if (['bot','assistant','agent','system','operator'].includes(role)) return false;
  if (['me','user','client','customer','guest'].includes(role)) return true;

  const uid = m.userId || m.user_id || m.fromUserId || m.from_user_id;
  if (uid == null) return false;
  return String(uid) === String(chatUserId);
};

  const getText = (m) => m.text || m.message || m.content || m.reply || '';

  const getTs = (m) => {
  // Prefer explicit numeric timestamps; otherwise parse ISO dates; otherwise fall back to numeric IDs.
  const raw = m.ts ?? m.time ?? m.timestamp ?? m.createdAt ?? m.created_at ?? m.date ?? m.sentAt ?? m.sent_at ?? 0;

  if (typeof raw === 'number') return raw;
  if (typeof raw === 'string') {
    // numeric string?
    const n = Number(raw);
    if (Number.isFinite(n) && raw.trim() !== '') return n;
    // ISO date?
    const p = Date.parse(raw);
    if (!Number.isNaN(p)) return p;
  }

  const idRaw = m.id ?? m.messageId ?? m.message_id ?? m.eventId ?? m.event_id ?? 0;
  const idNum = Number(idRaw);
  return Number.isFinite(idNum) ? idNum : 0;
};

  const pollOnce = async () => {
    if (!hasWebhooks || !panel) return;
    try {
      const u = new URL(cfg.pollUrl);
      u.searchParams.set('conversationId', conversationId);
      u.searchParams.set('userId', chatUserId);
      if (cursor) u.searchParams.set('after', String(cursor));

      const res = await fetch(u.toString(), { method: 'GET' });
      if (!res.ok) return;
      let payload = await res.json().catch(() => null);
if (payload == null) {
  const t = await res.text().catch(() => '');
  if (t) payload = { text: t };
}
      const msgs = coerceMessages(payload);
      let maxTs = cursor;

      msgs.forEach((m) => {
  if (!m) return;

  const text = String(getText(m) || '').trim();
  if (!text) return;

  const key = makeMsgKey(m);
  if (seen.has(key)) return;

  const ts = getTs(m);
  if (ts && ts > maxTs) maxTs = ts;

  // Only render messages that are not authored by the web-chat user.
  if (!isMine(m)) addMsg('bot', text);

  seen.add(key);
});

saveSeen(seen);

      if (maxTs > cursor) saveCursor(maxTs);
    } catch (_) {
      // ignore polling errors
    }
  };

  let pollTimer = null;
  const startPolling = () => {
    if (!hasWebhooks || !panel) return;
    if (pollTimer) return;
    pollOnce();
    pollTimer = setInterval(pollOnce, Number(cfg.pollIntervalMs) || 2500);
  };

  const handleSend = async () => {
    if (!input) return;
    const text = input.value.trim();
    if (!text) return;

    addMsg('me', text);
    input.value = '';

    if (!hasWebhooks) {
      // Demo response
      setTimeout(() => addMsg('bot', window.I18N?.[state.lang]?.chat_demo_reply || 'Thanks!'), 500);
      return;
    }

    if (send) send.disabled = true;

    try {
      const bodyPayload = {
        channel: 'webchat',
        userId: chatUserId,
        conversationId,
        lang: state.lang,
        text,
        page: location.href
      };

      const res = await fetch(cfg.sendUrl, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(bodyPayload)
      });

      // Some flows return an immediate reply payload
      let payload = await res.json().catch(() => null);
if (payload == null) {
  const t = await res.text().catch(() => '');
  if (t) payload = { text: t };
}
      const msgs = coerceMessages(payload);
      let maxTs = cursor;
      msgs.forEach((m) => {
  if (!m) return;
  const t = String(getText(m) || '').trim();
  if (!t) return;

  const key = makeMsgKey(m);
  if (seen.has(key)) return;

  const ts = getTs(m);
  if (ts && ts > maxTs) maxTs = ts;

  if (!isMine(m)) addMsg('bot', t);

  seen.add(key);
});

saveSeen(seen);
if (maxTs > cursor) saveCursor(maxTs);

      // ensure polling is running (so replies come in)
      startPolling();
    } catch (_) {
      addMsg('bot', window.I18N?.[state.lang]?.chat_error_reply || '⚠️ Message was not delivered. Please try again.');
    } finally {
      if (send) send.disabled = false;
    }
  };

  // Start polling once the widget exists
  startPolling();

  if (send) send.addEventListener('click', handleSend);
  if (input) input.addEventListener('keydown', (e) => { if (e.key === 'Enter') handleSend(); });
// Init
  setText();
  if (typeof go === 'function') go(0);
})();
