// ── State ──
let reminders = [];
let currentMonth = new Date();
let currentWeekStart = getWeekStart(new Date());
let currentView = 'monthly';

// ── GitHub API ──
const GH_OWNER  = 'ondrejcervinka';
const GH_REPO   = 'reminders-app';
const GH_FILE   = 'data/reminders.json';
const GH_BRANCH = 'main';

function getToken() { return localStorage.getItem('gh_token'); }
function setToken(t) { localStorage.setItem('gh_token', t); }
function clearToken() { localStorage.removeItem('gh_token'); }

function setSyncStatus(state, msg) {
    const el = document.getElementById('syncStatus');
    if (!el) return;
    el.className = 'sync-status ' + state;
    el.textContent = msg;
    if (state === 'ok') setTimeout(() => { el.textContent = ''; el.className = 'sync-status'; }, 3000);
}

async function getFileSha(token) {
    const res = await fetch(
        `https://api.github.com/repos/${GH_OWNER}/${GH_REPO}/contents/${GH_FILE}?ref=${GH_BRANCH}`,
        { headers: { Authorization: `token ${token}` } }
    );
    if (!res.ok) throw new Error(`SHA fetch failed: ${res.status}`);
    const data = await res.json();
    return data.sha;
}

async function saveToGitHub() {
    let token = getToken();

    if (!token) {
        token = prompt('Zadej GitHub Personal Access Token\n(Settings → Developer settings → Fine-grained tokens, scope: Contents write na tomto repo):');
        if (!token) return;
        setToken(token);
    }

    setSyncStatus('saving', 'Ukladam...');
    try {
        const sha     = await getFileSha(token);
        const json    = JSON.stringify(reminders, null, 2);
        const content = btoa(unescape(encodeURIComponent(json)));

        const res = await fetch(
            `https://api.github.com/repos/${GH_OWNER}/${GH_REPO}/contents/${GH_FILE}`,
            {
                method: 'PUT',
                headers: { Authorization: `token ${token}`, 'Content-Type': 'application/json' },
                body: JSON.stringify({ message: 'Update reminders', content, sha, branch: GH_BRANCH })
            }
        );

        if (res.status === 401) {
            clearToken();
            setSyncStatus('error', 'Chybny token — zkus znovu');
            return;
        }
        if (!res.ok) throw new Error(`GitHub API error: ${res.status}`);

        setSyncStatus('ok', 'Ulozeno');
    } catch (e) {
        console.error(e);
        setSyncStatus('error', 'Chyba ulozeni');
    }
}

// Pill color palette
const PILL_COLORS = [
    { bg: '#EEF2FF', fg: '#4338CA' },
    { bg: '#ECFDF5', fg: '#047857' },
    { bg: '#EFF6FF', fg: '#1D4ED8' },
    { bg: '#FFF7ED', fg: '#C2410C' },
    { bg: '#FDF4FF', fg: '#7E22CE' },
    { bg: '#F0FDFA', fg: '#0F766E' },
    { bg: '#FEF2F2', fg: '#B91C1C' },
    { bg: '#FEFCE8', fg: '#A16207' },
];

function getPillColor(id) {
    return PILL_COLORS[Math.abs(id) % PILL_COLORS.length];
}

// ── Helpers ──
function getWeekStart(date) {
    const d = new Date(date);
    const day = d.getDay();
    const diff = d.getDate() - day + (day === 0 ? -6 : 1);
    return new Date(d.setDate(diff));
}

function getWeekEnd(weekStart) {
    const end = new Date(weekStart);
    end.setDate(end.getDate() + 6);
    return end;
}

function escapeHtml(text) {
    const div = document.createElement('div');
    div.textContent = String(text || '');
    return div.innerHTML;
}

// ── Data ──
async function loadReminders() {
    // Always fetch from GitHub — JSON is the source of truth
    try {
        const res = await fetch(`https://raw.githubusercontent.com/${GH_OWNER}/${GH_REPO}/${GH_BRANCH}/${GH_FILE}?_=${Date.now()}`);
        if (res.ok) {
            reminders = await res.json();
            render();
            return;
        }
    } catch (e) {
        console.log('GitHub fetch failed, falling back to local');
    }
    // Fallback: relative path (local dev server)
    try {
        const res = await fetch(`data/reminders.json?_=${Date.now()}`);
        if (res.ok) reminders = await res.json();
    } catch (e) {}
    render();
}

