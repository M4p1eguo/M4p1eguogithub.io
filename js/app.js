'use strict';

/* ================= 工具函数 ================= */
function esc(s) {
  return String(s == null ? '' : s).replace(/[&<>"']/g, function (c) {
    return { '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c];
  });
}
function pad2(n) { return String(n).padStart(2, '0'); }
function todayStr() {
  const d = new Date();
  return d.getFullYear() + '-' + pad2(d.getMonth() + 1) + '-' + pad2(d.getDate());
}
function parseDate(s) {
  const p = String(s).split('-').map(Number);
  return new Date(p[0], p[1] - 1, p[2]);
}
function daysUntil(dateStr) {
  const t = parseDate(dateStr); t.setHours(0, 0, 0, 0);
  const n = new Date(); n.setHours(0, 0, 0, 0);
  return Math.round((t - n) / 86400000);
}
function weekdayCN() { return ['日', '一', '二', '三', '四', '五', '六'][new Date().getDay()]; }
function money(n) {
  return '¥' + Number(n || 0).toLocaleString('zh-CN', { minimumFractionDigits: 0, maximumFractionDigits: 2 });
}
function getSettings() {
  return Object.assign({}, DEFAULTS.settings, DB.get('settings', {}));
}

/* ================= 数据层 =================
 * 每个人的数据都存在自己设备的浏览器 localStorage（互不干扰）。
 * 云端 content.json 只存"公共配置"（应用名/问候语/发薪日/热点等），
 * 每次打开网页都会拉取，让新设备自动带上这些初始内容。
 */
const DB = {
  async init() {
    /* 拉取云端公共配置，应用到本机（个人记录不会被动） */
    try {
      const res = await fetch('content.json', { cache: 'no-store' });
      if (res.ok) {
        const data = await res.json();
        if (data && typeof data === 'object') {
          if (data.settings && typeof data.settings === 'object') {
            Store.set('settings', Object.assign({}, DEFAULTS.settings, Store.get('settings', {}), data.settings));
          }
          if (data.hotTopics && typeof data.hotTopics === 'object') {
            Store.set('hotTopics', data.hotTopics);
          }
        }
      }
    } catch (e) { /* 本地模式（比如直接双击打开时） */ }
  },
  get(key, fallback) {
    return Store.get(key, fallback);
  },
  set(key, val) {
    Store.set(key, val);
  },
  exportData() {
    const out = {};
    CONTENT_KEYS.forEach(k => {
      const v = Store.get(k);
      if (v !== null && v !== undefined) out[k] = v;
    });
    out.settings = getSettings();
    return out;
  },
  importData(data) {
    if (data && typeof data === 'object') {
      CONTENT_KEYS.forEach(k => { if (k in data) Store.set(k, data[k]); });
    }
  }
};

/* ================= 后台登录 =================
 * 密码与 GitHub Token 只保存在你自己浏览器的 localStorage，
 * 不会进入网页代码，也不会被同步到 GitHub。
 */
const AUTH = { loggedIn: false };
function authInfo() { return Store.get('auth', { pass: '', token: '', repo: '' }); }
function adminLogin(pw) {
  const a = authInfo();
  if (!a.pass) {
    a.pass = pw;
    Store.set('auth', a);
    AUTH.loggedIn = true;
    sessionStorage.setItem('dadDaily.admin', '1');
    return true;
  }
  if (a.pass === pw) {
    AUTH.loggedIn = true;
    sessionStorage.setItem('dadDaily.admin', '1');
    return true;
  }
  return false;
}
function adminLogout() {
  AUTH.loggedIn = false;
  sessionStorage.removeItem('dadDaily.admin');
  render();
}
function adminChangePassword(newPw) {
  const a = authInfo();
  a.pass = newPw;
  Store.set('auth', a);
}
function ifAdmin(html) { return AUTH.loggedIn ? html : ''; }

/* 小提示 */
let toastTimer = null;
function toast(msg) {
  let el = document.getElementById('toast');
  if (!el) {
    el = document.createElement('div');
    el.id = 'toast';
    document.body.appendChild(el);
  }
  el.textContent = msg;
  el.classList.add('show');
  clearTimeout(toastTimer);
  toastTimer = setTimeout(function () { el.classList.remove('show'); }, 2600);
}

/* 隐藏入口：连续点 5 下左上角应用名进入后台 */
let nameTaps = 0, nameTapTimer = null;
function onNameTap() {
  nameTaps++;
  clearTimeout(nameTapTimer);
  nameTapTimer = setTimeout(function () { nameTaps = 0; }, 1500);
  if (nameTaps >= 5) {
    nameTaps = 0;
    goPage('admin');
  }
}

/* 修改头像：任何人都可以换自己的头像（只影响自己这台设备） */
function changeAvatar() {
  const input = document.createElement('input');
  input.type = 'file';
  input.accept = 'image/*';
  input.onchange = function () {
    const f = input.files && input.files[0];
    if (!f) return;
    if (f.size > 3 * 1024 * 1024) { alert('图片太大，请选 3MB 以内的'); return; }
    const reader = new FileReader();
    reader.onload = function () {
      Store.set('avatar', reader.result);
      toast('头像已更新');
      render();
    };
    reader.readAsDataURL(f);
  };
  input.click();
}
function restoreAvatar() {
  Store.set('avatar', '');
  toast('已恢复默认头像');
  render();
}

/* ================= 核心数据计算 ================= */
function luckyNumber() {
  const s = todayStr().replace(/-/g, '');
  let h = 7;
  for (let i = 0; i < s.length; i++) h = (h * 31 + s.charCodeAt(i)) >>> 0;
  const max = Number(getSettings().luckyMax) || 99;
  return h % (max + 1);
}

function paydayInfo() {
  const payday = Number(getSettings().payday) || 30;
  const n = new Date();
  const y = n.getFullYear(), m = n.getMonth();
  const startOfToday = new Date(y, m, n.getDate());
  let target = new Date(y, m, Math.min(payday, new Date(y, m + 1, 0).getDate()));
  if (target < startOfToday) {
    const nm = (m + 1) % 12, ny = m === 11 ? y + 1 : y;
    target = new Date(ny, nm, Math.min(payday, new Date(ny, nm + 1, 0).getDate()));
  }
  return {
    days: Math.round((target - startOfToday) / 86400000),
    dateStr: target.getFullYear() + '-' + pad2(target.getMonth() + 1) + '-' + pad2(target.getDate())
  };
}

function planProgress() {
  const tasks = DB.get('tasks', []);
  const today = todayStr();
  const done = tasks.filter(t => t.doneDates && t.doneDates[today]).length;
  return { done: done, total: tasks.length };
}

function todayExpense() {
  return DB.get('ledger', [])
    .filter(r => r.date === todayStr() && r.type === 'expense')
    .reduce((s, r) => s + Number(r.amount || 0), 0);
}
function monthExpense() {
  const ym = todayStr().slice(0, 7);
  return DB.get('ledger', [])
    .filter(r => r.date.slice(0, 7) === ym && r.type === 'expense')
    .reduce((s, r) => s + Number(r.amount || 0), 0);
}

function exerciseToday() {
  return DB.get('exercise', [])
    .filter(r => r.date === todayStr())
    .reduce((s, r) => s + Number(r.minutes || 0), 0);
}
function exerciseWeek() {
  return DB.get('exercise', [])
    .filter(r => { const l = daysUntil(r.date); return l <= 0 && l > -7; })
    .reduce((s, r) => s + Number(r.minutes || 0), 0);
}

function mealTodayCount() {
  const today = todayStr();
  const set = new Set(DB.get('meals', []).filter(m => m.date === today).map(m => m.meal));
  return set.size;
}
function waterToday() {
  const w = DB.get('water', {});
  return w[todayStr()] || 0;
}

function waistToday() {
  return DB.get('waist', []).filter(x => x.date === todayStr())[0] || null;
}
function waistWeekCount() {
  return DB.get('waist', []).filter(x => { const l = daysUntil(x.date); return l <= 0 && l > -7; }).length;
}

function importantReminders() {
  return DB.get('importantDates', [])
    .map(d => ({ id: d.id, name: d.name, date: d.date, left: daysUntil(d.date), remindDays: Number(d.remindDays) || 7 }))
    .filter(d => d.left <= d.remindDays)
    .sort((a, b) => a.left - b.left);
}

/* ================= 路由（工作台：左栏切换右侧中间区域） ================= */
const state = { current: 'plan' };
function goPage(k) {
  state.current = k;
  render();
}

function render() {
  const app = document.getElementById('app');
  app.innerHTML = workbenchHTML();
  const content = document.getElementById('content');
  const key = state.current;
  if (key === 'settings' && !AUTH.loggedIn) {
    content.innerHTML = adminLoginBody();
    bindAdminLogin();
    window.scrollTo(0, 0);
    return;
  }
  const page = PAGES[key];
  if (page) {
    content.innerHTML = '<div class="content-head"><h2>' + esc(page.title) + '</h2></div>' + page.body();
    if (page.bind) page.bind();
  } else {
    content.innerHTML = '<div class="empty-tip">从左侧选择一个功能开始</div>';
  }
  content.scrollTop = 0;
  window.scrollTo(0, 0);
}

/* ================= 工作台框架 ================= */
function sidebarItems(memoCount, dateCount) {
  const items = [
    ['plan', '📋', '每日计划'],
    ['ledger', '💰', '记账'],
    ['memo', '📝', '备忘录', memoCount],
    ['dates', '📅', '重要日期', dateCount],
    ['waist', '📏', '每日腰围'],
    ['meals', '🍽️', '饮食'],
    ['exercise', '💪', '运动'],
    ['health', '❤️', '健康'],
    ['review', '🔄', '复盘'],
    ['lucky', '🍀', '幸运数']
  ];
  return items.map(it => {
    const k = it[0], ico = it[1], name = it[2], count = it[3];
    return `<div class="nav-item ${state.current === k ? 'on' : ''}" onclick="goPage('${k}')">
      <div class="ni-ico">${ico}</div>
      <div class="ni-name">${name}</div>
      ${count !== undefined ? '<div class="ni-count">' + count + '</div>' : ''}
    </div>`;
  }).join('');
}

function bottomHTML() {
  const ht = DB.get('hotTopics', DEFAULTS.hotTopics);
  const tab = Store.get('hotTab', 'uc');
  const list = (tab === 'uc' ? ht.uc : ht.douyin) || [];
  const key = tab === 'uc' ? 'hot' : 'views';
  const items = list.slice(0, 2).map((x, i) => `<li>
    <span class="hot-rank">${i + 1}</span>
    <span class="hot-title">${esc(x.title)}</span>
    <span class="hot-val">${esc(x[key] || '')}</span>
  </li>`).join('');
  return `<div class="hot compact">
    <div class="hot-head">
      <span class="t">每日热点</span>
      <div class="hot-tabs">
        <span class="${tab === 'uc' ? 'on' : ''}" onclick="setHotTab('uc')">UC</span>
        <span class="${tab === 'douyin' ? 'on' : ''}" onclick="setHotTab('douyin')">抖音</span>
      </div>
      <span class="ph-btn" style="margin-left:8px" onclick="goPage('hot')">更多</span>
    </div>
    <ul class="hot-list">${items || '<li class="hot-empty">暂无内容</li>'}</ul>
  </div>`;
}

function workbenchHTML() {
  const s = getSettings();
  const parts = todayStr().split('-').map(Number);
  const pd = paydayInfo();
  const prog = planProgress();
  const pct = prog.total ? Math.round(prog.done / prog.total * 100) : 0;
  const memos = DB.get('memos', []);
  const dates = DB.get('importantDates', []);
  const reminders = importantReminders();
  const remindHTML = reminders.length ? `<div class="remind slim">
    📌 ${reminders.slice(0, 2).map(r => {
      const t = r.left === 0 ? '今天到期' : r.left > 0 ? '还有 <b>' + r.left + '</b> 天' : '已过期 <b>' + (-r.left) + '</b> 天';
      return esc(r.name) + ' ' + t;
    }).join('　')}
    <span class="hot-val" style="cursor:pointer" onclick="goPage('dates')">去查看 ›</span>
  </div>` : '';
  return `
  <div class="workbench">
    <aside class="sidebar">
      <div class="brand" onclick="onNameTap()">${esc(s.appName)}</div>
      <nav class="nav">${sidebarItems(memos.length, dates.length)}</nav>
      ${AUTH.loggedIn ? '<div class="side-foot"><div class="side-item" onclick="goPage(\'settings\')">⚙️ 设置</div></div>' : ''}
    </aside>
    <div class="main">
      <div class="top-area">
        <div class="top-hero">
          <img class="avatar" src="${Store.get('avatar') || '图片/avatar.jpg'}" alt="头像" onclick="changeAvatar()">
          <div class="th-info">
            <div class="th-date">${pad2(parts[1])} / ${pad2(parts[2])} · 星期${weekdayCN()} · ${parts[0]}</div>
            <div class="th-greet">${esc(s.greeting)}</div>
          </div>
          <div class="th-pay">💰 距发薪 ${pd.days} 天</div>
        </div>
        <div class="plan-card compact" onclick="goPage('plan')">
          <div class="pc-top">
            <span class="pc-title">今日计划</span>
            <span class="pc-pct">${pct}%</span>
          </div>
          <div class="pc-sub">已完成 ${prog.done} / ${prog.total} 项 · 进度 ${pct}%</div>
          <div class="pc-bar"><i style="width:${pct}%"></i></div>
        </div>
        ${remindHTML}
      </div>
      <div class="content" id="content"></div>
      <div class="bottom-area">${bottomHTML()}</div>
    </div>
  </div>`;
}

/* ================= 子页面模板（内容区由工作台框架统一渲染） ================= */

/* ---------- 每日计划 ---------- */
function planHTML() {
  const tasks = DB.get('tasks', []);
  const today = todayStr();
  const prog = planProgress();
  const pct = prog.total ? Math.round(prog.done / prog.total * 100) : 0;
  const items = tasks.map(t => {
    const done = !!(t.doneDates && t.doneDates[today]);
    return `<div class="item">
      <div class="check ${done ? 'on' : ''}" onclick="toggleTask('${t.id}')">${done ? '✓' : ''}</div>
      <div class="it-main">
        <div class="it-title" style="${done ? 'text-decoration:line-through;color:#9AA39C;' : ''}">${esc(t.text)}</div>
        <div class="it-sub">${done ? '已完成' : '待完成'}</div>
      </div>
      <div class="del" onclick="delTask('${t.id}')">✕</div>
    </div>`;
  }).join('');
  return `
    <div class="card">
      <h2>今日进度</h2>
      <div class="pc-top" style="margin-top:8px">
        <span class="pc-sub">已完成 ${prog.done} / ${prog.total} 项</span>
        <span class="pc-pct" style="font-size:24px">${pct}%</span>
      </div>
      <div class="pc-bar"><i style="width:${pct}%"></i></div>
    </div>
    <div class="card">
      <h2>添加任务</h2>
      <div style="display:flex;gap:8px;margin-top:10px">
        <input class="field" id="task-input" placeholder="今天要做什么？">
        <button class="btn mini" id="task-add" style="flex-shrink:0">添加</button>
      </div>
    </div>
    <div class="card"><h2>任务列表（${tasks.length}）</h2>
      ${items || '<div class="hot-empty">还没有任务</div>'}
    </div>`;
}
function toggleTask(id) {
  const tasks = DB.get('tasks', []);
  const t = tasks.find(x => x.id === id);
  if (!t) return;
  if (!t.doneDates) t.doneDates = {};
  t.doneDates[todayStr()] = !t.doneDates[todayStr()];
  DB.set('tasks', tasks);
  render();
}
function delTask(id) {
  DB.set('tasks', DB.get('tasks', []).filter(x => x.id !== id));
  render();
}
function bindPlan() {
  const btn = document.getElementById('task-add');
  const inp = document.getElementById('task-input');
  const add = () => {
    const v = (inp.value || '').trim();
    if (!v) return;
    const tasks = DB.get('tasks', []);
    tasks.push({ id: Store.uid(), text: v, doneDates: {} });
    DB.set('tasks', tasks);
    render();
  };
  if (btn) btn.onclick = add;
  if (inp) inp.addEventListener('keydown', e => { if (e.key === 'Enter') add(); });
}

/* ---------- 记账 ---------- */
function ledgerHTML() {
  const ledger = DB.get('ledger', []);
  const today = todayStr();
  const groups = {};
  ledger.slice().sort((a, b) => b.date.localeCompare(a.date)).forEach(r => {
    (groups[r.date] = groups[r.date] || []).push(r);
  });
  const listHTML = Object.keys(groups).map(date => {
    const rows = groups[date].map(r => `<div class="item">
      <div class="it-main">
        <div class="it-title">${esc(r.category)}${r.note ? ' · ' + esc(r.note) : ''}</div>
        <div class="it-sub">${r.type === 'expense' ? '支出' : '收入'}</div>
      </div>
      <div class="it-val ${r.type === 'expense' ? 'up' : 'down'}">${r.type === 'expense' ? '-' : '+'}${money(r.amount)}</div>
      <div class="del" onclick="delLedger('${r.id}')">✕</div>
    </div>`).join('');
    return `<div class="list-date">${date === today ? '今天 · ' : ''}${date}</div>${rows}`;
  }).join('');
  return `
    <div class="sum">
      <div class="s"><div class="k">今日支出</div><div class="v" style="color:#E0665C">${money(todayExpense())}</div></div>
      <div class="s"><div class="k">本月支出</div><div class="v">${money(monthExpense())}</div></div>
    </div>
    <div class="card">
      <h2>记一笔</h2>
      <div class="frow">
        <div><label class="lbl">类型</label>
          <select class="field" id="lg-type"><option value="expense">支出</option><option value="income">收入</option></select></div>
        <div><label class="lbl">金额</label><input class="field" id="lg-amount" type="number" min="0" step="0.01" placeholder="0.00"></div>
      </div>
      <div class="frow">
        <div><label class="lbl">分类</label>
          <select class="field" id="lg-cat">${DEFAULTS.categories.map(c => '<option>' + c + '</option>').join('')}</select></div>
        <div><label class="lbl">日期</label><input class="field" id="lg-date" type="date" value="${today}"></div>
      </div>
      <label class="lbl">备注</label>
      <input class="field" id="lg-note" placeholder="可选">
      <button class="btn" id="lg-add">保存</button>
    </div>
    <div class="card"><h2>收支明细</h2>
      ${listHTML || '<div class="hot-empty">还没有记录</div>'}
    </div>`;
}
function delLedger(id) {
  DB.set('ledger', DB.get('ledger', []).filter(x => x.id !== id));
  render();
}
function bindLedger() {
  const add = () => {
    const amount = Number(document.getElementById('lg-amount').value);
    if (!amount || amount <= 0) { alert('请填写正确的金额'); return; }
    const ledger = DB.get('ledger', []);
    ledger.push({
      id: Store.uid(),
      type: document.getElementById('lg-type').value,
      amount: amount,
      category: document.getElementById('lg-cat').value,
      note: document.getElementById('lg-note').value.trim(),
      date: document.getElementById('lg-date').value || todayStr()
    });
    DB.set('ledger', ledger);
    render();
  };
  const btn = document.getElementById('lg-add');
  if (btn) btn.onclick = add;
}

/* ---------- 今日幸运数 ---------- */
function luckyHTML() {
  const n = luckyNumber();
  return `
    <div class="lucky-hero">
      <div class="lucky-num">${n}</div>
      <div class="lucky-note">今日幸运数 · 每日自动更新<br>范围 0 - ${Number(getSettings().luckyMax) || 99}，把幸运数用在今天的选择上吧 🍀</div>
    </div>
    <div class="card">
      <h2>使用建议</h2>
      <p style="font-size:13px;color:#5B675F;line-height:1.9;margin-top:8px">
        比如：用这个数字决定今天喝几杯水、走几层楼梯、挑哪个口味的午饭……<br>
        当然，最重要的是记得喝水 💧
      </p>
    </div>`;
}

/* ---------- 备忘录 ---------- */
let memoEditId = null;
function memoHTML() {
  const memos = DB.get('memos', []).slice().sort((a, b) => (b.updatedAt || '').localeCompare(a.updatedAt || ''));
  const items = memos.map(m => `<div class="item">
    <div class="it-main">
      <div class="it-title">${esc(m.title) || '（无标题）'}</div>
      <div class="it-sub">${esc((m.content || '').slice(0, 40))}${(m.content || '').length > 40 ? '…' : ''} · ${(m.updatedAt || '').slice(0, 10)}</div>
    </div>
    <div class="act" onclick="editMemo('${m.id}')">编辑</div>
    <div class="del" onclick="delMemo('${m.id}')">✕</div>
  </div>`).join('');
  const edit = memoEditId ? DB.get('memos', []).find(m => m.id === memoEditId) : null;
  return `
    <div class="card">
      <h2>${edit ? '编辑备忘录' : '新建备忘录'}</h2>
      <label class="lbl">标题</label>
      <input class="field" id="memo-title" value="${edit ? esc(edit.title) : ''}" placeholder="备忘标题">
      <label class="lbl">内容</label>
      <textarea class="field" id="memo-content" rows="4" placeholder="写点什么…">${edit ? esc(edit.content) : ''}</textarea>
      <button class="btn" id="memo-save">${edit ? '保存修改' : '保存'}</button>
      ${edit ? '<button class="btn ghost" id="memo-cancel" style="margin-top:8px">取消编辑</button>' : ''}
    </div>
    <div class="card"><h2>全部备忘（${memos.length}）</h2>
      ${items || '<div class="hot-empty">还没有备忘</div>'}
    </div>`;
}
function editMemo(id) { memoEditId = id; render(); }
function delMemo(id) {
  DB.set('memos', DB.get('memos', []).filter(x => x.id !== id));
  if (memoEditId === id) memoEditId = null;
  render();
}
function bindMemo() {
  const save = () => {
    const title = document.getElementById('memo-title').value.trim();
    const content = document.getElementById('memo-content').value.trim();
    if (!title && !content) { alert('写点内容再保存吧'); return; }
    const memos = DB.get('memos', []);
    const now = new Date().toISOString();
    if (memoEditId) {
      const m = memos.find(x => x.id === memoEditId);
      if (m) { m.title = title; m.content = content; m.updatedAt = now; }
      memoEditId = null;
    } else {
      memos.push({ id: Store.uid(), title: title, content: content, updatedAt: now });
    }
    DB.set('memos', memos);
    render();
  };
  const btn = document.getElementById('memo-save');
  if (btn) btn.onclick = save;
  const cancel = document.getElementById('memo-cancel');
  if (cancel) cancel.onclick = () => { memoEditId = null; render(); };
}

/* ---------- 重要日期 ---------- */
function datesHTML() {
  const dates = DB.get('importantDates', []).slice().sort((a, b) => a.date.localeCompare(b.date));
  const items = dates.map(d => {
    const left = daysUntil(d.date);
    const badge = left === 0
      ? '<span class="badge warn">今天到期</span>'
      : left > 0
        ? (left <= (Number(d.remindDays) || 7) ? '<span class="badge warn">还剩 ' + left + ' 天</span>' : '<span class="badge ok">还剩 ' + left + ' 天</span>')
        : '<span class="badge err">已过期 ' + (-left) + ' 天</span>';
    return `<div class="item">
      <div class="it-main">
        <div class="it-title">${esc(d.name)}</div>
        <div class="it-sub">${d.date} · 提前 ${Number(d.remindDays) || 7} 天提醒</div>
      </div>
      ${badge}
      <div class="del" onclick="delDate('${d.id}')">✕</div>
    </div>`;
  }).join('');
  return `
    <div class="card">
      <h2>添加日期</h2>
      <label class="lbl">名称</label>
      <input class="field" id="dt-name" placeholder="如：还花呗、纪念日、体检">
      <div class="frow">
        <div><label class="lbl">日期</label><input class="field" id="dt-date" type="date" value="${todayStr()}"></div>
        <div><label class="lbl">提前提醒（天）</label><input class="field" id="dt-remind" type="number" min="0" value="7"></div>
      </div>
      <button class="btn" id="dt-add">保存</button>
    </div>
    <div class="card"><h2>日期列表（${dates.length}）</h2>
      ${items || '<div class="hot-empty">还没有重要日期</div>'}
    </div>`;
}
function delDate(id) {
  DB.set('importantDates', DB.get('importantDates', []).filter(x => x.id !== id));
  render();
}
function bindDates() {
  const add = () => {
    const name = document.getElementById('dt-name').value.trim();
    const date = document.getElementById('dt-date').value;
    if (!name) { alert('请填写名称'); return; }
    if (!date) { alert('请选择日期'); return; }
    const dates = DB.get('importantDates', []);
    dates.push({ id: Store.uid(), name: name, date: date, remindDays: Number(document.getElementById('dt-remind').value) || 7 });
    DB.set('importantDates', dates);
    render();
  };
  const btn = document.getElementById('dt-add');
  if (btn) btn.onclick = add;
}

/* ---------- 每日腰围 ---------- */
function waistHTML() {
  const recs = DB.get('waist', []).slice().sort((a, b) => b.date.localeCompare(a.date));
  const today = todayStr();
  const items = recs.map(r => `<div class="item">
    <div class="it-main">
      <div class="it-title">${r.date} ${r.date === today ? '<span class="badge ok">今天</span>' : ''}</div>
      <div class="it-sub">腰围</div>
    </div>
    <div class="it-val">${r.cm} cm</div>
    <div class="del" onclick="delWaist('${r.id}')">✕</div>
  </div>`).join('');
  return `
    <div class="sum">
      <div class="s"><div class="k">今日腰围</div><div class="v">${waistToday() ? waistToday().cm + ' cm' : '未记录'}</div></div>
      <div class="s"><div class="k">本周记录</div><div class="v">${waistWeekCount()} 次</div></div>
    </div>
    <div class="card">
      <h2>记录腰围</h2>
      <div class="frow">
        <div><label class="lbl">日期</label><input class="field" id="waist-date" type="date" value="${today}"></div>
        <div><label class="lbl">腰围（cm）</label><input class="field" id="waist-cm" type="number" step="0.1" min="0" placeholder="如 82.5"></div>
      </div>
      <button class="btn" id="waist-add">保存（同一天会覆盖）</button>
    </div>
    <div class="card"><h2>历史记录</h2>
      ${items || '<div class="hot-empty">还没有记录</div>'}
    </div>`;
}
function delWaist(id) {
  DB.set('waist', DB.get('waist', []).filter(x => x.id !== id));
  render();
}
function bindWaist() {
  const add = () => {
    const cm = Number(document.getElementById('waist-cm').value);
    const date = document.getElementById('waist-date').value || todayStr();
    if (!cm || cm <= 0) { alert('请填写正确的腰围'); return; }
    let recs = DB.get('waist', []);
    recs = recs.filter(x => x.date !== date);
    recs.push({ id: Store.uid(), date: date, cm: cm });
    DB.set('waist', recs);
    render();
  };
  const btn = document.getElementById('waist-add');
  if (btn) btn.onclick = add;
}

/* ---------- 饮食记录 ---------- */
function mealsHTML() {
  const meals = DB.get('meals', []).slice().sort((a, b) => b.date.localeCompare(a.date));
  const today = todayStr();
  const items = meals.map(m => `<div class="item">
    <div class="it-main">
      <div class="it-title">${m.meal} · ${esc(m.content)}</div>
      <div class="it-sub">${m.date}${m.date === today ? ' · 今天' : ''}</div>
    </div>
    <div class="del" onclick="delMeal('${m.id}')">✕</div>
  </div>`).join('');
  return `
    <div class="sum">
      <div class="s"><div class="k">今日已记</div><div class="v">${mealTodayCount()} 餐</div></div>
      <div class="s">
        <div class="k">今日喝水</div><div class="v">${waterToday()} 杯</div>
        <div style="margin-top:8px">
          <button class="btn mini" onclick="waterAdd(1)">+1 杯</button>
          <button class="btn mini ghost" onclick="waterAdd(-99)" style="margin-left:6px">清零</button>
        </div>
      </div>
    </div>
    <div class="card">
      <h2>记录一餐</h2>
      <div class="frow">
        <div><label class="lbl">餐次</label>
          <select class="field" id="meal-type">${DEFAULTS.mealTypes.map(m => '<option>' + m + '</option>').join('')}</select></div>
        <div><label class="lbl">日期</label><input class="field" id="meal-date" type="date" value="${today}"></div>
      </div>
      <label class="lbl">吃了什么</label>
      <input class="field" id="meal-content" placeholder="如：牛肉面 + 青菜">
      <button class="btn" id="meal-add">保存</button>
    </div>
    <div class="card"><h2>记录列表</h2>
      ${items || '<div class="hot-empty">还没有记录</div>'}
    </div>`;
}
function waterAdd(n) {
  const water = DB.get('water', {});
  const t = todayStr();
  const cur = water[t] || 0;
  water[t] = n === -99 ? 0 : Math.max(0, cur + n);
  DB.set('water', water);
  render();
}
function delMeal(id) {
  DB.set('meals', DB.get('meals', []).filter(x => x.id !== id));
  render();
}
function bindMeals() {
  const add = () => {
    const content = document.getElementById('meal-content').value.trim();
    if (!content) { alert('记录一下吃了什么吧'); return; }
    const meals = DB.get('meals', []);
    meals.push({
      id: Store.uid(),
      meal: document.getElementById('meal-type').value,
      content: content,
      date: document.getElementById('meal-date').value || todayStr()
    });
    DB.set('meals', meals);
    render();
  };
  const btn = document.getElementById('meal-add');
  if (btn) btn.onclick = add;
}

/* ---------- 运动打卡 ---------- */
function exerciseHTML() {
  const recs = DB.get('exercise', []).slice().sort((a, b) => b.date.localeCompare(a.date));
  const items = recs.map(r => `<div class="item">
    <div class="it-main">
      <div class="it-title">${r.type} · ${r.minutes} 分钟</div>
      <div class="it-sub">${r.date}</div>
    </div>
    <div class="del" onclick="delExercise('${r.id}')">✕</div>
  </div>`).join('');
  return `
    <div class="sum">
      <div class="s"><div class="k">今日运动</div><div class="v">${exerciseToday()} 分钟</div></div>
      <div class="s"><div class="k">近 7 天</div><div class="v">${exerciseWeek()} 分钟</div></div>
    </div>
    <div class="card">
      <h2>打卡</h2>
      <div class="frow">
        <div><label class="lbl">类型</label>
          <select class="field" id="ex-type">${DEFAULTS.exerciseTypes.map(t => '<option>' + t + '</option>').join('')}</select></div>
        <div><label class="lbl">时长（分钟）</label><input class="field" id="ex-min" type="number" min="1" placeholder="30"></div>
      </div>
      <label class="lbl">日期</label>
      <input class="field" id="ex-date" type="date" value="${todayStr()}">
      <button class="btn" id="ex-add">打卡</button>
    </div>
    <div class="card"><h2>打卡记录</h2>
      ${items || '<div class="hot-empty">还没有打卡</div>'}
    </div>`;
}
function delExercise(id) {
  DB.set('exercise', DB.get('exercise', []).filter(x => x.id !== id));
  render();
}
function bindExercise() {
  const add = () => {
    const minutes = Number(document.getElementById('ex-min').value);
    if (!minutes || minutes <= 0) { alert('请填写运动时长'); return; }
    const recs = DB.get('exercise', []);
    recs.push({
      id: Store.uid(),
      type: document.getElementById('ex-type').value,
      minutes: minutes,
      date: document.getElementById('ex-date').value || todayStr()
    });
    DB.set('exercise', recs);
    render();
  };
  const btn = document.getElementById('ex-add');
  if (btn) btn.onclick = add;
}

/* ---------- 健康记录 ---------- */
function healthHTML() {
  const recs = DB.get('health', []).slice().sort((a, b) => b.date.localeCompare(a.date));
  const latest = recs[0];
  const items = recs.map(r => `<div class="item">
    <div class="it-main">
      <div class="it-title">${r.date}</div>
      <div class="it-sub">${r.weight ? '体重 ' + r.weight + ' kg' : ''}${r.weight && r.sleep ? ' · ' : ''}${r.sleep ? '睡眠 ' + r.sleep + ' 小时' : ''}${r.note ? ' · ' + esc(r.note) : ''}</div>
    </div>
    <div class="del" onclick="delHealth('${r.id}')">✕</div>
  </div>`).join('');
  return `
    <div class="sum">
      <div class="s"><div class="k">最新体重</div><div class="v">${latest && latest.weight ? latest.weight + ' kg' : '—'}</div></div>
      <div class="s"><div class="k">最新睡眠</div><div class="v">${latest && latest.sleep ? latest.sleep + ' 小时' : '—'}</div></div>
    </div>
    <div class="card">
      <h2>记录健康数据</h2>
      <label class="lbl">日期</label>
      <input class="field" id="he-date" type="date" value="${todayStr()}">
      <div class="frow">
        <div><label class="lbl">体重（kg）</label><input class="field" id="he-weight" type="number" step="0.1" placeholder="可选"></div>
        <div><label class="lbl">睡眠（小时）</label><input class="field" id="he-sleep" type="number" step="0.1" placeholder="可选"></div>
      </div>
      <label class="lbl">备注</label>
      <input class="field" id="he-note" placeholder="可选">
      <button class="btn" id="he-add">保存</button>
    </div>
    <div class="card"><h2>历史记录</h2>
      ${items || '<div class="hot-empty">还没有记录</div>'}
    </div>`;
}
function delHealth(id) {
  DB.set('health', DB.get('health', []).filter(x => x.id !== id));
  render();
}
function bindHealth() {
  const add = () => {
    const weight = Number(document.getElementById('he-weight').value);
    const sleep = Number(document.getElementById('he-sleep').value);
    if (!weight && !sleep) { alert('至少填写体重或睡眠一项'); return; }
    const recs = DB.get('health', []);
    recs.push({
      id: Store.uid(),
      date: document.getElementById('he-date').value || todayStr(),
      weight: weight || null,
      sleep: sleep || null,
      note: document.getElementById('he-note').value.trim()
    });
    DB.set('health', recs);
    render();
  };
  const btn = document.getElementById('he-add');
  if (btn) btn.onclick = add;
}

/* ---------- 业务复盘 ---------- */
function reviewHTML() {
  const recs = DB.get('reviews', []).slice().sort((a, b) => b.date.localeCompare(a.date));
  const items = recs.map(r => `<div class="item" style="align-items:flex-start">
    <div class="it-main">
      <div class="it-title">${esc(r.title)}</div>
      <div class="it-sub">${r.date} · ${r.content ? esc(r.content.slice(0, 60)) + (r.content.length > 60 ? '…' : '') : ''}</div>
    </div>
    <div class="del" onclick="delReview('${r.id}')">✕</div>
  </div>`).join('');
  return `
    <div class="card">
      <h2>写复盘</h2>
      <label class="lbl">标题</label>
      <input class="field" id="rv-title" placeholder="如：本周业务复盘">
      <label class="lbl">内容</label>
      <textarea class="field" id="rv-content" rows="5" placeholder="做了什么、结果如何、下次怎么改进…"></textarea>
      <label class="lbl">日期</label>
      <input class="field" id="rv-date" type="date" value="${todayStr()}">
      <button class="btn" id="rv-add">保存复盘</button>
    </div>
    <div class="card"><h2>复盘记录（${recs.length}）</h2>
      ${items || '<div class="hot-empty">还没有复盘</div>'}
    </div>`;
}
function delReview(id) {
  DB.set('reviews', DB.get('reviews', []).filter(x => x.id !== id));
  render();
}
function bindReview() {
  const add = () => {
    const title = document.getElementById('rv-title').value.trim();
    const content = document.getElementById('rv-content').value.trim();
    if (!title && !content) { alert('写点内容再保存吧'); return; }
    const recs = DB.get('reviews', []);
    recs.push({
      id: Store.uid(),
      title: title || '未命名复盘',
      content: content,
      date: document.getElementById('rv-date').value || todayStr()
    });
    DB.set('reviews', recs);
    render();
  };
  const btn = document.getElementById('rv-add');
  if (btn) btn.onclick = add;
}

/* ---------- 每日热点 ---------- */
let hotEdit = false;
function hotHTML() {
  const ht = DB.get('hotTopics', DEFAULTS.hotTopics);
  const tab = Store.get('hotTab', 'uc');
  const list = (tab === 'uc' ? ht.uc : ht.douyin) || [];
  const key = tab === 'uc' ? 'hot' : 'views';
  const items = list.map((x, i) => hotEdit
    ? `<li style="gap:8px">
        <input class="hot-edit-input" data-idx="${i}" data-field="title" value="${esc(x.title)}">
        <input class="hot-edit-val" data-idx="${i}" data-field="${key}" value="${esc(x[key] || '')}">
        <div class="del" onclick="delHot(${i})">✕</div>
      </li>`
    : `<li>
        <span class="hot-rank">${i + 1}</span>
        <span class="hot-title">${esc(x.title)}</span>
        <span class="hot-val">${esc(x[key] || '')}</span>
      </li>`).join('');
  return `
    <div class="card">
      <div class="hot-head">
        <span class="t">热点列表</span>
        <div class="hot-tabs">
          <span class="${tab === 'uc' ? 'on' : ''}" onclick="setHotTab('uc')">UC 热点</span>
          <span class="${tab === 'douyin' ? 'on' : ''}" onclick="setHotTab('douyin')">抖音热点</span>
        </div>
        ${ifAdmin('<span class="ph-btn" style="margin-left:8px" onclick="toggleHotEdit()">' + (hotEdit ? '完成' : '编辑') + '</span>')}
      </div>
      <ul class="hot-list">${items || '<li class="hot-empty">暂无内容</li>'}</ul>
      ${ifAdmin(hotEdit
        ? '<button class="btn ghost" onclick="addHot()">+ 添加一条</button><button class="btn" onclick="saveHot()">保存修改</button>'
        : '')}
      ${ifAdmin('<p style="font-size:11px;color:#A2AAA4;margin-top:10px">默认是示例数据，点「编辑」可改成你想要的实时热点。</p>')}
    </div>`;
}
function setHotTab(t) { Store.set('hotTab', t); render(); }
function toggleHotEdit() { hotEdit = !hotEdit; render(); }
function addHot() {
  const ht = DB.get('hotTopics', DEFAULTS.hotTopics);
  const tab = Store.get('hotTab', 'uc');
  const key = tab === 'uc' ? 'hot' : 'views';
  const list = tab === 'uc' ? ht.uc : ht.douyin;
  list.push({ title: '新热点', [key]: '100万' });
  DB.set('hotTopics', ht);
  render();
}
function delHot(i) {
  const ht = DB.get('hotTopics', DEFAULTS.hotTopics);
  const tab = Store.get('hotTab', 'uc');
  const list = tab === 'uc' ? ht.uc : ht.douyin;
  list.splice(i, 1);
  DB.set('hotTopics', ht);
  render();
}
function saveHot() {
  const ht = DB.get('hotTopics', DEFAULTS.hotTopics);
  const tab = Store.get('hotTab', 'uc');
  const key = tab === 'uc' ? 'hot' : 'views';
  const list = tab === 'uc' ? ht.uc : ht.douyin;
  document.querySelectorAll('.hot-edit-input').forEach(inp => {
    const idx = Number(inp.dataset.idx);
    if (list[idx]) list[idx].title = inp.value;
  });
  document.querySelectorAll('.hot-edit-val').forEach(inp => {
    const idx = Number(inp.dataset.idx);
    if (list[idx]) list[idx][key] = inp.value;
  });
  DB.set('hotTopics', ht);
  hotEdit = false;
  render();
}

/* ---------- 设置 ---------- */
function settingsHTML() {
  const s = getSettings();
  const days = Array.from({ length: 31 }, (_, i) => i + 1);
  return `
    <div class="card">
      <h2>基本设置</h2>
      <div class="set-row">
        <div><div class="k">应用名称</div><div class="d">显示在首页左上角</div></div>
        <input id="set-name" value="${esc(s.appName)}">
      </div>
      <div class="set-row">
        <div><div class="k">每日问候语</div><div class="d">显示在顶部横幅</div></div>
        <input id="set-greet" value="${esc(s.greeting)}">
      </div>
      <div class="set-row">
        <div><div class="k">发薪日</div><div class="d">用于首页「距离发薪日」倒计时</div></div>
        <select id="set-payday">
          ${days.map(d => '<option value="' + d + '"' + (s.payday === d ? ' selected' : '') + '>每月 ' + d + ' 日</option>').join('')}
        </select>
      </div>
      <div class="set-row">
        <div><div class="k">幸运数范围</div><div class="d">今日幸运数 0 - N</div></div>
        <input id="set-lucky" type="number" min="1" max="999" value="${Number(s.luckyMax) || 99}">
      </div>
      <button class="btn" id="set-save">保存设置</button>
    </div>
    <div class="card">
      <h2>界面素材</h2>
      <p style="font-size:13px;color:#5B675F;line-height:1.9;margin-top:6px">
        左上角头像：任何人都可以点头像换自己的头像（存在各自设备）；这里是恢复默认<br>
        顶部横幅照片：替换 图片/header.jpg（建议横图，宽高比约 3:1）<br>
        替换后重新上传到 GitHub 即全局生效。
      </p>
      <button class="btn ghost" id="avatar-restore">恢复默认头像</button>
    </div>`;
}
function bindSettings() {
  const save = () => {
    const s = getSettings();
    s.appName = document.getElementById('set-name').value.trim() || '我的生活记录';
    s.greeting = document.getElementById('set-greet').value.trim() || '记得喝水';
    s.payday = Number(document.getElementById('set-payday').value) || 30;
    s.luckyMax = Math.max(1, Number(document.getElementById('set-lucky').value) || 99);
    DB.set('settings', s);
    toast(DB.mode === 'remote' ? '已修改，记得去管理后台发布到云端' : '已保存');
    render();
  };
  const btn = document.getElementById('set-save');
  if (btn) btn.onclick = save;
  const ar = document.getElementById('avatar-restore');
  if (ar) ar.onclick = restoreAvatar;
}

/* ================= 管理后台 ================= */
function adminLoginBody() {
  const hasPass = !!Store.get('auth', { pass: '' }).pass;
  return `
    <div class="card" style="margin-top:28px;text-align:center">
      <div style="font-size:40px">🔒</div>
      <h2 style="margin-top:10px">${hasPass ? '请输入管理员密码' : '首次进入，请设置管理员密码'}</h2>
      <input class="field" id="admin-pass" type="password" style="margin-top:14px" placeholder="密码">
      <button class="btn" id="admin-login">${hasPass ? '登录' : '设置并进入'}</button>
      <p class="admin-tip">密码只保存在你自己的浏览器里，别人进不来后台。</p>
    </div>`;
}
function bindAdminLogin() {
  const login = () => {
    const pw = document.getElementById('admin-pass').value;
    if (!pw) { alert('请输入密码'); return; }
    if (adminLogin(pw)) {
      toast('欢迎回来');
      render();
    } else {
      alert('密码错误');
    }
  };
  const btn = document.getElementById('admin-login');
  if (btn) btn.onclick = login;
  const inp = document.getElementById('admin-pass');
  if (inp) inp.addEventListener('keydown', e => { if (e.key === 'Enter') login(); });
}

function adminBody() {
  if (!AUTH.loggedIn) return adminLoginBody();
  const a = authInfo();
  return `
    <div class="card">
      <h2>当前状态</h2>
      <div class="set-row">
        <div><div class="k">数据说明</div>
        <div class="d">每台设备各自存自己的记录；发布到云端的内容会作为新访客打开时的初始配置（应用名/问候语/发薪日/热点）。</div></div>
      </div>
      <div class="btn-row">
        <button class="btn mini" id="gh-pull">拉取云端内容</button>
        <button class="btn mini" id="gh-push">发布到云端</button>
      </div>
      <p class="admin-tip">「发布到云端」：把当前配置发布成新访客的初始内容（也是你自己的备份）。<br>「拉取云端内容」：换新设备时，把之前发布的内容恢复到这台设备。</p>
    </div>
    <div class="card">
      <h2>GitHub 连接（只有你能看到）</h2>
      <label class="lbl">仓库地址（owner/repo）</label>
      <input class="field" id="gh-repo" value="${esc(a.repo)}" placeholder="如 yourname/dad-daily">
      <label class="lbl">GitHub Token（仓库 contents 读写权限）</label>
      <input class="field" id="gh-token" type="password" value="${esc(a.token)}" placeholder="github_pat_...">
      <button class="btn" id="gh-save">保存连接</button>
      <p class="admin-tip">Token 只在你自己浏览器里，不会上传到网站或仓库代码里。GitHub 设置方法见 README/使用说明。</p>
    </div>
    <div class="card">
      <h2>数据备份</h2>
      <div class="btn-row">
        <button class="btn mini" onclick="downloadBackup()">下载备份 JSON</button>
        <button class="btn mini ghost" onclick="document.getElementById('backup-file').click()">导入备份</button>
        <input type="file" id="backup-file" accept=".json,.txt" style="display:none" onchange="importBackup(this)">
      </div>
    </div>
    <div class="card">
      <h2>修改管理员密码</h2>
      <input class="field" id="new-pass" type="password" placeholder="新密码（至少 4 位）">
      <button class="btn" id="pass-save">修改密码</button>
    </div>
    <div class="card">
      <button class="btn ghost" onclick="adminLogout()">退出后台（切回访客模式）</button>
    </div>`;
}

function bindAdmin() {
  if (!AUTH.loggedIn) { bindAdminLogin(); return; }
  const saveConn = () => {
    const a = authInfo();
    a.repo = document.getElementById('gh-repo').value.trim();
    a.token = document.getElementById('gh-token').value.trim();
    Store.set('auth', a);
    toast('连接信息已保存');
  };
  const savePass = () => {
    const v = document.getElementById('new-pass').value;
    if (v.length < 4) { alert('密码至少 4 位'); return; }
    adminChangePassword(v);
    toast('密码已修改');
    document.getElementById('new-pass').value = '';
  };
  const el = id => document.getElementById(id);
  const g1 = el('gh-save'); if (g1) g1.onclick = saveConn;
  const g2 = el('pass-save'); if (g2) g2.onclick = savePass;
  const g3 = el('gh-pull'); if (g3) g3.onclick = function () { ghPull(); };
  const g4 = el('gh-push'); if (g4) g4.onclick = function () { ghPush(); };
}

/* ---------- GitHub 云端同步 ---------- */
function b64encode(str) { return btoa(unescape(encodeURIComponent(str))); }
function b64decode(b64) { return decodeURIComponent(escape(atob(b64))); }

async function ghPull() {
  const a = authInfo();
  if (!a.repo) { alert('请先在后台填写仓库地址'); return; }
  try {
    const res = await fetch('https://api.github.com/repos/' + a.repo + '/contents/content.json', {
      headers: { 'Accept': 'application/vnd.github+json' }
    });
    if (res.status === 404) { alert('云端还没有内容，先点「发布到云端」创建'); return; }
    if (!res.ok) throw new Error('HTTP ' + res.status);
    const j = await res.json();
    const data = JSON.parse(b64decode(j.content));
    DB.remote = data;
    DB.mode = 'remote';
    toast('已拉取云端内容');
    render();
  } catch (e) {
    alert('拉取失败：' + e.message);
  }
}

async function ghPush() {
  const a = authInfo();
  if (!a.repo || !a.token) { alert('请先填写仓库地址和 Token'); return; }
  const payload = JSON.stringify(DB.exportData(), null, 2);
  try {
    let sha = null;
    const head = await fetch('https://api.github.com/repos/' + a.repo + '/contents/content.json', {
      headers: { 'Accept': 'application/vnd.github+json' }
    });
    if (head.ok) {
      const j = await head.json();
      sha = j.sha;
    }
    const res = await fetch('https://api.github.com/repos/' + a.repo + '/contents/content.json', {
      method: 'PUT',
      headers: {
        'Authorization': 'token ' + a.token,
        'Accept': 'application/vnd.github+json',
        'Content-Type': 'application/json'
      },
      body: JSON.stringify({ message: '更新我的生活记录内容', content: b64encode(payload), sha: sha })
    });
    if (!res.ok) {
      const e = await res.json().catch(function () { return null; });
      throw new Error((e && e.message) || 'HTTP ' + res.status);
    }
    DB.remote = JSON.parse(payload);
    DB.mode = 'remote';
    toast('发布成功，稍后所有人可见');
    render();
  } catch (e) {
    alert('发布失败：' + e.message);
  }
}

function downloadBackup() {
  const blob = new Blob([JSON.stringify(DB.exportData(), null, 2)], { type: 'application/json' });
  const a = document.createElement('a');
  a.href = URL.createObjectURL(blob);
  a.download = 'dad-daily-backup-' + todayStr() + '.json';
  document.body.appendChild(a);
  a.click();
  document.body.removeChild(a);
  URL.revokeObjectURL(a.href);
  toast('备份已下载');
}

function importBackup(input) {
  const f = input.files[0];
  if (!f) return;
  const reader = new FileReader();
  reader.onload = function () {
    try {
      const data = JSON.parse(reader.result);
      DB.importData(data);
      toast('导入成功');
      render();
    } catch (e) {
      alert('导入失败：文件格式不对');
    }
  };
  reader.readAsText(f);
  input.value = '';
}

/* ================= 页面注册与启动 ================= */
const PAGES = {
  plan: { title: '每日计划', body: planHTML, bind: bindPlan },
  ledger: { title: '记账', body: ledgerHTML, bind: bindLedger },
  lucky: { title: '今日幸运数', body: luckyHTML, bind: null },
  memo: { title: '备忘录', body: memoHTML, bind: bindMemo },
  dates: { title: '重要日期', body: datesHTML, bind: bindDates },
  waist: { title: '每日腰围', body: waistHTML, bind: bindWaist },
  meals: { title: '饮食记录', body: mealsHTML, bind: bindMeals },
  exercise: { title: '运动打卡', body: exerciseHTML, bind: bindExercise },
  health: { title: '健康记录', body: healthHTML, bind: bindHealth },
  review: { title: '业务复盘', body: reviewHTML, bind: bindReview },
  hot: { title: '每日热点', body: hotHTML, bind: null },
  settings: { title: '设置', body: settingsHTML, bind: bindSettings },
  admin: { title: '管理后台', body: adminBody, bind: bindAdmin }
};

async function initApp() {
  await DB.init();
  if (sessionStorage.getItem('dadDaily.admin') === '1') AUTH.loggedIn = true;
  render();
}

if (document.readyState === 'loading') {
  window.addEventListener('DOMContentLoaded', initApp);
} else {
  initApp();
}
