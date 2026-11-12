# Appoez Server

Discord-бот (discord.js + discord-player: модерация, приватные комнаты, логи войса, музыка, статистика) и дашборд на Next.js (App Router) + PostgreSQL через Drizzle ORM. Готов к деплою на Railway.

## Что было сломано и починено для Railway

| Проблема | Симптом | Фикс |
| --- | --- | --- |
| Главная страница падала с 500 при недоступной БД | «Deploy Active», но сайт не работает | Отказоустойчивый дашборд: показывает статус и диагностику вместо 500 |
| `src/db/index.ts` кидал исключение при импорте без `DATABASE_URL` | Падение всех маршрутов, трогающих БД | Ленивая инициализация пула, proxy-экспорт `db` |
| Бот стартовал только при ручном вызове `/api/bot-start` | Бот вечно офлайн после деплоя | Автостарт через `src/instrumentation.ts` при загрузке сервера |
| `.env` был закоммичен в репозиторий | Утечка `DATABASE_URL` | Удалён из индекса git, добавлен `.env.example` |
| Нет конфигурации Railway | Нестабильный старт/healthcheck | `railway.json`: `0.0.0.0:$PORT`, healthcheck `/api/health`, restart policy |
| Нет закреплённой версии Node | Случайная версия Node на билдах | `.nvmrc` → 22 (`engines.node >= 22`) |
| Нет SSL для внешних Postgres | Ошибки подключения к managed-БД | Авто-SSL: выключен для `localhost`/`*.railway.internal` |
| Ошибки в обработчиках событий могли ронять процесс | Краши контейнера | Все event-хендлеры обёрнуты в `.catch` |

## Переменные окружения

Скопируйте `.env.example` → `.env` для локальной разработки.

| Переменная | Описание |
| --- | --- |
| `DISCORD_TOKEN` | Токен бота из [Developer Portal](https://discord.com/developers/applications) |
| `DISCORD_CLIENT_ID` | Application ID бота |
| `DATABASE_URL` | Строка подключения PostgreSQL |
| `PORT` | Порт (Railway выставляет автоматически) |

## Деплой на Railway

1. **PostgreSQL**: в проекте Railway → `Add` → `Database` → `PostgreSQL`.
2. **Привязка БД**: сервис приложения → `Variables` →
   ```
   DATABASE_URL=${{ Postgres.DATABASE_URL }}
   ```
3. **Discord**: добавьте `DISCORD_TOKEN` и `DISCORD_CLIENT_ID`.
4. **Redeploy**. Старт: `npx next start -H 0.0.0.0 -p $PORT` (прописано в `railway.json`), healthcheck `GET /api/health`.
5. **Схема БД** (один раз, локально):
   ```bash
   DATABASE_URL="<public-url из сервиса Postgres>" npx drizzle-kit push
   ```
   Или из контейнера: `railway run npx drizzle-kit push`.
6. Проверка: `/` — дашборд, `/api/health` — JSON-статус (база + бот).

## Локальная разработка

```bash
cp .env.example .env
npm install
npm run dev
```

## Маршруты

| Путь | Назначение |
| --- | --- |
| `/` | Дашборд: топ участников, статус бота и БД |
| `/api/health` | Liveness + статусы БД и бота (используется Railway healthcheck) |
| `/api/bot-start` | Ручной запуск бота (автостарт уже есть через instrumentation) |

## Слеш-команды бота

`сетап` — настройка ролей/каналов сервера · `муте` — таймаут пользователя · `делит` — удаление каналов (владелец) · `стата` — статистика · `плей` — музыка (discord-player).

## Требования

Node.js 22+ · PostgreSQL. Токен нельзя коммитить — после того как `.env` побывал в git-истории, **поменяйте пароль БД / перевыпустите все секреты, которые там лежали**.