function saveReminders() {
    // Fire-and-forget GitHub save; no localStorage needed
    saveToGitHub();
}

async function summarizeUrl(url) {
    try {
        const response = await fetch(`https://api.allorigins.win/raw?url=${encodeURIComponent(url)}`);
        const html = await response.text();
        const titleMatch = html.match(/<title[^>]*>([^<]+)<\/title>/i);
        const title = titleMatch ? titleMatch[1].trim() : '';
        const descMatch = html.match(/<meta[^>]*name=["']description["'][^>]*content=["']([^"']+)["']/i);
        const description = descMatch ? descMatch[1].trim() : '';
        return { title: title.substring(0, 100), description: description.substring(0, 200) || title.substring(0, 100) };
    } catch (e) {
        return { title: '', description: '' };
    }
}

async function addReminder(text, url = '', dateTime = '') {
    const reminder = {
        id: Date.now(),
        text, url, dateTime,
        done: false,
        createdAt: new Date().toISOString(),
        title: '', description: ''
    };
    if (url) {
        const summary = await summarizeUrl(url);
        reminder.title = summary.title || text.substring(0, 60);
        reminder.description = summary.description;
    }
    reminders.push(reminder);
    sortReminders();
    saveReminders();
    render();
}

function sortReminders() {
    reminders.sort((a, b) => {
        if (!a.dateTime && !b.dateTime) return 0;
        if (!a.dateTime) return 1;
        if (!b.dateTime) return -1;
        return new Date(a.dateTime) - new Date(b.dateTime);
    });
}

function deleteReminder(id) {
    reminders = reminders.filter(r => r.id !== id);
    saveReminders();
    render();
}

function toggleDone(id) {
    const r = reminders.find(r => r.id === id);
    if (r) { r.done = !r.done; saveReminders(); render(); }
}

// ── Render ──
function render() {
    renderMiniCalendar();
    renderMainHeader();

    if (currentView === 'monthly') {
        renderMainMonthCalendar();
    } else {
        renderWeeklyCalendar();
    }

    renderTaskListCompact();
    renderReadLaterList();
}

// ── Mini Sidebar Calendar ──
function renderMiniCalendar() {
    const year = currentMonth.getFullYear();
    const month = currentMonth.getMonth();

    const monthNames = ['Leden','Unor','Brezen','Duben','Kveten','Cerven',
                        'Cervenec','Srpen','Zari','Rijen','Listopad','Prosinec'];
    document.getElementById('currentMonth').textContent = `${monthNames[month]} ${year}`;

    const firstDay = new Date(year, month, 1);
    const lastDay  = new Date(year, month + 1, 0);
    const startDay = (firstDay.getDay() + 6) % 7;
    const daysInMonth = lastDay.getDate();
    const today = new Date(); today.setHours(0,0,0,0);
    const showPending = document.getElementById('showOnlyPending')?.checked ?? true;

    let html = '';

    const prevLast = new Date(year, month, 0).getDate();
    for (let i = startDay - 1; i >= 0; i--) {
        html += `<div class="mini-cal-day other-month"><span>${prevLast - i}</span></div>`;
    }

    for (let day = 1; day <= daysInMonth; day++) {
        const date = new Date(year, month, day);
        const dateStr = date.toISOString().split('T')[0];
        const hasDot = reminders.some(r => {
            if (!r.dateTime) return false;
            if (showPending && r.done) return false;
            return r.dateTime.split('T')[0] === dateStr;
        });
        const isToday = date.getTime() === today.getTime();
        let cls = 'mini-cal-day';
        if (isToday) cls += ' today';
        if (hasDot)  cls += ' has-dot';
        html += `<div class="${cls}" onclick="jumpToDate('${dateStr}')"><span>${day}</span></div>`;
    }

    const total = startDay + daysInMonth;
    const rem = total % 7 === 0 ? 0 : 7 - (total % 7);
    for (let d = 1; d <= rem; d++) {
        html += `<div class="mini-cal-day other-month"><span>${d}</span></div>`;
    }

    document.getElementById('calendarDays').innerHTML = html;
}

// ── Main Header Label ──
function renderMainHeader() {
    const monthNames = ['Januar','Februar','Brezen','Duben','Kveten','Cerven',
                        'Cervenec','Srpen','Zari','Rijen','Listopad','Prosinec'];

    if (currentView === 'monthly') {
        document.getElementById('mainMonthLabel').textContent =
            `${monthNames[currentMonth.getMonth()]}, ${currentMonth.getFullYear()}`;
    } else {
        const weekEnd = getWeekEnd(currentWeekStart);
        const sd = currentWeekStart.getDate();
        const sm = currentWeekStart.toLocaleDateString('cs-CZ', { month: 'short' });
        const ed = weekEnd.getDate();
        const em = weekEnd.toLocaleDateString('cs-CZ', { month: 'short' });
        document.getElementById('mainMonthLabel').textContent = `${sd}. ${sm} \u2013 ${ed}. ${em}`;
    }
}

// ── Main Monthly Calendar ──
function renderMainMonthCalendar() {
    document.getElementById('monthlyView').classList.remove('hidden');
    document.getElementById('weeklyView').classList.add('hidden');

    const year  = currentMonth.getFullYear();
    const month = currentMonth.getMonth();
    const firstDay    = new Date(year, month, 1);
    const lastDay     = new Date(year, month + 1, 0);
    const startDay    = (firstDay.getDay() + 6) % 7;
    const daysInMonth = lastDay.getDate();
    const today = new Date(); today.setHours(0,0,0,0);
    const showPending = document.getElementById('showOnlyPending')?.checked ?? true;

    let html = '';

    const prevLast = new Date(year, month, 0).getDate();
    for (let i = startDay - 1; i >= 0; i--) {
        const d = prevLast - i;
        const date = new Date(year, month - 1, d);
        html += buildCell(d, date.toISOString().split('T')[0], true, false, showPending);
    }

    for (let day = 1; day <= daysInMonth; day++) {
        const date = new Date(year, month, day);
        const isToday = date.getTime() === today.getTime();
        html += buildCell(day, date.toISOString().split('T')[0], false, isToday, showPending);
    }

    const total = startDay + daysInMonth;
    const rem = total % 7 === 0 ? 0 : 7 - (total % 7);
    for (let d = 1; d <= rem; d++) {
        const date = new Date(year, month + 1, d);
        html += buildCell(d, date.toISOString().split('T')[0], true, false, showPending);
    }

    document.getElementById('mainCalGrid').innerHTML = html;
}

function buildCell(day, dateStr, otherMonth, isToday, showPending) {
    const dayReminders = reminders.filter(r => {
        if (!r.dateTime) return false;
        if (showPending && r.done) return false;
        return r.dateTime.split('T')[0] === dateStr;
    });

    let cellCls = 'main-cal-cell';
    if (otherMonth) cellCls += ' other-month';
    if (isToday)    cellCls += ' today';

    const maxPills = 3;
    const visible  = dayReminders.slice(0, maxPills);
    const overflow = dayReminders.length - maxPills;

    const pills = visible.map(r => {
        const color = getPillColor(r.id);
        const time  = r.dateTime
            ? new Date(r.dateTime).toLocaleTimeString('cs-CZ', { hour: '2-digit', minute: '2-digit' })
            : '';
        const label = escapeHtml(r.title || r.text);
        return `<div class="event-pill ${r.done ? 'done' : ''}"
                     style="background:${color.bg}; color:${color.fg};"
                     onclick="event.stopPropagation(); toggleDone(${r.id})"
                     title="${escapeHtml(r.text)}">
                    ${time ? `<span class="pill-time">${time}</span>` : ''}
                    <span class="pill-title">${label}</span>
                </div>`;
    }).join('');

    const moreBtn = overflow > 0 ? `<div class="more-events">+${overflow} dalsi</div>` : '';

    return `<div class="${cellCls}" onclick="jumpToDate('${dateStr}')">
                <div class="cell-day-num">${day}</div>
                <div class="cell-events">${pills}${moreBtn}</div>
            </div>`;
}

// ── Weekly Calendar ──
function renderWeeklyCalendar() {
    document.getElementById('weeklyView').classList.remove('hidden');
    document.getElementById('monthlyView').classList.add('hidden');

    const weeklyView = document.getElementById('weeklyView');

    // Ensure inner card wrapper exists
    let card = weeklyView.querySelector('.inner-card');
    if (!card) {
        card = document.createElement('div');
        card.className = 'inner-card';
        const wh = document.getElementById('weekHeader');
        const wb = document.getElementById('weekBody');
        card.appendChild(wh);
        card.appendChild(wb);
        weeklyView.appendChild(card);
    }

    const dayNames = ['Po','Ut','St','Ct','Pa','So','Ne'];
    const today    = new Date(); today.setHours(0,0,0,0);
    const showPending = document.getElementById('showOnlyPending')?.checked ?? true;
    const hours = Array.from({ length: 17 }, (_, i) => i + 6);

    // Header
    let weekHeaderHtml = '<div class="time-gutter"></div>';
    for (let i = 0; i < 7; i++) {
        const d = new Date(currentWeekStart);
        d.setDate(d.getDate() + i);
        const isToday = d.getTime() === today.getTime();
        weekHeaderHtml += `<div class="week-day-header ${isToday ? 'today-col' : ''}">
            <div class="day-name">${dayNames[i]}</div>
            <div class="day-number">${d.getDate()}</div>
        </div>`;
    }
    document.getElementById('weekHeader').innerHTML = weekHeaderHtml;

    // Body
    let timeGutter = hours.map(h => `<div class="time-slot-label">${h}:00</div>`).join('');
    let dayColumnsHtml = '';

    for (let i = 0; i < 7; i++) {
        const d = new Date(currentWeekStart);
        d.setDate(d.getDate() + i);
        const dateStr = d.toISOString().split('T')[0];

        const dayRems = reminders.filter(r => {
            if (!r.dateTime) return false;
            if (showPending && r.done) return false;
            return r.dateTime.split('T')[0] === dateStr;
        });

        let eventsHtml = '';
        dayRems.forEach(r => {
            const t     = new Date(r.dateTime);
            const top   = ((t.getHours() - 6) * 44) + (t.getMinutes() / 60 * 44);
            const time  = t.toLocaleTimeString('cs-CZ', { hour: '2-digit', minute: '2-digit' });
            const color = getPillColor(r.id);
            eventsHtml += `<div class="week-event ${r.done ? 'done' : ''}"
                                style="top:${top}px; height:40px; background:${color.bg}; color:${color.fg}; border-left:3px solid ${color.fg};"
                                onclick="toggleDone(${r.id})" title="${escapeHtml(r.text)}">
                                <div class="event-time">${time}</div>
                                <div class="event-title">${escapeHtml(r.title || r.text)}</div>
                           </div>`;
        });

        const hourCells = hours.map(() => `<div class="hour-cell"></div>`).join('');
        dayColumnsHtml += `<div class="day-column" data-date="${dateStr}" style="position:relative;">
            ${hourCells}${eventsHtml}
        </div>`;
    }

    document.getElementById('weekBody').innerHTML =
        `<div class="time-gutter">${timeGutter}</div>${dayColumnsHtml}`;
}

// ── Task List (sidebar) ──
function renderTaskListCompact() {
    const showPending = document.getElementById('showOnlyPending')?.checked ?? true;
    const filtered    = reminders.filter(r => r.dateTime && (showPending ? !r.done : true));

    const iconCheck = `<svg width="9" height="9" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="3"><polyline points="20 6 9 17 4 12"/></svg>`;
    const iconTrash = `<svg width="9" height="9" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><polyline points="3 6 5 6 21 6"/><path d="M19 6v14a2 2 0 0 1-2 2H7a2 2 0 0 1-2-2V6m3 0V4a2 2 0 0 1 2-2h4a2 2 0 0 1 2 2v2"/></svg>`;

    if (filtered.length === 0) {
        document.getElementById('tasksListCompact').innerHTML =
            `<div class="task-empty-compact">Zadne ukoly</div>`;
        return;
    }

    const html = `<div class="task-list-compact">` +
        filtered.slice(0, 10).map(r => `
            <div class="task-item-compact ${r.done ? 'done' : ''}" onclick="toggleDone(${r.id})">
                <div class="task-check">${r.done ? iconCheck : ''}</div>
                <div class="task-title-compact">${escapeHtml(r.title || r.text)}</div>
                <button class="task-del" onclick="event.stopPropagation(); deleteReminder(${r.id})">${iconTrash}</button>
            </div>`).join('') +
        `</div>`;

    document.getElementById('tasksListCompact').innerHTML = html;
}

// ── Read Later (sidebar) ──
function renderReadLaterList() {
    const readLater = reminders.filter(r => r.url && !r.dateTime);

    const iconExt   = `<svg width="9" height="9" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><path d="M18 13v6a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2V8a2 2 0 0 1 2-2h6"/><polyline points="15 3 21 3 21 9"/><line x1="10" y1="14" x2="21" y2="3"/></svg>`;
    const iconTrash = `<svg width="9" height="9" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><polyline points="3 6 5 6 21 6"/><path d="M19 6v14a2 2 0 0 1-2 2H7a2 2 0 0 1-2-2V6m3 0V4a2 2 0 0 1 2-2h4a2 2 0 0 1 2 2v2"/></svg>`;
    const iconLink  = `<svg width="8" height="8" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><path d="M10 13a5 5 0 0 0 7.54.54l3-3a5 5 0 0 0-7.07-7.07l-1.72 1.71"/><path d="M14 11a5 5 0 0 0-7.54-.54l-3 3a5 5 0 0 0 7.07 7.07l1.71-1.71"/></svg>`;

    if (readLater.length === 0) {
        document.getElementById('readLaterList').innerHTML =
            `<div class="read-later-empty">Nic k precteni</div>`;
        return;
    }

    const html = `<div class="read-later-list">` +
        readLater.map(r => `
            <div class="read-later-item">
                <div class="rl-title">${escapeHtml(r.title || r.text)}</div>
                <div class="rl-meta">${iconLink}<span>${escapeHtml(r.url)}</span></div>
                <div class="rl-actions">
                    <button class="rl-btn rl-btn-open" onclick="window.open('${escapeHtml(r.url)}','_blank')" title="Otevrit">${iconExt}</button>
                    <button class="rl-btn rl-btn-del"  onclick="deleteReminder(${r.id})" title="Smazat">${iconTrash}</button>
                </div>
            </div>`).join('') +
        `</div>`;

    document.getElementById('readLaterList').innerHTML = html;
}

// ── Navigation ──
function jumpToDate(dateStr) {
    const d = new Date(dateStr);
    currentMonth     = new Date(d.getFullYear(), d.getMonth(), 1);
    currentWeekStart = getWeekStart(d);
    render();
}

// ── Event Listeners ──

document.getElementById('prevMonth').addEventListener('click', () => {
    currentMonth.setMonth(currentMonth.getMonth() - 1);
    render();
});
document.getElementById('nextMonth').addEventListener('click', () => {
    currentMonth.setMonth(currentMonth.getMonth() + 1);
    render();
});

document.getElementById('prevMainPeriod').addEventListener('click', () => {
    if (currentView === 'monthly') {
        currentMonth.setMonth(currentMonth.getMonth() - 1);
    } else {
        currentWeekStart.setDate(currentWeekStart.getDate() - 7);
    }
    render();
});
document.getElementById('nextMainPeriod').addEventListener('click', () => {
    if (currentView === 'monthly') {
        currentMonth.setMonth(currentMonth.getMonth() + 1);
    } else {
        currentWeekStart.setDate(currentWeekStart.getDate() + 7);
    }
    render();
});

document.getElementById('todayBtn').addEventListener('click', () => {
    const now = new Date();
    currentMonth     = new Date(now.getFullYear(), now.getMonth(), 1);
    currentWeekStart = getWeekStart(now);
    render();
});

document.querySelectorAll('.view-tab').forEach(tab => {
    tab.addEventListener('click', () => {
        document.querySelectorAll('.view-tab').forEach(t => t.classList.remove('active'));
        tab.classList.add('active');
        currentView = tab.dataset.view;
        render();
    });
});

document.getElementById('showOnlyPending').addEventListener('change', render);

// Modal
const modal    = document.getElementById('addModal');
const openBtn  = document.getElementById('openAddModal');
const closeBtn = document.getElementById('closeModal');

openBtn.addEventListener('click', () => {
    modal.classList.add('active');
    document.getElementById('reminderText').focus();
});
closeBtn.addEventListener('click', () => modal.classList.remove('active'));
modal.addEventListener('click', e => { if (e.target === modal) modal.classList.remove('active'); });

document.addEventListener('keydown', e => {
    if (e.key === 'Escape' && modal.classList.contains('active')) modal.classList.remove('active');
});

document.getElementById('addForm').addEventListener('submit', async e => {
    e.preventDefault();
    const text     = document.getElementById('reminderText').value.trim();
    const url      = document.getElementById('reminderUrl').value.trim();
    const dateTime = document.getElementById('reminderDate').value;
    if (text) {
        await addReminder(text, url, dateTime);
        e.target.reset();
        modal.classList.remove('active');
    }
});

// ── Global exports ──
window.toggleDone     = toggleDone;
window.deleteReminder = deleteReminder;
window.jumpToDate     = jumpToDate;
window.addReminder    = addReminder;

// ── Init ──
loadReminders();
