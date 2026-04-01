// Reminders App
// Data storage - in production this would be fetched from GitHub
let reminders = [];
let currentMonth = new Date();
let currentView = 'calendar';

// Load reminders from localStorage (for demo) or JSON file
async function loadReminders() {
    try {
        const response = await fetch('reminders.json');
        if (response.ok) {
            reminders = await response.json();
        }
    } catch (e) {
        console.log('Using localStorage or defaults');
    }
    
    // Fallback to localStorage
    const stored = localStorage.getItem('reminders');
    if (stored) {
        reminders = JSON.parse(stored);
    }
    
    render();
}

// Save reminders
function saveReminders() {
    localStorage.setItem('reminders', JSON.stringify(reminders));
    // In production, this would commit to GitHub
}

// Add new reminder
function addReminder(text, dateTime, url = '') {
    const reminder = {
        id: Date.now(),
        text,
        dateTime,
        url,
        done: false,
        createdAt: new Date().toISOString()
    };
    reminders.push(reminder);
    reminders.sort((a, b) => new Date(a.dateTime) - new Date(b.dateTime));
    saveReminders();
    render();
}

// Delete reminder
function deleteReminder(id) {
    reminders = reminders.filter(r => r.id !== id);
    saveReminders();
    render();
}

// Toggle done
function toggleDone(id) {
    const reminder = reminders.find(r => r.id === id);
    if (reminder) {
        reminder.done = !reminder.done;
        saveReminders();
        render();
    }
}

// Render everything
function render() {
    renderStats();
    renderCalendar();
    renderList();
}

// Stats
function renderStats() {
    const today = new Date();
    today.setHours(0, 0, 0, 0);
    const weekEnd = new Date(today);
    weekEnd.setDate(weekEnd.getDate() + 7);
    
    const todayCount = reminders.filter(r => {
        const d = new Date(r.dateTime);
        d.setHours(0, 0, 0, 0);
        return d.getTime() === today.getTime() && !r.done;
    }).length;
    
    const upcomingCount = reminders.filter(r => {
        const d = new Date(r.dateTime);
        return d >= today && d <= weekEnd && !r.done;
    }).length;
    
    document.getElementById('totalCount').textContent = reminders.filter(r => !r.done).length;
    document.getElementById('todayCount').textContent = todayCount;
    document.getElementById('upcomingCount').textContent = upcomingCount;
}

