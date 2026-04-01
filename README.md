# Reminders App 🔔

Jednoduchá webová aplikace pro správu reminderů.

## Funkce

- 📅 **Kalendářní pohled** - vizuální přehled reminderů po dnech
- 📋 **Seznamový pohled** - filtrování podle stavu a data
- ➕ **Přidávání reminderů** - s možností přidat URL odkaz
- ✅ **Označení hotovo** - trackuj co je hotové
- 🗑️ **Mazání** - jedním kliknutím

## Tech Stack

- Vanilla HTML/CSS/JS
- Data ukládána v `reminders.json`
- Lokální storage pro demo (lze rozšířit o GitHub API sync)

## Nastavení GitHub Pages

1. Pushni toto do GitHub repo
2. Nastav GitHub Pages na `main` branch
3. Aplikace bude dostupná na: `https://ondrejcervinka.github.io/reminders-app/`

## Synchronizace s cron jobs

Pro automatickou synchronizaci s OpenClaw cron jobs:

```bash
# Přidej do crontab - webhook nebo GitHub Action
# TODO: Implementovat GitHub Action workflow
```

## Lokální vývoj

Jednoduše otevři `index.html` v prohlížeči.

Pro práci s JSON soubory doporučuji použít `python3 -m http.server 8000`.
