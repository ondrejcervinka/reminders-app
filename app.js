// Reminders App
let reminders = [];
let currentMonth = new Date();
let currentWeekStart = getWeekStart(new Date());

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

// Load reminders
async function loadReminders() {
    let loadedFromServer = false;
    
    try {
        const response = await fetch('data/reminders.json');
        if (response.ok) {
            reminders = await response.json();
            loadedFromServer = true;
        }
    } catch (e) {
        console.log('Using localStorage');
    }
    
    if (!loadedFromServer) {
        const stored = localStorage.getItem('reminders_v2');
        if (stored) {
            reminders = JSON.parse(stored);
        }
    }
    
    render();
}

function saveReminders() {
    localStorage.setItem('reminders_v2', JSON.stringify(reminders));
}

// Auto-summarize URL content
async function summarizeUrl(url) {
    try {
        const response = await fetch(`https://api.allorigins.win/raw?url=${encodeURIComponent(url)}`);
        const html = await response.text();
        
        const titleMatch = html.match(/<title[^>]*>([^<]+)<\/title>/i);
        const title = titleMatch ? titleMatch[1].trim() : '';
        
        const descMatch = html.match(/<meta[^>]*name=["']description["'][^>]*content=["']([^"']+)["']/i);
        const description = descMatch ? descMatch[1].trim() : '';
        
        const ogImageMatch = html.match(/<meta[^>]*property=["']og:image["'][^>]*content=["']([^"']+)["']/i);
        const image = ogImageMatch ? ogImageMatch[1].trim() : '';
        
        return {
            title: title.substring(0, 100),
            description: description.substring(0, 200) || title.substring(0, 100),
            image
        };
    } catch (e) {
        console.log('Failed to fetch URL summary:', e);
        return { title: '', description: '', image: '' };
    }
}

async function addReminder(text, url = '', dateTime = '') {
    const reminder = {
        id: Date.now(),
        text,
        url,
        dateTime,
        done: false,
        createdAt: new Date().toISOString(),
        title: '',
        description: ''
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
    return reminder;
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
    const reminder = reminders.find(r => r.id === id);
    if (reminder) {
        reminder.done = !reminder.done;
        saveReminders();
        render();
    }
}

function render() {
    renderCalendar();
    renderWeeklyCalendar();
    renderTaskListCompact();
    renderReadLaterList();
}

function renderCalendar() {
    const year = currentMonth.getFullYear();
    const month = currentMonth.getMonth();
    
    const monthNames = ['Leden', 'Unor', 'Březen', 'Duben', 'Kveten', 'Cerven', 
                        'Cervenec', 'Srpen', 'Zari', 'Rijen', 'Listopad', 'Prosinec'];
    
    document.getElementById('currentMonth').textContent = `${monthNames[month]} ${year}`;
    
    const firstDay = new Date(year, month, 1);
    const lastDay = new Date(year, month + 1, 0);
    const startDay = (firstDay.getDay() + 6) % 7;
    const daysInMonth = lastDay.getDate();
    
    const today = new Date();
    today.setHours(0, 0, 0, 0);
    
    const showPending = document.getElementById('showOnlyPending')?.checked ?? true;
    
    let html = '';
    
    const prevMonth = new Date(year, month, 0);
    for (let i = startDay - 1; i >= 0; i--) {
        html += `<div class="calendar-day other-month"><span class="day-number">${prevMonth.getDate() - i}</span></div>`;
    }
    
    for (let day = 1; day <= daysInMonth; day++) {
        const date = new Date(year, month, day);
        const dateStr = date.toISOString().split('T')[0];
        
        const dayReminders = reminders.filter(r => {
            if (!r.dateTime) return false;
            if (showPending && r.done) return false;
            return r.dateTime.split('T')[0] === dateStr;
        });
        
        const isToday = date.getTime() === today.getTime();
        
        let classes = 'calendar-day';
        if (isToday) classes += ' today';
        if (dayReminders.length > 0) classes += ' has-reminders';
        
        const dots = dayReminders.slice(0, 3).map(r => 
            `<div class="reminder-dot ${r.done ? 'done' : ''}"></div>`
        ).join('');
        
        html += `<div class="${classes}" onclick="showDayReminders('${dateStr}')">
            <span class="day-number">${day}</span>
            ${dayReminders.length > 0 ? `<div class="reminder-dots">${dots}</div>` : ''}
        </div>`;
    }
    
    const totalCells = startDay + daysInMonth;
    const remaining = totalCells % 7 === 0 ? 0 : 7 - (totalCells % 7);
    for (let day = 1; day <= remaining; day++) {
        html += `<div class="calendar-day other-month"><span class="day-number">${day}</span></div>`;
    }
    
    document.getElementById('calendarDays').innerHTML = html;
}

function renderWeeklyCalendar() {
    const weekEnd = getWeekEnd(currentWeekStart);
    const dayNames = ['Po', 'Ut', 'St', 'Ct', 'Pa', 'So', 'Ne'];
    
    const startDay = currentWeekStart.getDate();
    const startMonth = currentWeekStart.toLocaleDateString('cs-CZ', { month: 'short' });
    const endDay = weekEnd.getDate();
    const endMonth = weekEnd.toLocaleDateString('cs-CZ', { month: 'short' });
    
    const weekRangeText = `${startDay}. ${startMonth} - ${endDay}. ${endMonth}`;
    
    const today = new Date();
    today.setHours(0, 0, 0, 0);
    
    const showPending = document.getElementById('showOnlyPending')?.checked ?? true;
    
    let weekHeaderHtml = '';
    for (let i = 0; i < 7; i++) {
        const date = new Date(currentWeekStart);
        date.setDate(date.getDate() + i);
        
        const isToday = date.getTime() === today.getTime();
        const dayNumber = date.getDate();
        
        weekHeaderHtml += `
            <div class="week-day-header ${isToday ? 'today-col' : ''}">
                <div class="day-name">${dayNames[i]}</div>
                <div class="day-number">${dayNumber}</div>
            </div>
        `;
    }
    
    const hours = [];
    for (let h = 6; h <= 22; h++) {
        hours.push(h);
    }
    
    let dayColumnsHtml = '';
    for (let i = 0; i < 7; i++) {
        const date = new Date(currentWeekStart);
        date.setDate(date.getDate() + i);
        const dateStr = date.toISOString().split('T')[0];
        
        const dayReminders = reminders.filter(r => {
            if (!r.dateTime) return false;
            if (showPending && r.done) return false;
            return r.dateTime.split('T')[0] === dateStr;
        });
        
        let eventsHtml = '';
        dayReminders.forEach(r => {
            const time = new Date(r.dateTime);
            const hour = time.getHours();
            const minute = time.getMinutes();
            const topPercent = ((hour - 6) * 40) + (minute / 60 * 40);
            
            const timeStr = time.toLocaleTimeString('cs-CZ', { hour: '2-digit', minute: '2-digit' });
            
            eventsHtml += `
                <div class="week-event ${r.done ? 'done' : ''}" 
                     style="top: ${topPercent}px; height: 36px;"
                     onclick="toggleDone(${r.id})" title="${escapeHtml(r.text)}">
                    <div class="event-time">${timeStr}</div>
                    <div class="event-title">${escapeHtml(r.title || r.text)}</div>
                </div>
            `;
        });
        
        let hourCellsHtml = '';
        hours.forEach(h => {
            hourCellsHtml += `<div class="hour-cell"></div>`;
        });
        
        dayColumnsHtml += `
            <div class="day-column" data-date="${dateStr}">
                ${hourCellsHtml}
                ${eventsHtml}
            </div>
        `;
    }
    
    let timeGutterHtml = '';
    hours.forEach(h => {
        timeGutterHtml += `<div class="time-slot-label">${h}</div>`;
    });
    
    document.getElementById('weekHeader').innerHTML = `
        <div class="time-gutter"></div>
        ${weekHeaderHtml}
    `;
    
    document.getElementById('weekBody').innerHTML = `
        <div class="time-gutter">${timeGutterHtml}</div>
        ${dayColumnsHtml}
    `;
    
    document.getElementById('weekRangeLabel').textContent = weekRangeText;
}

function renderTaskListCompact() {
    const showPending = true;
    
    let filtered = reminders.filter(r => r.dateTime);
    if (showPending) {
        filtered = filtered.filter(r => !r.done);
    }
    
    const iconCheck = `<svg width="10" height="10" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5"><polyline points="20 6 9 17 4 12"/></svg>`;
    const iconTrash = `<svg width="10" height="10" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><polyline points="3 6 5 6 21 6"/><path d="M19 6v14a2 2 0 0 1-2 2H7a2 2 0 0 1-2-2V6m3 0V4a2 2 0 0 1 2-2h4a2 2 0 0 1 2 2v2"/></svg>`;
    
    if (filtered.length === 0) {
        document.getElementById('tasksListCompact').innerHTML = `
            <div class="task-empty-compact">Zadne ukoly</div>
        `;
        return;
    }
    
    const html = filtered.slice(0, 8).map(r => `
        <div class="task-item-compact ${r.done ? 'done' : ''}" onclick="toggleDone(${r.id})">
            <div class="task-check">
                ${r.done ? iconCheck : ''}
            </div>
            <div class="task-title-compact">${escapeHtml(r.title || r.text)}</div>
            <button class="task-del" onclick="event.stopPropagation(); deleteReminder(${r.id})" title="Smazat">
                ${iconTrash}
            </button>
        </div>
    `).join('');
    
    document.getElementById('tasksListCompact').innerHTML = `<div class="task-list-compact">${html}</div>`;
}

function renderReadLaterList() {
    // Items with URL but no dateTime = read later
    let readLater = reminders.filter(r => r.url && !r.dateTime);
    
    const iconLink = `<svg width="10" height="10" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><path d="M10 13a5 5 0 0 0 7.54.54l3-3a5 5 0 0 0-7.07-7.07l-1.72 1.71"/><path d="M14 11a5 5 0 0 0-7.54-.54l-3 3a5 5 0 0 0 7.07 7.07l1.71-1.71"/></svg>`;
    const iconTrash = `<svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><polyline points="3 6 5 6 21 6"/><path d="M19 6v14a2 2 0 0 1-2 2H7a2 2 0 0 1-2-2V6m3 0V4a2 2 0 0 1 2-2h4a2 2 0 0 1 2 2v2"/></svg>`;
    const iconExternal = `<svg width="10" height="10" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><path d="M18 13v6a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2V8a2 2 0 0 1 2-2h6"/><polyline points="15 3 21 3 21 9"/><line x1="10" y1="14" x2="21" y2="3"/></svg>`;
    
    if (readLater.length === 0) {
        document.getElementById('readLaterList').innerHTML = `
            <div class="read-later-empty">
                <h3>Nic k precteni</h3>
            </div>
        `;
        return;
    }
    
    const html = readLater.map(r => `
        <div class="read-later-item">
            <div class="rl-title">${escapeHtml(r.title || r.text)}</div>
            ${r.description ? `<div class="rl-desc">${escapeHtml(r.description)}</div>` : ''}
            <div class="rl-meta">
                ${iconLink}
                <span>${escapeHtml(r.url)}</span>
            </div>
            <div class="rl-actions">
                <button class="rl-btn rl-btn-open" onclick="window.open('${escapeHtml(r.url)}', '_blank')" title="Otevrit">
                    ${iconExternal}
                </button>
                <button class="rl-btn rl-btn-del" onclick="deleteReminder(${r.id})" title="Smazat">
                    ${iconTrash}
                </button>
            </div>
        </div>
    `).join('');
    
    document.getElementById('readLaterList').innerHTML = `<div class="read-later-list">${html}</div>`;
}

function showDayReminders(dateStr) {
    const date = new Date(dateStr);
    currentWeekStart = getWeekStart(date);
    render();
}

function escapeHtml(text) {
    const div = document.createElement('div');
    div.textContent = text;
    return div.innerHTML;
}

// Modal handling
const modal = document.getElementById('addModal');
const fab = document.getElementById('openAddModal');
const closeBtn = document.getElementById('closeModal');

fab.addEventListener('click', () => {
    modal.classList.add('active');
    document.getElementById('reminderText').focus();
});

closeBtn.addEventListener('click', () => {
    modal.classList.remove('active');
});

modal.addEventListener('click', (e) => {
    if (e.target === modal) {
        modal.classList.remove('active');
    }
});

// Event listeners
document.getElementById('prevMonth').addEventListener('click', () => {
    currentMonth.setMonth(currentMonth.getMonth() - 1);
    renderCalendar();
});

document.getElementById('nextMonth').addEventListener('click', () => {
    currentMonth.setMonth(currentMonth.getMonth() + 1);
    renderCalendar();
});

document.getElementById('prevWeek').addEventListener('click', () => {
    currentWeekStart.setDate(currentWeekStart.getDate() - 7);
    render();
});

document.getElementById('nextWeek').addEventListener('click', () => {
    currentWeekStart.setDate(currentWeekStart.getDate() + 7);
    render();
});

document.getElementById('showOnlyPending').addEventListener('change', render);

document.getElementById('addForm').addEventListener('submit', async (e) => {
    e.preventDefault();
    const text = document.getElementById('reminderText').value.trim();
    const url = document.getElementById('reminderUrl').value.trim();
    const dateTime = document.getElementById('reminderDate').value;
    
    if (text) {
        await addReminder(text, url, dateTime);
        e.target.reset();
        modal.classList.remove('active');
    }
});

document.addEventListener('keydown', (e) => {
    if (e.key === 'Escape' && modal.classList.contains('active')) {
        modal.classList.remove('active');
    }
});

// Global functions
window.toggleDone = toggleDone;
window.deleteReminder = deleteReminder;
window.showDayReminders = showDayReminders;
window.addReminder = addReminder;

// Init
loadReminders();
