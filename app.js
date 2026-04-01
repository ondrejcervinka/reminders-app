// Saved & Reminders App
let reminders = [];
let currentMonth = new Date();

// Load reminders
async function loadReminders() {
    try {
        const response = await fetch('reminders.json');
        if (response.ok) {
            reminders = await response.json();
        }
    } catch (e) {
        console.log('Using localStorage');
    }
    
    const stored = localStorage.getItem('reminders_v2');
    if (stored) {
        reminders = JSON.parse(stored);
    }
    
    render();
}

function saveReminders() {
    localStorage.setItem('reminders_v2', JSON.stringify(reminders));
}

function addReminder(text, url = '', dateTime = '') {
    const reminder = {
        id: Date.now(),
        text,
        url,
        dateTime,
        done: false,
        createdAt: new Date().toISOString()
    };
    
    reminders.push(reminder);
    reminders.sort((a, b) => {
        if (!a.dateTime && !b.dateTime) return 0;
        if (!a.dateTime) return 1;
        if (!b.dateTime) return -1;
        return new Date(a.dateTime) - new Date(b.dateTime);
    });
    
    saveReminders();
    render();
    return reminder;
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
    
    const monthNames = ['Leden', 'Únor', 'Březen', 'Duben', 'Květen', 'Červen', 
                        'Červenec', 'Srpen', 'Září', 'Říjen', 'Listopad', 'Prosinec'];
    
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
        
        const dots = dayReminders.slice(0, 5).map(r => 
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
    
    // Sort by date ascending
    filtered.sort((a, b) => new Date(a.dateTime) - new Date(b.dateTime));
    
    if (filtered.length === 0) {
        document.getElementById('remindersList').innerHTML = `
            <div class="empty-state">
                <h3>📅 Žádné úkoly</h3>
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
    
    // Sort by created desc (newest first)
    filtered.sort((a, b) => new Date(b.createdAt) - new Date(a.createdAt));
    
    if (filtered.length === 0) {
        document.getElementById('readLaterList').innerHTML = `
            <div class="empty-state">
                <h3>📌 Nic k přečtení</h3>
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
    let label = '📌';
    
    if (hasDate) {
        const date = new Date(r.dateTime);
        dateStr = date.toLocaleDateString('cs-CZ', { day: 'numeric', month: 'short' });
        timeStr = date.toLocaleTimeString('cs-CZ', { hour: '2-digit', minute: '2-digit' });
        label = '📅';
    }
    
    return `
        <div class="reminder-card ${r.done ? 'done' : ''}">
            <div class="reminder-info">
                <div class="reminder-text">${escapeHtml(r.text)}</div>
                <div class="reminder-meta">
                    ${hasDate ? `<span>${label} ${dateStr} ${timeStr}</span>` : ''}
                    ${r.url ? `<a href="${escapeHtml(r.url)}" target="_blank" class="reminder-url">🔗</a>` : ''}
                </div>
            </div>
            <div class="reminder-actions">
                <button class="btn-done" onclick="toggleDone(${r.id})">${r.done ? '↩️' : '✅'}</button>
                <button class="btn-delete" onclick="deleteReminder(${r.id})">🗑️</button>
            </div>
        </div>
    `;
}

function showDayReminders(dateStr) {
    // Highlight the day by scrolling to reminders
    renderRemindersWithDate();
}

function escapeHtml(text) {
    const div = document.createElement('div');
    div.textContent = text;
    return div.innerHTML;
}

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

document.getElementById('addForm').addEventListener('submit', (e) => {
    e.preventDefault();
    const text = document.getElementById('reminderText').value.trim();
    const url = document.getElementById('reminderUrl').value.trim();
    const dateTime = document.getElementById('reminderDate').value;
    
    if (text) {
        addReminder(text, url, dateTime);
        e.target.reset();
    }
});

// Global functions
window.toggleDone = toggleDone;
window.deleteReminder = deleteReminder;
window.showDayReminders = showDayReminders;
window.addReminder = addReminder;

// Init
loadReminders();
