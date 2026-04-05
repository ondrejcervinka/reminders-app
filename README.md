# Reminders App

Osobní webová aplikace pro správu reminderů a záložek "K přečtení". Běží jako statická stránka na GitHub Pages. Zdrojem pravdy je `data/reminders.json` v tomto repozitáři — všechny změny provedené přes UI se zapisují přímo do tohoto souboru přes GitHub API.

**Live URL:** `https://ondrejcervinka.github.io/reminders-app/`

---

## Architektura

Čistý Vanilla JS, žádný framework ani build step. Tři soubory + datový JSON.

```
reminders-app/
├── index.html            # HTML struktura, žádná logika
├── app.js                # Veškerá aplikační logika (~550 řádků)
├── style.css             # Styly (~650 řádků), CSS variables
├── data/
│   └── reminders.json    # Zdroj pravdy pro data
└── README.md
```

### Layout (2 sloupce)

```
┌──────────────────────────────────────────────────────┐
│  Sidebar (236px, fixed)  │  Main content (flex-grow)  │
│                          │                            │
│  • Brand + logo          │  Header bar:               │
│  • "+ Pridat" button     │    Měsíc/Týden label       │
│  • Mini měsíční kalendář │    prev/next navigace      │
│  • Úlohy (tasks)         │    "Dnes" button           │
│  • K přečtení (read      │    Sync status badge       │
│    later)                │    Tabs: Mesicni/Tydenny   │
│                          │                            │
│                          │  Monthly view (default):   │
│                          │    7×6 mřížka, event pills │
│                          │  Weekly view (tab):        │
│                          │    časová osa 6:00–22:00   │
└──────────────────────────────────────────────────────┘
```

---

## Datový model

Každý reminder v `data/reminders.json` má tuto strukturu:

```json
{
  "id": 1744900000000,
  "text": "Popis úkolu nebo záložky",
  "url": "https://...",
  "dateTime": "2026-04-10T14:00:00",
  "done": false,
  "createdAt": "2026-04-05T10:00:00Z",
  "title": "Název načtený z URL (volitelně)",
  "description": "Popis načtený z URL meta tagů (volitelně)"
}
```

**Typy reminderů podle kombinace polí:**

| `dateTime` | `url`  | Zobrazuje se jako        |
|------------|--------|--------------------------|
| vyplněno   | —      | Úloha v kalendáři        |
| vyplněno   | URL    | Událost s odkazem        |
| prázdné    | URL    | K přečtení (read later)  |
| prázdné    | —      | Volná poznámka (sidebar) |

**ID:** `Date.now()` při přidání přes UI. V JSON lze použít libovolné unikátní číslo — duplicitní IDs způsobují chyby v toggle/delete.

---

## Tok dat

### Načítání

```
app start
  └─► fetch raw.githubusercontent.com/…/data/reminders.json?_=timestamp
        ├─ OK   → reminders = data, render()
        └─ fail → fetch data/reminders.json (lokální fallback), render()
```

Cache buster (`?_=timestamp`) zajišťuje, že se vždy načte aktuální verze, ne CDN cache.

### Ukládání (každá změna)

```
toggleDone / deleteReminder / addReminder
  └─► saveReminders()
        └─► saveToGitHub()
              ├─ GET /repos/{owner}/{repo}/contents/{file}  → získá SHA souboru
              └─ PUT /repos/{owner}/{repo}/contents/{file}  → zapíše nový obsah (base64)
```

**GitHub token:** Uložený v `localStorage` pod klíčem `gh_token`. Při první změně app zobrazí `prompt()` pro zadání tokenu. Pokud API vrátí 401, token se smaže a uživatel je vyzván znovu.

**Potřebný scope tokenu:** Fine-grained Personal Access Token → repo `reminders-app` → Contents: Read and write.

---

## Klíčové funkce v app.js

