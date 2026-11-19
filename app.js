'use strict';

/* =========================================================
 * 設定：填入 Firebase 專案資訊即可啟用雲端（見 README.md）
 * 留空 = 只在本機運作，並顯示示範食譜
 * ========================================================= */

//const CLOUD = { projectId: '', apiKey: '' };
const CLOUD = { projectId: 'mycookbook-13356', apiKey: 'AIzaSyCFRgS08zBz45Ho_DekodxFl7g_DfiwPXE' };
const CLOUD_ON = !!(CLOUD.projectId && CLOUD.apiKey);

const UNITS = ['克', '公斤', '毫升', '公升', '杯', '大匙', '小匙', '匙', '個', '顆', '片', '段', '瓣', '條', '適量'];
const LS_KEY = 'recipe_app_mine_v1';

/* ---------- 標籤分類（顏色在 style.css 的 .c-xxx 設定） ---------- */
const CATS = [['meat', '肉類'], ['veg', '菜類'], ['fruit', '水果'], ['starch', '澱粉類'], ['mushroom', '菇類'], ['sauce', '醬類'], ['season', '調味'], ['soup', '湯']];
const CAT_NAME = { ...Object.fromEntries(CATS), other: '其他' };
// 比對順序很重要：越前面越優先（例如「雞湯」要算湯、「醬油」要算醬類、「米酒」要算調味）
const MATCH_ORDER = ['soup', 'sauce', 'season', 'mushroom', 'fruit', 'starch', 'meat', 'veg'];
const KEYWORDS = {
  soup: ['湯', '火鍋', '水'],
  sauce: ['醬', '蠔油', '露', '味噌', '豆瓣', '沙茶', '咖哩', '辣油', '麻油', '香油', '醋', '美乃滋', '蜂蜜'],
  season: ['鹽', '糖', '胡椒', '花椒', '味精', '雞粉', '太白粉', '辣椒粉', '孜然', '香料', '奶油', '起司', '牛奶', '鮮奶', '酒', '油'],
  mushroom: ['菇', '木耳', '蕈'],
  fruit: ['水果', '蘋果', '香蕉', '檸檬', '柳橙', '橙', '莓', '芒果', '鳳梨', '葡萄', '梨', '桃', '西瓜', '柚', '柑', '奇異果', '酪梨', '椰', '荔枝', '龍眼', '木瓜', '櫻桃'],
  starch: ['飯', '米', '麵', '吐司', '薯', '地瓜', '芋', '年糕', '冬粉', '粉', '粿', '餃', '餛飩', '饅頭', '麥', '粥', '義大利', '貝果', '餅'],
  meat: ['肉', '雞', '豬', '牛', '羊', '鴨', '鵝', '火腿', '培根', '香腸', '臘', '排骨', '絞', '蝦', '魚', '鮭', '鮪', '透抽', '花枝', '魷', '蛤', '蚵', '蟹', '干貝', '海鮮', '蛋', '豆腐', '豆干', '豆皮'],
  veg: ['菜', '蔥', '蒜', '薑', '青椒', '辣椒', '甜椒', '彩椒', '番茄', '蘿蔔', '花椰', '芹', '瓜', '茄', '筍', '豆芽', '韭', '香菜', '九層塔', '玉米', '萵苣', '蘆筍', '秋葵', '四季豆', '豌豆'],
};
const catCache = new Map();
function catOf(tag) {
  if (!catCache.has(tag)) {
    catCache.set(tag, MATCH_ORDER.find((id) => KEYWORDS[id].some((k) => tag.includes(k))) || 'other');
  }
  return catCache.get(tag);
}

// 搜尋 / 篩選面板裡一開始就會出現的標籤（依分類排列）
const PRESET_TAGS = [
  '雞肉', '豬肉', '牛肉', '雞蛋', '火腿', '培根', '鮭魚', '蝦', '豆腐',
  '蔥', '蒜', '薑', '洋蔥', '番茄', '青椒', '紅蘿蔔', '高麗菜', '菠菜',
  '檸檬', '蘋果', '香蕉', '鳳梨',
  '白飯', '麵條', '馬鈴薯', '吐司', '麵粉',
  '香菇', '杏鮑菇', '金針菇', '木耳',
  '醬油', '蠔油', '味噌', '番茄醬', '咖哩',
  '鹽巴', '糖', '胡椒', '橄欖油', '起司', '米酒',
  '高湯', '雞湯',
  '快速', '家常', '便當', '早餐',
];

/* ---------- 小工具 ---------- */
const $ = (sel, root = document) => root.querySelector(sel);

// 一律用 textContent 建 DOM，避免雲端上他人內容造成 XSS
function h(tag, props = {}, ...kids) {
  const el = document.createElement(tag);
  for (const [k, v] of Object.entries(props || {})) {
    if (k === 'class') el.className = v;
    else if (k.startsWith('on')) { if (v) el.addEventListener(k.slice(2), v); }
    else if (['value', 'checked', 'disabled', 'selected', 'hidden'].includes(k)) el[k] = v;
    else if (v !== false && v != null) el.setAttribute(k, v);
  }
  for (const kid of kids.flat()) {
    if (kid == null || kid === false) continue;
    el.append(kid.nodeType ? kid : document.createTextNode(String(kid)));
  }
  return el;
}

// 與 h() 相同的子節點規則（略過 null/false、展開陣列），用來整批取代內容
function setKids(el, ...kids) {
  el.replaceChildren(...kids.flat(Infinity).filter((k) => k != null && k !== false).map((k) => (k.nodeType ? k : document.createTextNode(String(k)))));
}

/* ---------- 圖示（統一的線條風格 SVG） ---------- */
const ICONS = {
  search: '<circle cx="11" cy="11" r="6.5"/><path d="M20 20l-4.2-4.2"/>',
  home: '<path d="M4 10.5L12 4l8 6.5V20h-5.5v-5.5h-5V20H4z"/>',
  plus: '<rect x="3.5" y="3.5" width="17" height="17" rx="5"/><path d="M12 8v8M8 12h8"/>',
  back: '<path d="M15 5l-7 7 7 7"/>',
  close: '<path d="M6 6l12 12M18 6L6 18"/>',
  play: '<path d="M8 5.5v13l10.5-6.5z"/>',
  pause: '<path d="M8.5 5v14M15.5 5v14"/>',
  clock: '<circle cx="12" cy="13.5" r="7"/><path d="M12 9.5v4l2.5 1.5M9.5 3h5"/>',
  trash: '<path d="M4.5 7h15M9.5 7V4.5h5V7M6.5 7l.8 12.5h9.4L17.5 7"/>',
  up: '<path d="M6 14.5l6-6 6 6"/>',
  down: '<path d="M6 9.5l6 6 6-6"/>',
  bookmark: '<path d="M6.5 4h11v16.5L12 16.5l-5.5 4z"/>',
  pencil: '<path d="M4 20l.8-4L16 4.8a2 2 0 0 1 2.8 0l.4.4a2 2 0 0 1 0 2.8L8 19.2z"/><path d="M14.5 6.5l3 3"/>',
  cloudUp: '<path d="M7 18.5a4.5 4.5 0 0 1-.6-8.96A6 6 0 0 1 18 10.5a4 4 0 0 1-.5 8"/><path d="M12 20v-8M9 14.5l3-3 3 3"/>',
  refresh: '<path d="M19.5 12a7.5 7.5 0 1 1-2.2-5.3M19.5 4.5v4h-4"/>',
  filter: '<path d="M4 7h9M17 7h3M4 17h3M11 17h9"/><circle cx="15" cy="7" r="2"/><circle cx="9" cy="17" r="2"/>',
  dice: '<rect x="4" y="4" width="16" height="16" rx="4.5"/><g fill="currentColor" stroke="none"><circle cx="9" cy="9" r="1.2"/><circle cx="15" cy="9" r="1.2"/><circle cx="12" cy="12" r="1.2"/><circle cx="9" cy="15" r="1.2"/><circle cx="15" cy="15" r="1.2"/></g>',
  image: '<rect x="3.5" y="5" width="17" height="14" rx="3"/><circle cx="9" cy="10.2" r="1.6"/><path d="M4 17l5-4.5 3.5 3 3-2.5 4.5 4"/>',
  download: '<path d="M12 4v11M7.5 11l4.5 4.5 4.5-4.5M5 20h14"/>',
  grip: '<path stroke-width="3" d="M9 6h.01M15 6h.01M9 12h.01M15 12h.01M9 18h.01M15 18h.01"/>',
};
const SVG_NS = 'http://www.w3.org/2000/svg';
function svgEl(inner, { size, sw, fill = false }) {
  const s = document.createElementNS(SVG_NS, 'svg');
  s.setAttribute('viewBox', '0 0 24 24');
  if (size) { s.setAttribute('width', size); s.setAttribute('height', size); }
  s.setAttribute('fill', fill ? 'currentColor' : 'none');
  s.setAttribute('stroke', 'currentColor');
  s.setAttribute('stroke-width', sw);
  s.setAttribute('stroke-linecap', 'round');
  s.setAttribute('stroke-linejoin', 'round');
  s.setAttribute('aria-hidden', 'true');
  s.innerHTML = inner; // 只放這支程式內建的靜態字串，不放使用者輸入
  return s;
}
function icon(name, { size = 24, sw = 1.8, fill = false } = {}) { return svgEl(ICONS[name], { size, sw, fill }); }