// Calendar
function renderCalendar() {
    const year = currentMonth.getFullYear();
    const month = currentMonth.getMonth();
    
    const monthNames = ['Leden', 'Únor', 'Březen', 'Duben', 'Květen', 'Červen', 
                        'Červenec', 'Srpen', 'Září', 'Říjen', 'Listopad', 'Prosinec'];
    
    document.getElementById('currentMonth').textContent = `${monthNames[month]} ${year}`;
    
    const firstDay = new Date(year, month, 1);
    const lastDay = new Date(year, month + 1, 0);
    const startDay = (firstDay.getDay() + 6) % 7; // Monday = 0
    const daysInMonth = lastDay.getDate();
    
    const today = new Date();
    today.setHours(0, 0, 0, 0);
    
    let html = '';
    
    // Previous month days
    const prevMonth = new Date(year, month, 0);
    for (let i = startDay - 1; i >= 0; i--) {
        const day = prevMonth.getDate() - i;
        html += `<div class="calendar-day other-month"><span class="day-number">${day}</span></div>`;
    }
    
    // Current month days
    for (let day = 1; day <= daysInMonth; day++) {
        const date = new Date(year, month, day);
        const dateStr = date.toISOString().split('T')[0];
        const dayReminders = reminders.filter(r => r.dateTime.split('T')[0] === dateStr);
        const isToday = date.getTime() === today.getTime();
        
        let classes = 'calendar-day';
        if (isToday) classes += ' today';
        if (dayReminders.length > 0) classes += ' has-reminders';
        
        let dots = dayReminders.map(r => 
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

// List view
function renderList() {
    const statusFilter = document.getElementById('statusFilter').value;
    const dateFilter = document.getElementById('dateFilter').value;
    
    const today = new Date();
    today.setHours(0, 0, 0, 0);
    const weekEnd = new Date(today);
    weekEnd.setDate(weekEnd.getDate() + 7);
    const monthEnd = new Date(today);
    monthEnd.setMonth(monthEnd.getMonth() + 1);
    
    let filtered = reminders.filter(r => {
        const d = new Date(r.dateTime);
        
        if (statusFilter === 'pending' && r.done) return false;
        if (statusFilter === 'done' && !r.done) return false;
        
        if (dateFilter === 'today') {
            d.setHours(0, 0, 0, 0);
            return d.getTime() === today.getTime();
        }
        if (dateFilter === 'week') {
            return d >= today && d <= weekEnd;
        }
        if (dateFilter === 'month') {
            return d >= today && d <= monthEnd;
        }
        
        return true;
    });
    
    if (filtered.length === 0) {
        document.getElementById('remindersList').innerHTML = `
            <div class="empty-state">
                <h3>📭 Žádné remindery</h3>
                <p>Přidej nový reminder pomocí formuláře níže</p>
            </div>
        `;
        return;
    }
    
    const html = filtered.map(r => {
        const date = new Date(r.dateTime);
        const dateStr = date.toLocaleDateString('cs-CZ', { day: 'numeric', month: 'short' });
        const timeStr = date.toLocaleTimeString('cs-CZ', { hour: '2-digit', minute: '2-digit' });
        
        return `
            <div class="reminder-card ${r.done ? 'done' : ''}">
                <div class="reminder-info">
                    <div class="reminder-text">${escapeHtml(r.text)}</div>
                    <div class="reminder-meta">
                        <span>📅 ${dateStr} ${timeStr}</span>
                        ${r.url ? `<a href="${escapeHtml(r.url)}" target="_blank" class="reminder-url">🔗 Odkaz</a>` : ''}
                    </div>
                </div>
                <div class="reminder-actions">
                    <button class="btn-done" onclick="toggleDone(${r.id})">${r.done ? '↩️' : '✅'}</button>
                    <button class="btn-delete" onclick="deleteReminder(${r.id})">🗑️</button>
                </div>
            </div>
        `;
    }).join('');
    
    document.getElementById('remindersList').innerHTML = html;
}

// Show reminders for a specific day
function showDayReminders(dateStr) {
    const dayReminders = reminders.filter(r => r.dateTime.split('T')[0] === dateStr);
    if (dayReminders.length === 0) return;
    
    // Switch to list view filtered by date
    document.getElementById('dateFilter').value = 'all';
    document.getElementById('listViewBtn').click();
    
    // Show only this day's reminders
    const listEl = document.getElementById('remindersList');
    const date = new Date(dateStr);
    const dateFormatted = date.toLocaleDateString('cs-CZ', { day: 'numeric', month: 'long' });
    
    const html = dayReminders.map(r => {
        const d = new Date(r.dateTime);
        const timeStr = d.toLocaleTimeString('cs-CZ', { hour: '2-digit', minute: '2-digit' });
        
        return `
            <div class="reminder-card ${r.done ? 'done' : ''}">
                <div class="reminder-info">
                    <div class="reminder-text">${escapeHtml(r.text)}</div>
                    <div class="reminder-meta">
                        <span>🕐 ${timeStr}</span>
                        ${r.url ? `<a href="${escapeHtml(r.url)}" target="_blank" class="reminder-url">🔗 Odkaz</a>` : ''}
                    </div>
                </div>
                <div class="reminder-actions">
                    <button class="btn-done" onclick="toggleDone(${r.id})">${r.done ? '↩️' : '✅'}</button>
                    <button class="btn-delete" onclick="deleteReminder(${r.id})">🗑️</button>
                </div>
            </div>
        `;
    }).join('');
    
    listEl.innerHTML = html;
}

// Helper
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

document.getElementById('calendarViewBtn').addEventListener('click', () => {
    currentView = 'calendar';
    document.getElementById('calendarView').classList.remove('hidden');
    document.getElementById('listView').classList.add('hidden');
    document.getElementById('calendarViewBtn').classList.add('active');
    document.getElementById('listViewBtn').classList.remove('active');
    renderCalendar();
});

document.getElementById('listViewBtn').addEventListener('click', () => {
    currentView = 'list';
    document.getElementById('calendarView').classList.add('hidden');
    document.getElementById('listView').classList.remove('hidden');
    document.getElementById('listViewBtn').classList.add('active');
    document.getElementById('calendarViewBtn').classList.remove('active');
    renderList();
});

document.getElementById('statusFilter').addEventListener('change', renderList);
document.getElementById('dateFilter').addEventListener('change', renderList);

document.getElementById('addReminderForm').addEventListener('submit', (e) => {
    e.preventDefault();
    const text = document.getElementById('reminderText').value;
    const dateTime = document.getElementById('reminderDate').value;
    const url = document.getElementById('reminderUrl').value;
    
    if (text && dateTime) {
        addReminder(text, dateTime, url);
        e.target.reset();
    }
});

// Make functions globally available
window.toggleDone = toggleDone;
window.deleteReminder = deleteReminder;
window.showDayReminders = showDayReminders;

// Init
loadReminders();
