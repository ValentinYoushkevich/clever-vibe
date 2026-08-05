// Справочники по ТЗ §2.2, §2.3, §2.5. Порядок = порядок в ТЗ.

export const STAGES = [
  { code: 'analysis', title: 'Анализ задачи' },
  { code: 'design',   title: 'Проектирование' },
  { code: 'code',     title: 'Написание кода' },
  { code: 'refactor', title: 'Рефакторинг' },
  { code: 'debug',    title: 'Дебаг' },
  { code: 'test',     title: 'Тесты' },
  { code: 'review',   title: 'Код-ревью' },
  { code: 'docs',     title: 'Документация' },
  { code: 'misc',     title: 'Прочее' },
].map((s, i) => ({ ...s, order: i + 1 }))

interface SeedApproach {
  code: string
  stageCode: string
  title: string
  description?: string
}

const A = (stageCode: string, list: [code: string, title: string, description?: string][]) =>
  list.map(([code, title, description]) => ({ code, stageCode, title, description }))

export const APPROACHES: SeedApproach[] = [
  ...A('analysis', [
    ['an-requirements', 'Разбор требований', 'Уточняющие вопросы, edge-кейсы, что не учтено'],
    ['an-decompose', 'Декомпозиция задачи на подзадачи'],
    ['an-plan', 'Генерация плана реализации до написания кода'],
  ]),
  ...A('design', [
    ['ds-arch-options', 'Обсуждение архитектурных вариантов'],
    ['ds-structure', 'Генерация структуры модуля / контракта API / типов'],
    ['ds-self-review', 'Ревью собственного архитектурного решения'],
  ]),
  ...A('code', [
    ['cd-autocomplete', 'Автокомплит в IDE'],
    ['cd-from-description', 'Генерация по описанию задачи'],
    ['cd-chat-iterations', 'Чат-итерации', 'Сгенерировал → поправь → уточнил'],
    ['cd-agent-mode', 'Агентный режим', 'Правки в нескольких файлах'],
    ['cd-by-example', 'Генерация по образцу существующего компонента'],
    ['cd-ng-migration', 'Миграция синтаксиса между версиями Angular'],
    ['cd-boilerplate', 'Бойлерплейт', 'Конфиги, скаффолдинг, типы, моки'],
  ]),
  ...A('refactor', [
    ['rf-split', 'Разбиение большого компонента / функции'],
    ['rf-dedup', 'Устранение дублирования'],
    ['rf-legacy', 'Модернизация легаси'],
    ['rf-optimize', 'Оптимизация', 'Перф, бандл'],
  ]),
  ...A('debug', [
    ['db-stacktrace', 'Стектрейс + контекст → гипотезы причины'],
    ['db-explain-code', 'Объяснение незнакомого / легаси-кода'],
    ['db-min-repro', 'Генерация минимального репро'],
    ['db-rubber-duck', 'Проговаривание проблемы в диалоге'],
    ['db-diff-analysis', 'Анализ диффа', '«После этих изменений сломалось — где?»'],
  ]),
  ...A('test', [
    ['ts-unit-by-code', 'Генерация unit-тестов по готовому коду'],
    ['ts-scenarios-then-code', 'Список сценариев / edge-кейсов, затем код тестов'],
    ['ts-coverage-fill', 'Дописывание покрытия по отчёту coverage'],
    ['ts-fixtures', 'Генерация тестовых данных, фикстур, моков'],
    ['ts-tests-first', 'Тесты по требованиям до написания кода'],
    ['ts-e2e', 'E2E-сценарии по описанию юзер-флоу'],
  ]),
  ...A('review', [
    ['rv-self-pr', 'Само-ревью своего PR до отправки'],
    ['rv-second-opinion', 'Второе мнение по чужому PR'],
    ['rv-conventions', 'Проверка на соответствие конвенциям проекта'],
    ['rv-explain-pr', 'Объяснение чужого PR перед ревью'],
  ]),
  ...A('docs', [
    ['dc-jsdoc', 'JSDoc / комментарии по коду'],
    ['dc-readme', 'README / гайд по модулю'],
    ['dc-pr-description', 'Описание PR'],
    ['dc-changelog', 'Changelog из коммитов'],
    ['dc-refresh', 'Актуализация устаревшей документации'],
  ]),
  ...A('misc', [
    ['ms-commit-msg', 'Коммит-месседжи'],
    ['ms-build-errors', 'Разбор ошибок сборки'],
    ['ms-regex-sql-config', 'Регэкспы, SQL, конфиги'],
    ['ms-semantic-search', 'Смысловой поиск по кодбазе'],
  ]),
]

// ПЛЕЙСХОЛДЕР: заменить утверждённым в компании списком инструментов
// до развёртывания (ТЗ §2.5). Коды стабильны, менять только title/состав.
export const TOOLS = [
  { code: 'copilot', title: 'GitHub Copilot' },
  { code: 'cursor', title: 'Cursor' },
  { code: 'claude-code', title: 'Claude Code' },
  { code: 'web-chat', title: 'Чат (веб-версия)' },
]
