import { buildApp } from './app.js'

const app = buildApp({ prisma: null as never }) // план 01 передаст настоящий PrismaClient

const port = Number(process.env.PORT ?? 3000)
app.listen({ port, host: '0.0.0.0' }).catch((err) => {
  app.log.error(err)
  process.exit(1)
})
