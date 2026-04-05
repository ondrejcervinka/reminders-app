# Reminders App 🔔

Jednoduchá webová aplikace pro správu reminderů.

## Struktura

```
├── index.html          # Hlavní stránka
├── app.js              # Aplikační logika
├── style.css           # Styly
├── data/
│   └── reminders.json  # Data (Git-verzovaná)
└── README.md
```

## Funkce

- 📅 **Kalendářní pohled** - vizuální přehled reminderů po dnech
- 📋 **Seznamový pohled** - filtrování podle stavu a data
- ➕ **Přidávání reminderů** - s možností přidat URL odkaz
- ✅ **Označení hotovo** - trackuj co je hotové
- 🗑️ **Mazání** - jedním kliknutím

## Tech Stack

- Vanilla HTML/CSS/JS
- Data oddělená v `data/reminders.json`
- Lokální storage jako fallback

## Nastavení GitHub Pages

1. Pushni toto do GitHub repo
2. Nastav GitHub Pages na `main` branch
3. Aplikace bude dostupná na: `https://ondrejcervinka.github.io/reminders-app/`

## Lokální vývoj

```bash
# Servírování přes HTTP (pro CORS na fetch)
python3 -m http.server 8000

# Otevři http://localhost:8000
```

## Development workflow

1. Vytvoř branch: `git checkout -b feature/nove-uxe`
2. Uprav kód nebo data
3. Commitni a pushni: `git push origin feature/nove-uxe`
4. Merge do main → automatický rebuild na GitHub Pages