const fmt = (sec) => {
  sec = Math.max(0, Math.ceil(sec));
  return String(Math.floor(sec / 60)).padStart(2, '0') + ':' + String(sec % 60).padStart(2, '0');
};
const uid = () => 'r_' + Date.now().toString(36) + Math.random().toString(36).slice(2, 7);
const amtText = (i) => (i.unit === '適量' ? '適量' : `${i.amount}${i.unit}`.trim());

let toastTimer;
function toast(msg) {
  const t = $('#toast');
  t.textContent = msg; t.hidden = false;
  clearTimeout(toastTimer);
  toastTimer = setTimeout(() => (t.hidden = true), 2600);
}

/* ---------- 標籤小方塊（圓角框，依分類上色） ---------- */
function tagChip(name, { sm = false, sel = false, hit = false, x = false, add = false, onclick = null } = {}) {
  const cls = ['tg', 'c-' + catOf(name), sm && 'sm', sel && 'sel', hit && 'hit', add && 'add'].filter(Boolean).join(' ');
  return h(onclick ? 'button' : 'span', { class: cls, onclick }, name, x ? icon('close', { size: 12, sw: 2.6 }) : null);
}

// pool: Map<標籤, 次數>。依分類分組；同一組內依次數、再依預設順序排序
function tagSections(pool, { selected = new Set(), hideSelected = false, onPick, limit = 14 }) {
  const order = new Map(PRESET_TAGS.map((t, i) => [t, i]));
  const groups = new Map([...CATS.map(([id]) => id), 'other'].map((id) => [id, []]));
  pool.forEach((n, t) => { if (!(hideSelected && selected.has(t))) groups.get(catOf(t)).push(t); });
  const out = [];
  groups.forEach((tags, id) => {
    if (!tags.length) return;
    tags.sort((a, b) => (pool.get(b) - pool.get(a)) || ((order.get(a) ?? 999) - (order.get(b) ?? 999)) || a.localeCompare(b));
    out.push(h('div', { class: 'tp-title' }, CAT_NAME[id]),
      h('div', { class: 'tp-list' }, tags.slice(0, limit).map((t) => tagChip(t, { sel: selected.has(t), onclick: () => onPick(t) }))));
  });
  return out;
}

/* ---------- 底部彈出面板 ---------- */
function closeSheet() { const s = $('#sheet'); if (s) s.remove(); }
function openSheet(build, title) {
  closeSheet();
  const body = h('div', { class: 'sheet-body' });
  const wrap = h('div', { class: 'sheet-wrap', id: 'sheet' },
    h('div', { class: 'backdrop', onclick: closeSheet }),
    h('div', { class: 'sheet', role: 'dialog' }, h('div', { class: 'grab' }), title ? h('div', { class: 'sheet-title' }, title) : null, body));
  $('#app').append(wrap);
  build(body);
  requestAnimationFrame(() => wrap.classList.add('open'));
}

/* ---------- 封面（照片或預設圖示） ---------- */
const COVER_ICONS = {
  bowl: { name: '飯碗', d: '<path d="M3.5 12h17c0 4.8-3.6 8-8.5 8s-8.5-3.2-8.5-8z"/><path d="M9 21.5h6"/><path d="M6.8 12c.7-3 2.9-4.6 5.2-4.6s4.5 1.6 5.2 4.6"/>' },
  egg: { name: '雞蛋', d: '<path d="M12 3.5c3.6 0 6.2 5.2 6.2 9.2a6.2 6.2 0 0 1-12.4 0c0-4 2.6-9.2 6.2-9.2z"/><path d="M9 14a3 3 0 0 0 2.2 2.8"/>' },
  noodle: { name: '麵', d: '<path d="M3.5 12.5h17c0 4.5-3.6 7.5-8.5 7.5s-8.5-3-8.5-7.5z"/><path d="M8 12.5l9.5-9M11.5 12.5l8-7.5"/>' },
  soup: { name: '湯', d: '<path d="M3.5 11.5h17c0 5-3.6 8.5-8.5 8.5s-8.5-3.5-8.5-8.5z"/><path d="M8.5 8c0-1.2 1-1.6 1-2.8M12 8c0-1.2 1-1.6 1-2.8M15.5 8c0-1.2 1-1.6 1-2.8"/>' },
  meat: { name: '肉', d: '<ellipse cx="14.5" cy="9.5" rx="6.4" ry="5" transform="rotate(-45 14.5 9.5)"/><path d="M10.4 13.6L6.6 17.4"/><circle cx="5" cy="17" r="1.5"/><circle cx="7" cy="19" r="1.5"/>' },
  fish: { name: '魚', d: '<path d="M3 12c3.2-4.6 8.2-6 12.2-3.8L19 5v14l-3.8-3.2C11.2 18 6.2 16.6 3 12z"/><path stroke-width="2.6" d="M8.2 11.3h.01"/>' },
  leaf: { name: '蔬菜', d: '<path d="M5 19c-.5-8.5 4.5-14 14-14.5.5 9.5-5 14.5-14 14.5z"/><path d="M5 19c3.2-4.2 6.5-7 10-9"/>' },
  fruit: { name: '水果', d: '<path d="M12 8c-2.8-1.8-7-.3-7 4.8 0 3.8 2.8 7.2 5.2 7.2 1 0 1.2-.5 1.8-.5s.8.5 1.8.5c2.4 0 5.2-3.4 5.2-7.2 0-5.1-4.2-6.6-7-4.8z"/><path d="M12 8c0-2.2.9-3.6 2.4-4.5"/>' },
  mushroom: { name: '菇', d: '<path d="M4 12.5c0-4.6 3.6-8 8-8s8 3.4 8 8z"/><path d="M9.5 12.5V17a2.5 2.5 0 0 0 5 0v-4.5"/>' },
  bread: { name: '麵包', d: '<path d="M5.5 10.5v-2A3.5 3.5 0 0 1 9 5h6a3.5 3.5 0 0 1 3.5 3.5v2c1.2.6 1.2 2.4 0 3V19h-13v-5.5c-1.2-.6-1.2-2.4 0-3z"/>' },
  pan: { name: '炒鍋', d: '<path d="M3.5 10.5h13v5.5a3.5 3.5 0 0 1-3.5 3.5H7A3.5 3.5 0 0 1 3.5 16z"/><path d="M16.5 12.5H21"/><path d="M7.5 7.5c0-1 .8-1.3.8-2.3M11.5 7.5c0-1 .8-1.3.8-2.3"/>' },
  sauce: { name: '醬料', d: '<path d="M10 3.5h4v2.5l2 3v11.5H8V9l2-3z"/><path d="M8 13.5h8"/>' },
};

// 封面 = { type:'icon', id } 或 { type:'photo', data:'data:image/jpeg;base64,...' }；其他一律當作沒有
function normCover(c) {
  if (!c || typeof c !== 'object') return null;
  if (c.type === 'icon' && COVER_ICONS[c.id]) return { type: 'icon', id: c.id };
  if (c.type === 'photo' && typeof c.data === 'string' && c.data.length < 120000 && /^data:image\/(jpeg|png|webp);base64,[A-Za-z0-9+/=]+$/.test(c.data)) return { type: 'photo', data: c.data };
  return null;
}

// 沒選封面時，依標題與食材自動挑一個圖示
function autoIcon(r) {
  const t = r.title || '';
  if (/湯/.test(t)) return 'soup';
  if (/麵|義大利/.test(t)) return 'noodle';
  if (/飯|粥/.test(t)) return 'bowl';
  if (/蛋/.test(t)) return 'egg';
  if (/魚|蝦|鮭/.test(t)) return 'fish';
  const cats = (r.ingredients || []).map((i) => catOf(i.name));
  for (const [c, ic] of [['meat', 'meat'], ['mushroom', 'mushroom'], ['veg', 'leaf'], ['fruit', 'fruit'], ['starch', 'bread'], ['sauce', 'sauce'], ['soup', 'soup']]) {
    if (cats.includes(c)) return ic;
  }
  return 'pan';
}

const coverSvg = (id) => svgEl(COVER_ICONS[id].d, { sw: 1.5 });

function coverNode(r) {
  const c = normCover(r.cover);
  const box = h('div', { class: 'cover' });
  if (c && c.type === 'photo') box.append(h('img', { src: c.data, alt: '', loading: 'lazy', draggable: 'false' }));
  else box.append(coverSvg(c ? c.id : autoIcon(r)));
  return box;
}