| Funkce | Popis |
|--------|-------|
| `loadReminders()` | Fetch JSON z GitHubu (raw URL + cache buster), render |
| `saveReminders()` | Volá `saveToGitHub()` |
| `saveToGitHub()` | GitHub API PUT, spravuje token, zobrazuje sync status |
| `getFileSha(token)` | Načte aktuální SHA souboru (nutné pro GitHub API update) |
| `setSyncStatus(state, msg)` | Aktualizuje badge v headeru: `saving` / `ok` / `error` |
| `render()` | Volá všechny dílčí render funkce |
| `renderMiniCalendar()` | Mini kalendář v sidebaru |
| `renderMainHeader()` | Label v hlavním headeru (měsíc nebo týden) |
| `renderMainMonthCalendar()` | Hlavní měsíční mřížka s event pills |
| `renderWeeklyCalendar()` | Týdenní pohled s časovou osou |
| `renderTaskListCompact()` | Seznam úkolů v sidebaru |
| `renderReadLaterList()` | Záložky "K přečtení" v sidebaru |
| `buildCell(day, dateStr, ...)` | Sestaví HTML jedné buňky měsíčního pohledu |
| `getPillColor(id)` | Barva pill badge dle `id % 8` |
| `jumpToDate(dateStr)` | Skočí na datum — synchronizuje mini kal i main view |
| `addReminder(text, url, dt)` | Přidá reminder, volitelně fetchne meta z URL |
| `sortReminders()` | Seřadí dle dateTime, bez data jdou na konec |

---

## CSS proměnné (design systém)

```css
--accent: #4F46E5          /* Indigo — primary action color */
--accent-light: #EEF2FF    /* Indigo pale — hover bg, pill bg */
--accent-hover: #4338CA    /* Indigo dark — button hover */
--bg: #F1F5F9              /* Slate 100 — app background */
--surface: #FFFFFF          /* White — sidebar, cards */
--border: #E2E8F0          /* Slate 200 — borders */
--text: #0F172A            /* Slate 900 — primary text */
--text-muted: #64748B      /* Slate 500 — secondary text */
--text-faint: #94A3B8      /* Slate 400 — labels, placeholders */
--sidebar-w: 236px
--header-h: 60px
--font: 'Plus Jakarta Sans'
```

**Event pill barvy** — 8 barev rotujících dle `id % 8`:

```js
const PILL_COLORS = [
    { bg: '#EEF2FF', fg: '#4338CA' },  // indigo
    { bg: '#ECFDF5', fg: '#047857' },  // emerald
    { bg: '#EFF6FF', fg: '#1D4ED8' },  // blue
    { bg: '#FFF7ED', fg: '#C2410C' },  // orange
    { bg: '#FDF4FF', fg: '#7E22CE' },  // purple
    { bg: '#F0FDFA', fg: '#0F766E' },  // teal
    { bg: '#FEF2F2', fg: '#B91C1C' },  // red
    { bg: '#FEFCE8', fg: '#A16207' },  // amber
];
```

---

## Stav funkcí

| Funkce | Stav | Poznámka |
|--------|------|----------|
| Měsíční pohled | ✅ | Výchozí view |
| Týdenní pohled | ✅ | Tab toggle |
| Přidávání reminderů | ✅ | Modal, FAB tlačítko |
| Mazání | ✅ | Zapisuje přes GitHub API |
| Toggle done | ✅ | Zapisuje přes GitHub API |
| Filtr "Jen čekající" | ✅ | Checkbox v sidebaru |
| Ukládání do GitHub | ✅ | Vyžaduje PAT token |
| Sync status badge | ✅ | V hlavním headeru |
| URL meta fetch | ⚠️ | Přes `allorigins.win` proxy — nestabilní |
| Telegram bot `/r` | ❌ | Zmíněno v UI ale neimplementováno |
| Multi-device sync | ✅ | Každý load čte aktuální JSON z GitHubu |

---

## Lokální vývoj

```bash
# Musí běžet HTTP server kvůli fetch() a CORS
python3 -m http.server 8000
# nebo
npx serve .

# Otevři http://localhost:8000
```

> **Pozor:** `loadReminders()` vždy fetchuje z `raw.githubusercontent.com`, ne z lokálního souboru. Pro testování lokálních dat změň první `fetch()` v `loadReminders()` na `data/reminders.json` (relativní cesta).

---

## Možná vylepšení

- **Token bezpečnost:** Přesunout GitHub token na Cloudflare Worker — app posílá data na Worker, Worker zapisuje do GitHubu. Token nikdy nevidí browser.
- **Optimistický UI:** Zobrazit změny okamžitě a GitHub zápis dělat na pozadí. Aktuálně se čeká na SHA fetch (~1s) před každým zápisem.
- **Telegram bot:** Implementovat `/r URL` příkaz pro přidání záložky přes Telegram (zmíněno v UI nápovědě).
- **Offline support:** Service Worker pro cachování + fronta zápisů při offline.
- **Drag & drop:** Přesun reminderů v kalendáři.
- **Opakující se úlohy:** Podpora `recurrence` pole v datovém modelu.
