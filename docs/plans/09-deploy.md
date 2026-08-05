# 09 · Развёртывание: Neon + Northflank — Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Прод-окружение по ТЗ §5: БД на Neon (free), бэкенд и фронт — два сервиса Northflank (Developer-план), деплой из приватного GitHub-репозитория, миграции `prisma migrate deploy` отдельным шагом (не при старте приложения).

**Architecture:** Оба сервиса собираются Dockerfile'ами из монорепо (контекст — корень). Бэкенд — node-процесс Fastify; фронт — статика Vite за nginx с SPA-fallback, `VITE_API_URL` вшивается на этапе сборки build-arg'ом. Миграции запускаются вручную против `DIRECT_URL` перед выкаткой версии со схемными изменениями (ТЗ: «в билд-шаге, не автоматом при старте»). Свободных сервисов не остаётся — воркеров и кронов нет.

**Tech Stack:** Docker (node:22-alpine, nginx:alpine), Neon, Northflank.

**Предпосылка:** выполняется после плана 05 (к старту пилота); планы 06–08 доезжают позже обычными пушами в `main`.

---

### Task 1: Dockerfile'ы и локальная проверка сборки

**Files:**
- Create: `server/Dockerfile`
- Create: `web/Dockerfile`
- Create: `web/nginx.conf`
- Create: `.dockerignore`

- [x] **Step 1: .dockerignore**

```dockerignore
node_modules
**/node_modules
**/dist
.git
docs
.env
**/.env
```

- [x] **Step 2: Dockerfile бэкенда**

`server/Dockerfile` (контекст сборки — корень репозитория):

```dockerfile
FROM node:22-alpine
WORKDIR /app
COPY package.json package-lock.json ./
COPY server/package.json server/
RUN npm ci -w server
COPY server server
WORKDIR /app/server
RUN npx prisma generate && npm run build
ENV NODE_ENV=production
EXPOSE 3000
# Миграции НЕ здесь: prisma migrate deploy выполняется отдельным шагом (Task 2)
CMD ["node", "dist/index.js"]
```

- [x] **Step 3: Dockerfile фронта и nginx**

`web/nginx.conf`:

```nginx
server {
  listen 80;
  root /usr/share/nginx/html;
  location / {
    try_files $uri /index.html;
  }
}
```

`web/Dockerfile` (контекст — корень):

```dockerfile
FROM node:22-alpine AS build
WORKDIR /app
COPY package.json package-lock.json ./
COPY web/package.json web/
RUN npm ci -w web
COPY web web
ARG VITE_API_URL
ENV VITE_API_URL=$VITE_API_URL
RUN npm run build -w web

FROM nginx:alpine
COPY --from=build /app/web/dist /usr/share/nginx/html
COPY web/nginx.conf /etc/nginx/conf.d/default.conf
EXPOSE 80
```

- [x] **Step 4: Локальная проверка (если установлен Docker; иначе положиться на сборку Northflank)**

```powershell
docker build -f server/Dockerfile -t cv-server .
docker build -f web/Dockerfile --build-arg VITE_API_URL=http://localhost:3000 -t cv-web .
```

Expected: обе сборки завершаются без ошибок.

- [x] **Step 5: Commit**

```powershell
git add server/Dockerfile web/Dockerfile web/nginx.conf .dockerignore
git commit -m "chore: dockerfiles for northflank deploy"
```

---

### Task 2: Прод-база на Neon

- [ ] **Step 1: Создать проект**

На neon.tech: проект `clever-vibe` (регион ближе к Northflank-региону). Из Connection Details взять:
- **pooled**-строку (через pgBouncer) → это будет `DATABASE_URL`;
- **direct**-строку → `DIRECT_URL`.

- [ ] **Step 2: Применить миграции и сиды с локальной машины**

В `server/.env.production.local` (не коммитится — уже под `.gitignore` по маске `.env.*`):

```env
DATABASE_URL=<pooled-строка Neon>
DIRECT_URL=<direct-строка Neon>
ADMIN_NAME=<имя админа>
ADMIN_LOGIN=<логин админа>
ADMIN_PASSWORD=<пароль админа>
```

Из каталога `server/` (PowerShell; dotenv-переменные подхватываем вручную):