// 照片：置中裁成正方形並縮小成 JPEG，才放得進 localStorage 與 Firestore
async function photoFromFile(file) {
  const url = URL.createObjectURL(file);
  try {
    const img = await new Promise((res, rej) => { const i = new Image(); i.onload = () => res(i); i.onerror = rej; i.src = url; });
    const side = Math.min(img.naturalWidth, img.naturalHeight);
    const sx = (img.naturalWidth - side) / 2;
    const sy = (img.naturalHeight - side) / 2;
    for (const [size, q] of [[360, 0.72], [320, 0.6], [280, 0.5], [240, 0.42]]) {
      const c = document.createElement('canvas');
      c.width = c.height = size;
      c.getContext('2d').drawImage(img, sx, sy, side, side, 0, 0, size, size);
      const data = c.toDataURL('image/jpeg', q);
      if (data.length < 60000) return data;
    }
    throw new Error('too big');
  } finally { URL.revokeObjectURL(url); }
}

/* ---------- 資料結構 ----------
 * Recipe = {
 *   id, cloudId, srcId, title, createdAt,
 *   ingredients: [{ name, amount, unit }],
 *   extraTags: [string],
 *   tags: [string],                 // = 食材名稱 + extraTags（搜尋用）
 *   cover: null | {type:'icon', id} | {type:'photo', data},
 *   steps: [{ text, timer: bool, seconds: number, optional: bool }]  // optional：選填步驟，灰底、沒有計時、做菜時上下移動會跳過
 * }
 */
function computeTags(r) {
  const set = new Set();
  (r.ingredients || []).forEach((i) => i.name && set.add(i.name.trim().toLowerCase()));
  (r.extraTags || []).forEach((t) => t && set.add(String(t).trim().toLowerCase()));
  return [...set].filter(Boolean);
}
function normalize(r) {
  const out = {
    id: r.id || uid(),
    cloudId: r.cloudId || null,
    srcId: r.srcId || null, // 從搜尋頁存下來的原始食譜 id，用來判斷是否已存過
    title: String(r.title || '').trim().slice(0, 60),
    author: String(r.author || '').slice(0, 30),
    createdAt: r.createdAt || new Date().toISOString(),
    cover: normCover(r.cover),
    ingredients: (r.ingredients || [])
      .map((i) => ({ name: String(i.name || '').trim().slice(0, 30), amount: String(i.amount ?? '').trim().slice(0, 10), unit: String(i.unit || '').slice(0, 6) }))
      .filter((i) => i.name),
    extraTags: (r.extraTags || []).map((t) => String(t).trim().slice(0, 20)).filter(Boolean),
    steps: (r.steps || [])
      .map((s) => ({ text: String(s.text || '').trim().slice(0, 500), optional: !!s.optional, timer: !!s.timer && !s.optional, seconds: Math.max(1, Math.min(86400, Number(s.seconds) || 60)) }))
      .filter((s) => s.text),
  };
  out.tags = computeTags(out);
  return out;
}

/* ---------- 本機儲存 ---------- */
const Local = {
  all() { try { return (JSON.parse(localStorage.getItem(LS_KEY)) || []).map(normalize); } catch { return []; } },
  saveAll(list) { localStorage.setItem(LS_KEY, JSON.stringify(list)); },
  upsert(r) {
    const list = this.all();
    const i = list.findIndex((x) => x.id === r.id);
    if (i >= 0) list[i] = r; else list.unshift(r);
    this.saveAll(list);
  },
  remove(id) { this.saveAll(this.all().filter((x) => x.id !== id)); },
  has(r) { return this.all().some((x) => x.id === r.id || x.srcId === r.id || (r.cloudId && x.cloudId === r.cloudId)); },
};

/* ---------- 雲端（Firestore REST，無需自架 Server） ---------- */
const FS_BASE = `https://firestore.googleapis.com/v1/projects/${CLOUD.projectId}/databases/(default)/documents/recipes`;
const coverToString = (c) => (!c ? '' : c.type === 'icon' ? 'icon:' + c.id : c.data);
const coverFromString = (s) => (s && s.startsWith('icon:') ? { type: 'icon', id: s.slice(5) } : s ? { type: 'photo', data: s } : null);
const Cloud = {
  async list() {
    const res = await fetch(`${FS_BASE}?pageSize=100&orderBy=createdAt%20desc&key=${CLOUD.apiKey}`);
    if (!res.ok) throw new Error('讀取雲端失敗 (' + res.status + ')');
    const data = await res.json();
    return (data.documents || []).map((d) => {
      try {
        const r = JSON.parse(d.fields.json.stringValue);
        r.id = d.name.split('/').pop();
        r.cloudId = r.id;
        r.cover = coverFromString(d.fields.cover && d.fields.cover.stringValue);
        return normalize(r);
      } catch { return null; }
    }).filter(Boolean);
  },
  async publish(r) {
    const body = {
      fields: {
        title: { stringValue: r.title },
        tags: { arrayValue: { values: r.tags.map((t) => ({ stringValue: t })) } },
        json: { stringValue: JSON.stringify({ title: r.title, author: r.author, createdAt: r.createdAt, ingredients: r.ingredients, extraTags: r.extraTags, steps: r.steps }) },
        cover: { stringValue: coverToString(r.cover) },
        createdAt: { timestampValue: new Date().toISOString() },
      },
    };
    const res = await fetch(`${FS_BASE}?key=${CLOUD.apiKey}`, {
      method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(body),
    });
    if (!res.ok) throw new Error('上傳失敗 (' + res.status + ')');
    const d = await res.json();
    return d.name.split('/').pop();
  },
};

/* ---------- 示範資料（未設定雲端時顯示） ---------- */
const SEED = [
  normalize({
    id: 'seed_1', title: '火腿蛋炒飯',
    ingredients: [
      { name: '白飯', amount: '2', unit: '杯' }, { name: '蔥綠', amount: '1', unit: '段' },
      { name: '蒜', amount: '3', unit: '片' }, { name: '雞蛋', amount: '2', unit: '個' },
      { name: '火腿', amount: '60', unit: '克' }, { name: '鹽巴', amount: '1', unit: '匙' },
    ],
    extraTags: ['炒飯', '快速'],
    steps: [
      { text: '蛋白煎熟，分小份盛起', timer: true, seconds: 45 },
      { text: '蛋黃炒熟，盛起備用', timer: true, seconds: 30 },
      { text: '轉中火爆香蒜頭和蔥', timer: true, seconds: 20 },
      { text: '喜歡吃辣的話，可以加一點辣椒碎', optional: true },
      { text: '加入火腿丁炒香', timer: true, seconds: 60 },
      { text: '轉大火，加入白飯與蛋黃，拌炒均勻，加鹽調味', timer: true, seconds: 120 },
    ],
  }),
  normalize({
    id: 'seed_2', title: '番茄炒蛋',
    ingredients: [
      { name: '番茄', amount: '2', unit: '顆' }, { name: '雞蛋', amount: '3', unit: '個' },
      { name: '蔥', amount: '1', unit: '段' }, { name: '鹽巴', amount: '1', unit: '小匙' },
    ],
    extraTags: ['家常', '快速'],
    steps: [
      { text: '番茄切塊，蛋打散加少許鹽', timer: false, seconds: 60 },
      { text: '熱油，倒入蛋液炒至半熟盛起', timer: true, seconds: 40 },
      { text: '炒番茄至出汁軟爛', timer: true, seconds: 180 },
      { text: '倒回雞蛋拌勻，撒上蔥花', timer: false, seconds: 60 },
    ],
  }),
  normalize({
    id: 'seed_3', title: '蒜香義大利麵',
    ingredients: [
      { name: '麵條', amount: '200', unit: '克' }, { name: '蒜', amount: '5', unit: '瓣' },
      { name: '辣椒', amount: '1', unit: '條' }, { name: '鹽巴', amount: '1', unit: '匙' },
    ],
    extraTags: ['義大利麵'],
    steps: [
      { text: '水滾後加鹽，下麵條煮熟', timer: true, seconds: 540 },
      { text: '小火慢煎蒜片與辣椒至金黃', timer: true, seconds: 120 },
      { text: '加入麵條與一勺煮麵水，拌炒收汁', timer: true, seconds: 60 },
    ],
  }),
  normalize({
    id: 'seed_4', title: '蒜香蘑菇雞湯',
    ingredients: [
      { name: '雞肉', amount: '300', unit: '克' }, { name: '香菇', amount: '5', unit: '個' },
      { name: '薑', amount: '3', unit: '片' }, { name: '高湯', amount: '800', unit: '毫升' },
      { name: '鹽巴', amount: '1', unit: '小匙' },
    ],
    extraTags: ['湯', '暖胃'],
    steps: [
      { text: '雞肉汆燙去血水，洗淨備用', timer: true, seconds: 180 },
      { text: '高湯煮滾，放入雞肉、香菇和薑片', timer: false, seconds: 60 },
      { text: '轉小火燉煮', timer: true, seconds: 1500 },
      { text: '加鹽調味即可上桌', timer: false, seconds: 60 },
    ],
  }),
];

