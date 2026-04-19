# Promo Codes API

REST API для системы промокодов на `NestJS + Prisma + PostgreSQL`.

## Что реализовано

- CRUD для промокодов:
  - `POST /promo-codes`
  - `GET /promo-codes`
  - `GET /promo-codes/:id`
  - `PATCH /promo-codes/:id`
  - `DELETE /promo-codes/:id`
- Активация промокода:
  - `POST /promo-codes/activate`
- Простой health endpoint:
  - `GET /health`
- DTO и валидация через `class-validator`
- Понятные HTTP-статусы ошибок
- Ограничения и уникальность на уровне БД
- Защита от race condition при активации через транзакцию, `SERIALIZABLE` и блокировку строки промокода `FOR UPDATE`

## Стек

- Node.js
- TypeScript
- NestJS
- Prisma
- PostgreSQL

## Структура проекта

```text
.
|-- .env.example
|-- docker-compose.yml
|-- nest-cli.json
|-- package.json
|-- prisma
|   |-- migrations
|   |   `-- 20260419000000_init
|   |       `-- migration.sql
|   `-- schema.prisma
|-- README.md
|-- src
|   |-- app.module.ts
|   |-- common
|   |   `-- filters
|   |       `-- prisma-client-exception.filter.ts
|   |-- database
|   |   |-- prisma.module.ts
|   |   `-- prisma.service.ts
|   |-- health
|   |   `-- health.controller.ts
|   |-- main.ts
|   `-- promo-codes
|       |-- dto
|       |   |-- activate-promo-code.dto.ts
|       |   |-- create-promo-code.dto.ts
|       |   `-- update-promo-code.dto.ts
|       |-- promo-codes.controller.ts
|       |-- promo-codes.module.ts
|       `-- promo-codes.service.ts
|-- tsconfig.build.json
`-- tsconfig.json
```

## Запуск

### 1. Поднять PostgreSQL

```bash
docker compose up -d
```

### 2. Подготовить переменные окружения

```bash
cp .env.example .env
```

Для Windows PowerShell:

```powershell
Copy-Item .env.example .env
```

### 3. Установить зависимости

```bash
npm install
```

### 4. Сгенерировать Prisma Client

```bash
npx prisma generate
```

### 5. Применить миграции

```bash
npx prisma migrate deploy
```

Для локальной разработки можно использовать:

```bash
npx prisma migrate dev
```

### 6. Запустить приложение

```bash
npm run start:dev
```

Приложение будет доступно по адресу:

```text
http://localhost:3000
```

## Переменные окружения

```env
PORT=3000
DATABASE_URL="postgresql://postgres:postgres@localhost:5432/promo_codes?schema=public"
```

## Prisma и ограничения БД

В проекте зафиксированы важные ограничения на уровне базы:

- `PromoCode.code` уникален через `@unique`
- `Activation(promoCodeId, email)` уникальны через `@@unique([promoCodeId, email])`
- связь `Activation -> PromoCode` настроена с `ON DELETE CASCADE`

## Защита от конкурентной активации

Активация реализована в транзакции Prisma с уровнем изоляции `SERIALIZABLE`.

Дополнительно используется:

- блокировка строки промокода через `SELECT ... FOR UPDATE`
- проверка существующей активации для `(promoCodeId, email)`
- пересчёт числа активаций внутри той же транзакции
- уникальный индекс на `(promoCodeId, email)`
- повтор транзакции при сериализационных конфликтах (`P2034`)

Это не позволяет превысить лимит при одновременных запросах.

## Формат API

### Создать промокод

`POST /promo-codes`

```json
{
  "code": "PROMO10",
  "discountPercent": 10,
  "activationLimit": 100,
  "expiresAt": "2026-12-31T23:59:59.000Z"
}
```

### Активировать промокод

`POST /promo-codes/activate`

```json
{
  "code": "PROMO10",
  "email": "user@example.com"
}
```

## Ожидаемые статусы при активации

- `404 Not Found` если промокод не найден
- `409 Conflict` если этот email уже активировал данный промокод
- `409 Conflict` если исчерпан лимит активаций
- `409 Conflict` если промокод просрочен
- `201 Created` если активация успешна

## Примечания

- Авторизация отсутствует по условию задания
- Frontend отсутствует по условию задания
- Docker Compose добавлен только для PostgreSQL
