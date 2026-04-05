// Reminders App
let reminders = [];
let currentMonth = new Date();

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
        
        // Extract title
        const titleMatch = html.match(/<title[^>]*>([^<]+)<\/title>/i);
        const title = titleMatch ? titleMatch[1].trim() : '';
        
        // Extract meta description
        const descMatch = html.match(/<meta[^>]*name=["']description["'][^>]*content=["']([^"']+)["']/i);
        const description = descMatch ? descMatch[1].trim() : '';
        
        // Extract og:image for thumbnail
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
    
    // Auto-summarize URL if provided
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
    renderRemindersWithDate();
    renderReadLater();
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
    
    const showPending = document.getElementById('showOnlyPending').checked;
    
    let html = '';
    
    // Previous month days
    const prevMonth = new Date(year, month, 0);
    for (let i = startDay - 1; i >= 0; i--) {
        html += `<div class="calendar-day other-month"><span class="day-number">${prevMonth.getDate() - i}</span></div>`;
    }
    
    // Current month days
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
    
    // Next month days
    const totalCells = startDay + daysInMonth;
    const remaining = totalCells % 7 === 0 ? 0 : 7 - (totalCells % 7);
    for (let day = 1; day <= remaining; day++) {
        html += `<div class="calendar-day other-month"><span class="day-number">${day}</span></div>`;
    }
    
    document.getElementById('calendarDays').innerHTML = html;
}

function renderRemindersWithDate() {
    const showPending = document.getElementById('showOnlyPending').checked;
    
    let filtered = reminders.filter(r => r.dateTime);
    if (showPending) {
        filtered = filtered.filter(r => !r.done);
    }
    
    filtered.sort((a, b) => new Date(a.dateTime) - new Date(b.dateTime));
    
    if (filtered.length === 0) {
        document.getElementById('remindersList').innerHTML = `
            <div class="empty-state">
                <h3>Zadne ulohy</h3>
            </div>
        `;
        return;
    }
    
    const html = filtered.map(r => createReminderCard(r)).join('');
    document.getElementById('remindersList').innerHTML = `<div class="column-content">${html}</div>`;
}

function renderReadLater() {
    const showPending = document.getElementById('showOnlyPending').checked;
    
    let filtered = reminders.filter(r => !r.dateTime);
    if (showPending) {
        filtered = filtered.filter(r => !r.done);
    }
    
    filtered.sort((a, b) => new Date(b.createdAt) - new Date(a.createdAt));
    
    if (filtered.length === 0) {
        document.getElementById('readLaterList').innerHTML = `
            <div class="empty-state">
                <h3>Nic k precteni</h3>
            </div>
        `;
        return;
    }
    
    const html = filtered.map(r => createReminderCard(r)).join('');
    document.getElementById('readLaterList').innerHTML = `<div class="column-content">${html}</div>`;
}

function createReminderCard(r) {
    const hasDate = r.dateTime;
    let dateStr = '';
    let timeStr = '';
    
    if (hasDate) {
        const date = new Date(r.dateTime);
        dateStr = date.toLocaleDateString('cs-CZ', { day: 'numeric', month: 'short' });
        timeStr = date.toLocaleTimeString('cs-CZ', { hour: '2-digit', minute: '2-digit' });
    }
    
    const displayTitle = r.title || escapeHtml(r.text);
    const displayExcerpt = r.description ? `<div class="reminder-excerpt">${escapeHtml(r.description)}</div>` : '';
    
    const iconCalendar = `<svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><rect x="3" y="4" width="18" height="18" rx="2" ry="2"/><line x1="16" y1="2" x2="16" y2="6"/><line x1="8" y1="2" x2="8" y2="6"/><line x1="3" y1="10" x2="21" y2="10"/></svg>`;
    const iconLink = `<svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><path d="M10 13a5 5 0 0 0 7.54.54l3-3a5 5 0 0 0-7.07-7.07l-1.72 1.71"/><path d="M14 11a5 5 0 0 0-7.54-.54l-3 3a5 5 0 0 0 7.07 7.07l1.71-1.71"/></svg>`;
    const iconCheck = `<svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5"><polyline points="20 6 9 17 4 12"/></svg>`;
    const iconTrash = `<svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><polyline points="3 6 5 6 21 6"/><path d="M19 6v14a2 2 0 0 1-2 2H7a2 2 0 0 1-2-2V6m3 0V4a2 2 0 0 1 2-2h4a2 2 0 0 1 2 2v2"/></svg>`;
    
    return `
        <div class="reminder-card ${r.done ? 'done' : ''}">
            <div class="reminder-header">
                <div class="reminder-text">${escapeHtml(displayTitle)}</div>
                <div class="reminder-actions">
                    <button class="btn-done" onclick="toggleDone(${r.id})" title="${r.done ? 'Obnovit' : 'Hotovo'}">
                        ${iconCheck}
                    </button>
                    <button class="btn-delete" onclick="deleteReminder(${r.id})" title="Smazat">
                        ${iconTrash}
                    </button>
                </div>
            </div>
            ${displayExcerpt}
            <div class="reminder-meta">
                ${hasDate ? `<span class="reminder-date">${iconCalendar} ${dateStr} ${timeStr}</span>` : ''}
                ${r.url ? `<a href="${escapeHtml(r.url)}" target="_blank" class="reminder-url">${iconLink} Odkaz</a>` : ''}
            </div>
        </div>
    `;
}

function showDayReminders(dateStr) {
    renderRemindersWithDate();
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

// Keyboard shortcut to close modal
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