/* =========================================================
 * 狀態與分頁
 * ========================================================= */
const S = { cloud: [], loaded: false, error: '', tab: 'home', draft: null };
const TABS = [['search', 'search', '搜尋'], ['home', 'home', '首頁'], ['add', 'plus', '新增食譜']];
const searchUI = { update() {} };

function buildTabbar() {
  const bar = $('#tabbar');
  bar.replaceChildren(...TABS.map(([id, ic, label]) =>
    h('button', { class: 'tab', 'data-tab': id, 'aria-label': label, onclick: () => goTab(id) }, icon(ic, { size: 27 }))));
}

function goTab(name) {
  closeCook();
  closeSheet();
  S.tab = name;
  $('#page-search').hidden = name !== 'search';
  $('#page-home').hidden = name !== 'home';
  $('#page-edit').hidden = name !== 'add';
  document.querySelectorAll('.tab').forEach((b) => b.classList.toggle('active', b.dataset.tab === name));
  if (name === 'search') searchUI.update();
  if (name === 'home') renderHome();
  if (name === 'add') ensureEditor();
}

/* =========================================================
 * 資料載入
 * ========================================================= */
async function loadCloud() {
  if (!CLOUD_ON) { S.cloud = SEED; S.loaded = true; S.error = ''; return; }
  try { S.cloud = await Cloud.list(); S.error = ''; }
  catch (e) { S.error = e.message; S.cloud = []; }
  S.loaded = true;
}
function refreshViews() {
  if (S.tab === 'home') renderHome();
  searchUI.update();
}

/* =========================================================
 * 比對（交集 / 聯集）
 * ========================================================= */
// exact=true：標籤必須完全相同（首頁點選標籤用）；否則為包含比對（搜尋輸入用）
function matchRecipes(list, tags, mode, exact = false) {
  if (!tags.length) return list.map((r) => ({ r, hits: [] }));
  const has = (r, t) => (exact ? r.tags.includes(t) : r.tags.some((x) => x.includes(t)) || r.title.toLowerCase().includes(t));
  const all = list.map((r) => ({ r, hits: tags.filter((t) => has(r, t)) }));
  return all.filter((x) => (mode === 'and' ? x.hits.length === tags.length : x.hits.length > 0))
    .sort((a, b) => b.hits.length - a.hits.length);
}

/* =========================================================
 * 瀑布流卡片（搜尋頁）
 * ========================================================= */
// 以字數粗估卡片高度，用來把卡片分配到目前最短的那一欄
function estimateHeight(r, shown) {
  const W = 165;
  let rows = 1; let used = 0;
  shown.forEach((t) => {
    const w = t.length * 11 + 22;
    if (used + w > W - 18) { rows++; used = 0; }
    used += w + 4;
  });
  return W + 16 + Math.ceil(r.title.length / 10) * 19 + rows * 22 + 20;
}

function pinCard(r, hits, onOpen) {
  const shown = r.tags.slice(0, 6);
  const el = h('article', { class: 'pin', onclick: onOpen },
    h('div', { class: 'pin-img' }, coverNode(r)),
    h('div', { class: 'pin-cap' },
      h('div', { class: 'pin-name' }, r.title),
      h('div', { class: 'pin-tags' },
        shown.map((t) => tagChip(t, { sm: true, hit: hits.some((q) => t.includes(q)) })),
        r.tags.length > shown.length ? h('span', { class: 'pin-n' }, '+' + (r.tags.length - shown.length)) : null)));
  return { el, est: estimateHeight(r, shown) };
}

function masonry(cards, cols = 2) {
  const colEls = Array.from({ length: cols }, () => h('div', { class: 'mcol' }));
  const heights = Array(cols).fill(0);
  cards.forEach(({ el, est }) => {
    const k = heights.indexOf(Math.min(...heights));
    colEls[k].append(el);
    heights[k] += est;
  });
  return h('div', { class: 'masonry' }, colEls);
}

/* =========================================================
 * 搜尋頁（點擊搜尋欄才顯示標籤；可選交集 / 聯集）
 * ========================================================= */
const Search = { open: false, tags: [], mode: 'and' };

function searchPool(q) {
  const pool = new Map(PRESET_TAGS.map((t) => [t, 0]));
  S.cloud.forEach((r) => r.tags.forEach((t) => pool.set(t, (pool.get(t) || 0) + 1)));
  if (q) [...pool.keys()].forEach((t) => { if (!t.includes(q)) pool.delete(t); });
  return pool;
}

function buildSearch() {
  const page = $('#page-search');
  const input = h('input', { type: 'text', placeholder: '搜尋食材或標籤', enterkeyhint: 'done', autocomplete: 'off', autocapitalize: 'off', spellcheck: 'false' });
  const cancelBtn = h('button', { class: 'text-btn', hidden: true, onclick: () => closeSearch() }, '取消');
  const refreshBtn = h('button', { class: 'icon-btn', 'aria-label': '重新整理', onclick: async () => { S.loaded = false; update(); await loadCloud(); refreshViews(); } }, icon('refresh', { size: 21 }));
  const filters = h('div', { class: 'filters', hidden: true });
  const panel = h('div', { class: 'tag-panel', hidden: true });
  const results = h('div', { class: 'results' });
  page.append(
    h('div', { class: 'hdr search-hdr' }, h('label', { class: 'sb-field' }, icon('search', { size: 18 }), input), cancelBtn, refreshBtn),
    h('div', { class: 'scroll' }, filters, panel, results));

  function addTags(raw) {
    raw.split(/[\s,，、]+/).map((t) => t.trim().toLowerCase()).filter(Boolean).forEach((t) => {
      if (!Search.tags.includes(t)) Search.tags.push(t);
    });
    input.value = '';
    update();
  }
  function removeTag(t) { Search.tags = Search.tags.filter((x) => x !== t); update(); }
  function openSearch() { if (!Search.open) { Search.open = true; update(); } }
  function closeSearch() { Search.open = false; input.value = ''; input.blur(); update(); }
  searchUI.close = closeSearch;

  input.addEventListener('focus', openSearch);
  input.addEventListener('input', () => { if (Search.open) renderPanel(); });
  input.addEventListener('keydown', (e) => {
    if (e.isComposing || e.keyCode === 229) return; // 輸入法組字中
    const v = input.value.trim();
    if (e.key === 'Enter') { e.preventDefault(); if (v) addTags(v); else closeSearch(); }
    else if ((e.key === ' ' || e.key === ',' || e.key === '，') && v) { e.preventDefault(); addTags(v); }
    else if (e.key === 'Backspace' && !input.value && Search.tags.length) { Search.tags.pop(); update(); }
  });

  function renderFilters() {
    filters.hidden = !(Search.open || Search.tags.length);
    if (filters.hidden) return;
    setKids(filters,
      Search.tags.length ? h('div', { class: 'sel-tags' }, Search.tags.map((t) => tagChip(t, { x: true, onclick: () => removeTag(t) }))) : null,
      h('div', { class: 'seg small' },
        h('button', { class: Search.mode === 'and' ? 'on' : '', onclick: () => { Search.mode = 'and'; update(); } }, '交集'),
        h('button', { class: Search.mode === 'or' ? 'on' : '', onclick: () => { Search.mode = 'or'; update(); } }, '聯集')),
      h('div', { class: 'cap' }, Search.mode === 'and' ? '同時包含所有標籤' : '包含任一標籤即可'));
  }

  function renderPanel() {
    const q = input.value.trim().toLowerCase();
    const sel = new Set(Search.tags);
    const pool = searchPool(q);
    const count = matchRecipes(S.cloud, Search.tags, Search.mode).length;
    setKids(panel,
      q && !sel.has(q) && !pool.has(q) ? h('div', { style: 'margin-top:12px' }, tagChip(`新增「${q}」`, { add: true, onclick: () => addTags(q) })) : null,
      tagSections(pool, { selected: sel, hideSelected: true, limit: 14, onPick: (t) => addTags(t) }),
      h('div', { class: 'tp-foot' }, h('button', { onclick: () => closeSearch() }, Search.tags.length ? `查看 ${count} 份食譜` : '完成')));
  }

  function renderResults() {
    const res = matchRecipes(S.cloud, Search.tags, Search.mode);
    setKids(results,
      !CLOUD_ON ? h('div', { class: 'notice' }, '尚未連接雲端，目前顯示的是示範食譜（設定方式見 README）。') : null,
      S.error ? h('div', { class: 'notice' }, S.error) : null,
      !S.loaded ? h('div', { class: 'empty' }, '載入中…') : null,
      S.loaded ? h('div', { class: 'count' }, Search.tags.length ? `${res.length} 份食譜` : '最新食譜') : null,
      S.loaded && !res.length ? h('div', { class: 'empty' }, '沒有符合的食譜，換個標籤或改用聯集試試') : null,
      res.length ? masonry(res.map(({ r, hits }) => pinCard(r, hits, () => startCook(r)))) : null);
  }

  function update() {
    cancelBtn.hidden = !Search.open;
    refreshBtn.hidden = Search.open;
    panel.hidden = !Search.open;
    results.hidden = Search.open;
    renderFilters();
    if (Search.open) renderPanel(); else renderResults();
  }
  searchUI.update = update;
  update();
}