```powershell
Get-Content .env.production.local | ForEach-Object {
  if ($_ -match '^([^#=]+)=(.*)$') { Set-Item "env:$($Matches[1])" $Matches[2] }
}
npx prisma migrate deploy
npx prisma db seed
```

Expected: `All migrations have been successfully applied` и `Seed done`.

**Это же и есть процедура миграций в дальнейшем:** перед выкаткой версии со схемными изменениями повторить `npx prisma migrate deploy` с прод-переменными. Автоматического запуска миграций при старте приложения нет — осознанно (ТЗ §5).

- [ ] **Step 3: Проверить**

`npx prisma studio` с этими переменными → 9 стадий, 41 подход, инструменты, админ.

---

### Task 3: Два сервиса Northflank

- [ ] **Step 1: Проект и репозиторий**

- Убедиться, что репозиторий на GitHub **приватный** (ТЗ §5) и ветка `main` содержит текущее состояние (`git push origin main` после мержа `develop`).
- На northflank.com: создать проект `clever-vibe`, подключить GitHub-аккаунт с доступом к приватному репозиторию.

- [ ] **Step 2: Сервис бэкенда**

Создать Service → Deployment from repository:
- Repo: `clever-vibe`, branch: `main`
- Build: Dockerfile, path `server/Dockerfile`, context `/`
- Port: 3000 (HTTP, публичный)
- Environment variables:
  - `DATABASE_URL` — pooled-строка Neon
  - `DIRECT_URL` — direct-строка Neon (нужна только на случай ручных задач; миграции идут с локальной машины)
  - `ADMIN_NAME`, `ADMIN_LOGIN`, `ADMIN_PASSWORD` — как в Task 2 (используются сидом)
  - `CORS_ORIGIN` — URL фронтового сервиса (добавить после Step 3, затем redeploy)

Expected: билд зелёный; `https://<backend-url>/api/health` → `{"ok":true}`.

- [ ] **Step 3: Сервис фронта**

Создать второй Service:
- Build: Dockerfile, path `web/Dockerfile`, context `/`
- Build argument: `VITE_API_URL=https://<backend-url>` (без завершающего `/`)
- Port: 80 (HTTP, публичный)

После создания вписать URL фронта в `CORS_ORIGIN` бэкенда и redeploy бэкенда.

Expected: `https://<frontend-url>` открывает форму входа.

- [ ] **Step 4: Автодеплой**

В обоих сервисах включён автодеплой из `main` — дальнейшие модули (06–08) доезжают пушем. Northflank Developer-план: 2 сервиса, инстанс не засыпает, холодного старта нет (причина выбора — ТЗ §5).

---

### Task 4: Смоук на проде и подготовка пилота

- [ ] **Step 1: Смоук-прогон**

1. Вход админом (`ADMIN_LOGIN`/`ADMIN_PASSWORD`) → автовход после перезагрузки.
2. Все три темы переключаются, выбор переживает перезагрузку.
3. Быстрый ввод: полный цикл сохранения записи; черновик работает.
4. Создать участников пилота (лид + 3 разработчика, если план 07 готов; иначе — через `prisma studio` по процедуре из Task 2 плана 07).
5. Вход разработчиком с выданными доступами с другого браузера/профиля.
6. Деактивация тестового участника закрывает вход.

- [ ] **Step 2: Контрольный список перед стартом пилота**

- [ ] Список инструментов в справочнике заменён утверждённым (допущение №6: `server/prisma/seedData.ts` → повторить `npx prisma db seed` на проде)
- [ ] `ADMIN_PASSWORD` — не значение по умолчанию
- [ ] Доступы участникам выданы лидом и работают
- [ ] Экспорт CSV скачивается (кому положено по матрице)

- [ ] **Step 3: Зафиксировать URL'ы**

Дописать в конец `docs/plans/README.md` раздел:

```markdown
## Прод

- Фронт: https://<frontend-url>
- API: https://<backend-url>
- БД: Neon, проект clever-vibe
- Миграции: вручную `npx prisma migrate deploy` с прод-переменными перед выкаткой схемных изменений
```

```powershell
git add docs/plans/README.md
git commit -m "docs: production urls and migration procedure"
git push origin main
```

---

## Критерий готовности модуля

- Оба сервиса Northflank зелёные, автодеплой из `main` работает.
- Прод-цикл входа и записи проверен минимум двумя ролями.
- Процедура миграций задокументирована и не привязана к старту приложения.
