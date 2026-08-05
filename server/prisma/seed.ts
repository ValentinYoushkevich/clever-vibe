import { PrismaClient } from '@prisma/client'
import { STAGES, APPROACHES, TOOLS } from './seedData.js'

const prisma = new PrismaClient()

async function main() {
  for (const s of STAGES) {
    await prisma.stage.upsert({
      where: { code: s.code },
      update: { title: s.title, order: s.order },
      create: s,
    })
  }

  const stages = await prisma.stage.findMany()
  const stageIdByCode = new Map(stages.map((s) => [s.code, s.id]))

  for (const [i, a] of APPROACHES.entries()) {
    const stageId = stageIdByCode.get(a.stageCode)!
    await prisma.approach.upsert({
      where: { code: a.code },
      update: { title: a.title, description: a.description ?? null, order: i + 1, stageId },
      create: {
        code: a.code,
        stageId,
        title: a.title,
        description: a.description ?? null,
        order: i + 1,
      },
    })
  }

  for (const t of TOOLS) {
    await prisma.tool.upsert({
      where: { code: t.code },
      update: { title: t.title },
      create: t,
    })
  }

  // Первый админ — из переменных окружения (ТЗ §3.5, открытый вопрос закрыт сидом)
  const { ADMIN_NAME, ADMIN_LOGIN, ADMIN_PASSWORD } = process.env
  if (!ADMIN_LOGIN || !ADMIN_PASSWORD) {
    throw new Error('ADMIN_LOGIN и ADMIN_PASSWORD обязательны для сида')
  }
  await prisma.user.upsert({
    where: { login: ADMIN_LOGIN },
    update: {},
    create: {
      name: ADMIN_NAME ?? 'Администратор',
      login: ADMIN_LOGIN,
      password: ADMIN_PASSWORD,
      role: 'admin',
    },
  })

  console.log('Seed done')
}

main().finally(() => prisma.$disconnect())