/* =========================================================
 * 首頁：我的食譜（本機）＋ 標籤篩選 ＋ 隨機選取
 * ========================================================= */
const Home = { open: false, tags: [], mode: 'and', last: null };

// 從「目前篩選後」的食譜裡隨機挑一份並直接開始；盡量不連續抽到同一份
function randomPick() {
  const pool = matchRecipes(Local.all(), Home.tags, Home.mode, true).map((x) => x.r);
  if (!pool.length) return toast(Home.tags.length ? '符合篩選的食譜是空的' : '還沒有食譜可以抽');
  const others = pool.length > 1 ? pool.filter((r) => r.id !== Home.last) : pool;
  const pick = others[Math.floor(Math.random() * others.length)];
  Home.last = pick.id;
  startCook(pick);
  toast('就吃：' + pick.title);
}

function recipeCard(r, hits, onOpen, actions) {
  return h('article', { class: 'rcard', onclick: onOpen },
    h('div', { class: 'rthumb' }, coverNode(r)),
    h('div', { class: 'rbody' },
      h('h3', {}, r.title),
      h('div', { class: 'meta' }, `${r.ingredients.length} 種食材 · ${r.steps.length} 個步驟${r.cloudId ? ' · 已發布' : ''}`),
      h('div', { class: 'tags' }, r.tags.slice(0, 8).map((t) => tagChip(t, { sm: true, hit: (hits || []).includes(t) }))),
      actions || null));
}

function renderHome() {
  const page = $('#page-home');
  const prevTop = ($('.scroll', page) || {}).scrollTop || 0;
  const all = Local.all();
  const valid = new Set(all.flatMap((r) => r.tags));
  Home.tags = Home.tags.filter((t) => valid.has(t)); // 刪除食譜後，不存在的標籤自動移除
  const list = matchRecipes(all, Home.tags, Home.mode, true);
  const toggleTag = (t) => {
    Home.tags = Home.tags.includes(t) ? Home.tags.filter((x) => x !== t) : [...Home.tags, t];
    renderHome();
  };

  const importInput = h('input', { type: 'file', accept: 'application/json', hidden: true, onchange: async (e) => {
    const f = e.target.files[0]; if (!f) return;
    try {
      const data = JSON.parse(await f.text());
      (Array.isArray(data) ? data : [data]).forEach((x) => Local.upsert(normalize({ ...x, id: uid(), cloudId: null })));
      toast('匯入完成'); renderHome();
    } catch { toast('檔案格式錯誤'); }
  } });

  const toolbar = h('div', { class: 'toolbar' },
    h('button', { class: 'tbtn' + (Home.open || Home.tags.length ? ' on' : ''), 'aria-expanded': String(Home.open), onclick: () => { Home.open = !Home.open; renderHome(); } },
      icon('filter', { size: 18 }), '篩選', Home.tags.length ? h('span', { class: 'badge' }, Home.tags.length) : null),
    h('button', { class: 'tbtn accent', onclick: randomPick }, icon('dice', { size: 18 }), '隨機選取'));

  const pool = new Map();
  all.forEach((r) => r.tags.forEach((t) => pool.set(t, (pool.get(t) || 0) + 1)));
  const panel = Home.open ? h('div', { class: 'home-filter' },
    h('div', { class: 'seg small' },
      h('button', { class: Home.mode === 'and' ? 'on' : '', onclick: () => { Home.mode = 'and'; renderHome(); } }, '交集'),
      h('button', { class: Home.mode === 'or' ? 'on' : '', onclick: () => { Home.mode = 'or'; renderHome(); } }, '聯集')),
    h('div', { class: 'cap' }, Home.mode === 'and' ? '同時包含所有選取的標籤' : '包含任一選取的標籤即可'),
    all.length
      ? tagSections(pool, { selected: new Set(Home.tags), limit: 999, onPick: toggleTag })
      : h('div', { class: 'cap' }, '還沒有標籤，新增食譜後就會出現'),
    Home.tags.length ? h('button', { class: 'text-btn quiet clear', onclick: () => { Home.tags = []; renderHome(); } }, '清除篩選') : null) : null;

  const items = [];
  if (all.length) items.push(h('div', { class: 'count' }, Home.tags.length ? `${list.length} 份食譜 · ${Home.mode === 'and' ? '交集' : '聯集'}` : `${all.length} 份食譜`));
  list.forEach(({ r, hits }) => items.push(recipeCard(r, hits, () => startCook(r), h('div', { class: 'actions', onclick: (e) => e.stopPropagation() },
    h('button', { class: 'icon-btn', 'aria-label': '編輯', onclick: () => openEditor(r) }, icon('pencil', { size: 20 })),
    h('button', { class: 'icon-btn', 'aria-label': '發布到雲端', disabled: !CLOUD_ON || !!r.cloudId, onclick: () => publishExisting(r) }, icon('cloudUp', { size: 21 })),
    h('button', { class: 'icon-btn', 'aria-label': '匯出', onclick: () => exportJSON(r) }, icon('download', { size: 20 })),
    h('button', { class: 'icon-btn', 'aria-label': '刪除', onclick: () => { if (confirm('刪除「' + r.title + '」？')) { Local.remove(r.id); renderHome(); } } }, icon('trash', { size: 20 }))))));
  if (!all.length) items.push(h('div', { class: 'empty' }, '還沒有食譜，點下方 + 新增，或到搜尋頁找一份存起來'));
  else if (!list.length) items.push(h('div', { class: 'empty' }, '沒有符合的食譜，換個標籤或改用聯集試試'));
  items.push(h('div', { class: 'foot-actions' },
    h('button', { class: 'text-btn quiet', onclick: () => importInput.click() }, '匯入備份'),
    h('button', { class: 'text-btn quiet', disabled: !all.length, onclick: () => exportJSON(all) }, '匯出全部')));

  page.replaceChildren(
    h('div', { class: 'hdr home-hdr' }, h('img', { class: 'logo', src: 'logo.png', alt: '食譜工具' })),
    h('div', { class: 'scroll' }, toolbar, panel, items, importInput));
  $('.scroll', page).scrollTop = prevTop;
}

function exportJSON(data) {
  const blob = new Blob([JSON.stringify(data, null, 2)], { type: 'application/json' });
  const a = h('a', { href: URL.createObjectURL(blob), download: (Array.isArray(data) ? 'recipes' : data.title || 'recipe') + '.json' });
  document.body.append(a); a.click(); a.remove();
}

async function publishExisting(r) {
  if (!CLOUD_ON) return toast('尚未設定雲端');
  try {
    toast('上傳中…');
    const cid = await Cloud.publish(r);
    Local.upsert({ ...r, cloudId: cid });
    await loadCloud();
    toast('已發布到雲端');
    refreshViews();
  } catch (e) { toast(e.message); }
}

/* =========================================================
 * 共用：時間軸一列（節點框裡含計時框）
 * ========================================================= */
function timelineRow(node, cls = '') {
  return h('div', { class: 'trow ' + cls }, h('div', { class: 'rail' }, h('span', { class: 'dot' })), node);
}

/* =========================================================
 * 做菜頁
 * ========================================================= */
let audioCtx;
function unlockAudio() {
  try {
    audioCtx = audioCtx || new (window.AudioContext || window.webkitAudioContext)();
    if (audioCtx.state === 'suspended') audioCtx.resume();
  } catch { /* ignore */ }
}
function alarm() {
  if (navigator.vibrate) navigator.vibrate([300, 150, 300, 150, 300]);
  if (!audioCtx) return;
  for (let i = 0; i < 6; i++) {
    const t = audioCtx.currentTime + i * 0.5;
    const o = audioCtx.createOscillator(); const g = audioCtx.createGain();
    o.type = 'sine'; o.frequency.value = i % 2 ? 988 : 880;
    g.gain.setValueAtTime(0.0001, t);
    g.gain.exponentialRampToValueAtTime(0.4, t + 0.02);
    g.gain.exponentialRampToValueAtTime(0.0001, t + 0.4);
    o.connect(g).connect(audioCtx.destination);
    o.start(t); o.stop(t + 0.45);
  }
}

let cookCleanup = null;
function closeCook() {
  if (cookCleanup) { cookCleanup(); cookCleanup = null; }
  const root = $('#page-cook');
  root.hidden = true;
  root.replaceChildren();
}

function startCook(recipe) {
  closeCook();
  const steps = recipe.steps;
  const root = $('#page-cook');
  // 選填步驟：上下移動時不會被選到（除非整份食譜都是選填）
  const hasReq = steps.some((s) => !s.optional);
  const skip = (i) => hasReq && steps[i].optional;
  const nextReq = (i, dir) => {
    let j = i + dir;
    while (j >= 0 && j < steps.length && skip(j)) j += dir;
    return j >= 0 && j < steps.length ? j : -1;
  };
  let cur = skip(0) ? nextReq(0, 1) : 0;
  let ticker = null;
  let wakeLock = null;
  let suppress = false;
  const timers = steps.map((s) => (s.timer ? { total: s.seconds * 1000, remain: s.seconds * 1000, endAt: 0, running: false } : null));
  const clamp = (n) => Math.max(0, Math.min(steps.length - 1, n));

  const prog = h('div', { class: 'prog' });
  const saveBtn = h('button', { class: 'icon-btn', 'aria-label': '存到我的食譜', onclick: () => {
    if (Local.has(recipe)) return toast('已在我的食譜');
    Local.upsert(normalize({ ...recipe, id: uid(), cloudId: recipe.cloudId, srcId: recipe.id }));
    paintSave(); toast('已存到我的食譜');
  } });
  const paintSave = () => saveBtn.replaceChildren(icon('bookmark', { size: 23, fill: Local.has(recipe) }));

  /* ----- 每個步驟一列（計時框在步驟框裡面） ----- */
  const rows = steps.map((s, i) => {
    const r = { i };
    let box = null;
    if (timers[i]) {
      r.time = h('div', { class: 't' });
      r.fill = h('div', { class: 'fill' });
      r.ico = h('div', { class: 'ti' });
      r.reset = h('button', { class: 'treset', 'aria-label': '重設計時', onclick: (e) => { e.stopPropagation(); resetT(i); } }, icon('refresh', { size: 14, sw: 2.2 }));
      r.box = h('div', { class: 'tbox', role: 'button', tabindex: 0, 'aria-label': '開始或暫停計時', onclick: (e) => { e.stopPropagation(); toggleT(i); } }, r.fill, r.ico, r.time, r.reset);
      box = r.box;
    }
    r.node = h('div', { class: 'node' + (s.optional ? ' optional' : ''), onclick: () => { if (!skip(i)) setCur(i); } },
      h('div', { class: 'ntext' }, s.text), s.optional ? h('span', { class: 'optag' }, '選填') : box);
    r.el = timelineRow(r.node, s.optional ? 'opt' : '');
    return r;
  });

  function paintT(i) {
    const t = timers[i]; const r = rows[i];
    if (!t) return;
    r.time.textContent = fmt(t.remain / 1000);
    r.box.classList.toggle('running', t.running);
    r.box.classList.toggle('done', t.remain <= 0);
    r.fill.style.height = (100 * (1 - t.remain / t.total)) + '%';
    const key = t.running ? 'pause' : 'play';
    if (r.ik !== key) { r.ik = key; r.ico.replaceChildren(icon(key, { size: 14, sw: 2.2, fill: key === 'play' })); }
    r.reset.hidden = t.running || t.remain === t.total;
  }

  function setCur(i, scroll = true) {
    cur = clamp(i);
    rows.forEach((r, k) => { r.el.classList.toggle('current', k === cur); r.el.classList.toggle('done', k < cur); });
    // 進度只算必做步驟
    prog.textContent = hasReq
      ? `${steps.slice(0, cur + 1).filter((s) => !s.optional).length} / ${steps.filter((s) => !s.optional).length}`
      : `${cur + 1} / ${steps.length}`;
    if (scroll) rows[cur].el.scrollIntoView({ block: 'center', behavior: 'smooth' });
  }

  // 往上 / 往下移動：依方向跳到下一個（或前一個）必做步驟；沒有可去的就不動
  function stepBy(dir) {
    const j = nextReq(cur, dir);
    if (j < 0) return false;
    setCur(j);
    return true;
  }

  /* ----- 計時（每個步驟獨立，可同時進行） ----- */
  function ensureTicker() { if (!ticker) ticker = setInterval(tick, 200); }
  function toggleT(i) {
    const t = timers[i]; if (!t) return;
    unlockAudio(); // 聲音需要使用者先互動才能播放
    setCur(i, false);
    if (t.running) { t.remain = Math.max(0, t.endAt - Date.now()); t.running = false; }
    else {
      if (t.remain <= 0) t.remain = t.total;
      t.endAt = Date.now() + t.remain; t.running = true; ensureTicker();
    }
    paintT(i);
  }
  function resetT(i) { const t = timers[i]; t.running = false; t.remain = t.total; paintT(i); }
  function tick() {
    let any = false;
    timers.forEach((t, i) => {
      if (!t || !t.running) return;
      t.remain = t.endAt - Date.now();
      if (t.remain <= 0) { t.remain = 0; t.running = false; paintT(i); onDone(i); }
      else { any = true; paintT(i); }
    });
    if (!any) { clearInterval(ticker); ticker = null; }
  }
  function onDone(i) {
    alarm();
    if (cur === i) {
      if (nextReq(i, 1) >= 0) setTimeout(() => { if (cur === i) stepBy(1); }, 1200);
      else toast('全部完成，開動');
    } else toast(`步驟 ${i + 1} 計時結束`);
  }

  /* ----- 畫面 ----- */
  const scroller = h('div', { class: 'scroll doc' },
    h('div', { class: 'title-row' }, h('div', { class: 'thumb' }, coverNode(recipe)), h('h2', { class: 'doc-title' }, recipe.title)),
    h('div', { class: 'sec-label' }, '備料'),
    h('div', { class: 'ings' }, recipe.ingredients.map((i) => h('span', { class: 'pill c-' + catOf(i.name) }, h('b', {}, i.name), h('span', {}, amtText(i))))),
    h('div', { class: 'sec-label' }, '步驟'),
    h('div', { class: 'timeline' }, rows.map((r) => r.el)));

  root.append(
    h('div', { class: 'hdr' }, h('button', { class: 'icon-btn', 'aria-label': '返回', onclick: closeCook }, icon('back', { size: 24, sw: 2.2 })), prog, saveBtn),
    scroller);
  root.hidden = false;
  paintSave();
  rows.forEach((_, i) => paintT(i));
  setCur(cur, false);
  scroller.scrollTop = 0;

  /* ----- 滑鼠拖曳捲動（手機用拇指原生滑動） ----- */
  let pd = null;
  scroller.addEventListener('pointerdown', (e) => {
    if (e.pointerType !== 'mouse' || e.button !== 0) return;
    if (e.target.closest('button,input,textarea,select,.tbox')) return;
    pd = { y: e.clientY, top: scroller.scrollTop, moved: false, id: e.pointerId };
  });
  scroller.addEventListener('pointermove', (e) => {
    if (!pd) return;
    const dy = e.clientY - pd.y;
    if (!pd.moved && Math.abs(dy) > 5) { pd.moved = true; scroller.setPointerCapture(pd.id); scroller.classList.add('dragging'); }
    if (pd.moved) scroller.scrollTop = pd.top - dy;
  });

  const endDrag = () => {
    if (pd && pd.moved) { suppress = true; setTimeout(() => (suppress = false), 0); }
    scroller.classList.remove('dragging'); pd = null;
  };

  scroller.addEventListener('pointerup', endDrag);
  scroller.addEventListener('pointercancel', endDrag);
  scroller.addEventListener('click', (e) => { if (suppress) { e.stopPropagation(); e.preventDefault(); suppress = false; } }, true);

  /* ----- 滑鼠滾輪：一格一步 ----- */
  let wheelTimeout = null;
  scroller.addEventListener('wheel', (e) => {
    e.preventDefault();

    // 如果已經在冷卻中，或是滾動幅度太小，就略過
    if (wheelTimeout || Math.abs(e.deltaY) < 3) return;

    if (stepBy(e.deltaY > 0 ? 1 : -1)) {
      wheelTimeout = setTimeout(() => { wheelTimeout = null; }, 120); // 冷卻時間
    }
  }, { passive: false });

  /* ----- 鍵盤：↑ ↓ 換步驟、空白鍵計時、Esc 離開 ----- */
  const onKey = (e) => {
    if (e.key === 'ArrowDown') { e.preventDefault(); stepBy(1); }
    else if (e.key === 'ArrowUp') { e.preventDefault(); stepBy(-1); }
    else if (e.key === ' ') { e.preventDefault(); toggleT(cur); }
    else if (e.key === 'Escape') closeCook();
  };
  document.addEventListener('keydown', onKey);

  if (navigator.wakeLock) navigator.wakeLock.request('screen').then((l) => (wakeLock = l)).catch(() => {});

  cookCleanup = () => {
    if (ticker) { clearInterval(ticker); ticker = null; }
    document.removeEventListener('keydown', onKey);
    if (wakeLock) wakeLock.release().catch(() => {});
  };
}

/* =========================================================
 * 拖曳排序：只有「把手」可以拖，所以不影響輸入文字與頁面捲動
 *   mode 'y'    ：單欄直排（步驟）
 *   mode 'flow' ：會換行的一排（備料標籤）
 * 放開後呼叫 onDrop(order)，order[新位置] = 原本的位置
 * ========================================================= */
function enableSort({ container, itemSel, handleSel, mode, getScroller, onDrop }) {
  container.addEventListener('pointerdown', (e) => {
    const handle = e.target.closest(handleSel);
    if (!handle || (e.pointerType === 'mouse' && e.button !== 0)) return;
    const item = handle.closest(itemSel);
    if (!item || !container.contains(item)) return;
    e.preventDefault();

    const list = () => [...container.querySelectorAll(':scope > ' + itemSel)];
    const original = list();
    const r0 = item.getBoundingClientRect();
    const grab = { x: e.clientX - r0.left, y: e.clientY - r0.top }; // 抓住項目的哪個位置
    let px = e.clientX; let py = e.clientY;
    let raf = 0;
    item.classList.add('sorting');
    document.body.style.userSelect = 'none';

    const layout = () => {
      // 項目「視覺上」的中心點；越過別的項目的中心，就跟它換位置
      const vcx = px - grab.x + r0.width / 2;
      const vcy = py - grab.y + r0.height / 2;
      const others = list().filter((x) => x !== item);
      const passed = (o) => {
        const r = o.getBoundingClientRect();
        if (mode === 'y') return vcy > r.top + r.height / 2;
        return vcy > r.bottom || (vcy >= r.top && vcx > r.left + r.width / 2);
      };
      const target = others.filter(passed).length;
      if (others.length && target !== list().indexOf(item)) {
        if (target >= others.length) others[others.length - 1].after(item); else others[target].before(item);
      }
      // 先量出它「在版面上的位置」，再用位移讓它跟著手指走
      item.style.transform = '';
      const nat = item.getBoundingClientRect();
      const dx = mode === 'y' ? 0 : px - grab.x - nat.left;
      item.style.transform = `translate(${dx}px, ${py - grab.y - nat.top}px)`;
    };

    // 每一格畫面都更新，並在靠近上下邊緣時自動捲動
    const frame = () => {
      const sc = getScroller && getScroller();
      if (sc) {
        const b = sc.getBoundingClientRect();
        const edge = 72;
        if (py < b.top + edge) sc.scrollTop -= Math.min(16, (b.top + edge - py) / 4 + 2);
        else if (py > b.bottom - edge) sc.scrollTop += Math.min(16, (py - (b.bottom - edge)) / 4 + 2);
      }
      layout();
      raf = requestAnimationFrame(frame);
    };

    const move = (ev) => { if (ev.pointerId === e.pointerId) { px = ev.clientX; py = ev.clientY; } };
    const end = (ev) => {
      if (ev.pointerId !== e.pointerId) return;
      cancelAnimationFrame(raf);
      window.removeEventListener('pointermove', move);
      window.removeEventListener('pointerup', end);
      window.removeEventListener('pointercancel', end);
      document.body.style.userSelect = '';
      item.classList.remove('sorting');
      item.style.transform = '';
      const order = list().map((el) => original.indexOf(el));
      if (order.some((v, k) => v !== k)) onDrop(order);
    };
    // 項目在拖曳中會被搬動位置，所以監聽 window，不依賴 pointer capture
    window.addEventListener('pointermove', move);
    window.addEventListener('pointerup', end);
    window.addEventListener('pointercancel', end);
    frame();
  });
}

/* =========================================================
 * 新增 / 編輯頁（版型與做菜頁相同，只是欄位可編輯）
 * ========================================================= */
function blankDraft() {
  return {
    id: null, cloudId: null, createdAt: null, title: '', extraTags: '', cover: null,
    ingredients: [{ name: '', amount: '', unit: '克' }],
    steps: [{ text: '', timer: false, seconds: 60 }],
    publish: CLOUD_ON, dirty: false, cur: 0,
  };
}
function ensureEditor() { if (!S.draft) { S.draft = blankDraft(); buildEditor(); } }

function openEditor(r) {
  if (S.draft && S.draft.dirty && !confirm('目前編輯中的內容將被取代，要繼續嗎？')) { goTab('add'); return; }
  S.draft = {
    id: r.id, cloudId: r.cloudId, createdAt: r.createdAt, title: r.title, extraTags: r.extraTags.join(' '), cover: r.cover,
    ingredients: r.ingredients.map((i) => ({ ...i })), steps: r.steps.map((s) => ({ ...s })),
    publish: false, dirty: false, cur: 0,
  };
  goTab('add');
  buildEditor();
}

function buildEditor() {
  const d = S.draft;
  const page = $('#page-edit');
  page.replaceChildren();
  const ingBox = h('div', { class: 'ings edit' });
  const tl = h('div', { class: 'timeline' });
  let rows = [];

  const fit = (ta) => { ta.style.height = 'auto'; ta.style.height = ta.scrollHeight + 'px'; };
  const touch = () => { d.dirty = true; };

  /* ----- 封面 ----- */
  const coverBtn = h('button', { class: 'cover-btn', 'aria-label': '更換封面', onclick: () => openCoverSheet() });
  const paintCover = () => setKids(coverBtn,
    coverNode({ cover: d.cover, title: d.title, ingredients: d.ingredients.filter((i) => i.name.trim()) }),
    h('span', { class: 'cover-edit' }, icon('image', { size: 13, sw: 2 })));

  function openCoverSheet() {
    openSheet((body) => {
      const fileIn = h('input', { type: 'file', accept: 'image/*', hidden: true, onchange: async (e) => {
        const f = e.target.files[0]; if (!f) return;
        try {
          d.cover = { type: 'photo', data: await photoFromFile(f) };
          touch(); paintCover(); closeSheet();
        } catch { toast('無法讀取這張圖片'); }
      } });
      setKids(body,
        h('button', { class: 'sheet-item', onclick: () => fileIn.click() }, icon('image', { size: 22 }), '從相簿選擇照片'),
        d.cover ? h('button', { class: 'sheet-item', onclick: () => { d.cover = null; touch(); paintCover(); closeSheet(); } }, icon('refresh', { size: 22 }), '改回自動挑選圖示') : null,
        h('div', { class: 'tp-title' }, '預設圖示'),
        h('div', { class: 'icon-grid' }, Object.entries(COVER_ICONS).map(([id, c]) =>
          h('button', { class: 'ig' + (d.cover && d.cover.type === 'icon' && d.cover.id === id ? ' sel' : ''), 'aria-label': c.name,
            onclick: () => { d.cover = { type: 'icon', id }; touch(); paintCover(); closeSheet(); } }, coverSvg(id)))),
        fileIn);
    }, '封面');
  }

  /* ----- 備料 ----- */
  function drawIngs(focusLast) {
    ingBox.replaceChildren(
      ...d.ingredients.map((ing, i) => {
        const pill = h('div', { class: 'pill c-' + catOf(ing.name.trim().toLowerCase()), 'data-i': i },
          h('button', { class: 'grip', 'aria-label': '拖曳排序', tabindex: -1 }, icon('grip', { size: 16 })),
          h('input', { class: 'pn', type: 'text', placeholder: '食材', maxlength: 30, value: ing.name, oninput: (e) => {
            ing.name = e.target.value; touch();
            pill.className = 'pill c-' + catOf(ing.name.trim().toLowerCase());
            if (!d.cover) paintCover();
          } }),
          h('input', { class: 'pa', type: 'text', inputmode: 'decimal', placeholder: '數量', maxlength: 8, value: ing.amount, oninput: (e) => { ing.amount = e.target.value; touch(); } }),
          h('select', { onchange: (e) => { ing.unit = e.target.value; touch(); } }, UNITS.map((u) => h('option', { value: u, selected: u === ing.unit }, u))),
          h('button', { class: 'x', 'aria-label': '移除食材', onclick: () => {
            d.ingredients.splice(i, 1); if (!d.ingredients.length) d.ingredients.push({ name: '', amount: '', unit: '克' }); touch(); drawIngs(); paintCover();
          } }, icon('close', { size: 14, sw: 2.4 })));
        return pill;
      }),
      h('button', { class: 'pill addpill', onclick: () => { d.ingredients.push({ name: '', amount: '', unit: '克' }); touch(); drawIngs(true); } },
        icon('plus', { size: 15, sw: 2.2 }), '食材'));
    if (focusLast) { const ins = ingBox.querySelectorAll('.pn'); ins[ins.length - 1].focus(); }
  }

  /* ----- 步驟：計時框（可編輯，放在步驟框裡） ----- */
  function editTimer(s) {
    const box = h('div', { class: 'tbox edit' });
    function draw() {
      box.classList.toggle('empty', !s.timer);
      if (!s.timer) {
        box.onclick = (e) => { e.stopPropagation(); s.timer = true; s.seconds = s.seconds || 60; touch(); draw(); };
        box.replaceChildren(icon('clock', { size: 20 }), h('div', {}, '計時'));
        return;
      }
      box.onclick = null;
      const mm = h('input', { class: 'tin', type: 'text', inputmode: 'numeric', maxlength: 3, 'aria-label': '分鐘', value: String(Math.floor(s.seconds / 60)).padStart(2, '0') });
      const ss = h('input', { class: 'tin', type: 'text', inputmode: 'numeric', maxlength: 2, 'aria-label': '秒', value: String(s.seconds % 60).padStart(2, '0') });
      const sync = () => { s.seconds = Math.max(1, Math.min(86400, (parseInt(mm.value, 10) || 0) * 60 + Math.min(59, parseInt(ss.value, 10) || 0))); touch(); };
      const norm = () => { mm.value = String(Math.floor(s.seconds / 60)).padStart(2, '0'); ss.value = String(s.seconds % 60).padStart(2, '0'); };
      [mm, ss].forEach((el) => { el.addEventListener('input', sync); el.addEventListener('blur', norm); el.addEventListener('focus', () => el.select()); });
      box.replaceChildren(
        icon('clock', { size: 16 }),
        h('div', { class: 'trow-in' }, mm, ':', ss),
        h('button', { class: 'tclose', 'aria-label': '取消計時', onclick: (e) => { e.stopPropagation(); s.timer = false; touch(); draw(); } }, icon('close', { size: 13, sw: 2.4 })));
    }
    draw();
    return box;
  }

  /* ----- 步驟列表 ----- */
  function paintCur() {
    d.cur = Math.max(0, Math.min(d.steps.length - 1, d.cur));
    rows.forEach((el, k) => { el.classList.toggle('current', k === d.cur); el.classList.toggle('done', k < d.cur); });
  }
  function move(i, dir) {
    const j = i + dir;
    if (j < 0 || j >= d.steps.length) return;
    [d.steps[i], d.steps[j]] = [d.steps[j], d.steps[i]];
    d.cur = j; touch(); drawSteps(j);
  }
  function drawSteps(focusIdx) {
    rows = d.steps.map((s, i) => {
      const ta = h('textarea', { rows: 1, placeholder: '這一步要做什麼…', maxlength: 500, value: s.text,
        oninput: (e) => { s.text = e.target.value; fit(e.target); touch(); } });
      const acts = h('div', { class: 'nacts' },
        h('button', { class: 'grip', 'aria-label': '拖曳排序', tabindex: -1 }, icon('grip', { size: 18 })),
        h('span', { class: 'nsp' }),
        h('button', { class: 'opt-btn' + (s.optional ? ' on' : ''), 'aria-pressed': String(!!s.optional), onclick: (e) => {
          e.stopPropagation();
          s.optional = !s.optional; if (s.optional) s.timer = false; // 選填步驟沒有計時
          touch(); drawSteps();
        } }, '選填'),
        h('button', { 'aria-label': '上移', disabled: i === 0, onclick: (e) => { e.stopPropagation(); move(i, -1); } }, icon('up', { size: 18 })),
        h('button', { 'aria-label': '下移', disabled: i === d.steps.length - 1, onclick: (e) => { e.stopPropagation(); move(i, 1); } }, icon('down', { size: 18 })),
        h('button', { 'aria-label': '刪除步驟', onclick: (e) => {
          e.stopPropagation();
          d.steps.splice(i, 1); if (!d.steps.length) d.steps.push({ text: '', timer: false, seconds: 60 });
          d.cur = Math.min(d.cur, d.steps.length - 1); touch(); drawSteps();
        } }, icon('trash', { size: 17 })));
      const node = h('div', { class: 'node edit' + (s.optional ? ' optional' : ''), onfocusin: () => { d.cur = i; paintCur(); }, onclick: (e) => { if (!e.target.closest('.tbox,.nacts')) ta.focus(); } },
        h('div', { class: 'nmain' }, ta, acts), s.optional ? null : editTimer(s));
      const row = timelineRow(node, s.optional ? 'opt' : '');
      row.dataset.i = i;
      return row;
    });
    const addRow = timelineRow(
      h('button', { class: 'node', onclick: () => { d.steps.push({ text: '', timer: false, seconds: 60 }); d.cur = d.steps.length - 1; touch(); drawSteps(d.cur); } },
        icon('plus', { size: 18 }), '新增步驟'), 'add');
    tl.replaceChildren(...rows, addRow);
    tl.querySelectorAll('textarea').forEach(fit);
    paintCur();
    if (focusIdx != null) tl.querySelectorAll('textarea')[focusIdx]?.focus();
  }

  /* ----- 儲存 ----- */
  const collect = () => normalize({
    id: d.id || uid(), cloudId: d.cloudId, createdAt: d.createdAt || undefined, title: d.title, cover: d.cover,
    extraTags: d.extraTags.split(/[\s,，、]+/).filter(Boolean), ingredients: d.ingredients, steps: d.steps,
  });
  async function save() {
    const r = collect();
    if (!r.title) return toast('請輸入料理名稱');
    if (!r.ingredients.length) return toast('至少需要一項食材');
    if (!r.steps.length) return toast('至少需要一個步驟');
    Local.upsert(r);
    let msg = '已儲存';
    if (d.publish && CLOUD_ON && !r.cloudId) {
      try {
        toast('上傳中…');
        r.cloudId = await Cloud.publish(r);
        Local.upsert(r);
        await loadCloud();
        msg = '已儲存並發布';
      } catch (e) { msg = '已儲存在本機，上傳失敗：' + e.message; }
    }
    S.draft = null; page.replaceChildren();
    Home.tags = []; // 清掉篩選，才看得到剛存的食譜
    goTab('home');
    toast(msg);
  }
  function discard() {
    if (d.dirty && !confirm('放棄目前編輯的內容？')) return;
    S.draft = null; page.replaceChildren();
    goTab('home');
  }

  const publishRow = h('div', { class: 'switch-row' },
    h('div', {}, '發布到雲端', h('small', {}, !CLOUD_ON ? '尚未設定雲端' : d.cloudId ? '已發布，雲端版本不會被更新' : '所有人都能搜尋到這份食譜')),
    h('input', { class: 'switch', type: 'checkbox', 'aria-label': '發布到雲端', checked: d.publish && CLOUD_ON && !d.cloudId, disabled: !CLOUD_ON || !!d.cloudId,
      onchange: (e) => { d.publish = e.target.checked; } }));

  page.append(
    h('div', { class: 'hdr' },
      h('button', { class: 'icon-btn', 'aria-label': '放棄', onclick: discard }, icon('close', { size: 24, sw: 2.2 })),
      h('h1', {}, d.id ? '編輯食譜' : '新增食譜'),
      h('button', { class: 'text-btn strong', onclick: save }, '儲存')),
    h('div', { class: 'scroll doc' },
      h('div', { class: 'title-row' }, coverBtn,
        h('input', { class: 'title-input', type: 'text', maxlength: 60, placeholder: '料理名稱', value: d.title, oninput: (e) => { d.title = e.target.value; touch(); if (!d.cover) paintCover(); } })),
      h('div', { class: 'sec-label' }, '備料'),
      ingBox,
      h('input', { class: 'line-input', type: 'text', placeholder: '額外標籤（選填，空白分隔，例如：快速 便當）', value: d.extraTags, oninput: (e) => { d.extraTags = e.target.value; touch(); } }),
      h('div', { class: 'sec-label' }, '步驟'),
      tl,
      publishRow));
  drawIngs();
  drawSteps();
  paintCover();

  /* ----- 拖曳排序：備料標籤、步驟 ----- */
  const getScroller = () => $('.scroll', page);
  enableSort({ container: ingBox, itemSel: '.pill[data-i]', handleSel: '.grip', mode: 'flow', getScroller,
    onDrop: (order) => { d.ingredients = order.map((k) => d.ingredients[k]); touch(); drawIngs(); } });
  enableSort({ container: tl, itemSel: '.trow[data-i]', handleSel: '.grip', mode: 'y', getScroller,
    onDrop: (order) => {
      const curStep = d.steps[d.cur];
      d.steps = order.map((k) => d.steps[k]);
      d.cur = Math.max(0, d.steps.indexOf(curStep));
      touch(); drawSteps();
    } });
}

/* ---------- 啟動 ---------- */
document.addEventListener('keydown', (e) => { if (e.key === 'Escape') closeSheet(); });
(async function init() {
  buildTabbar();
  buildSearch();
  goTab('home');
  await loadCloud();
  refreshViews();
})();
