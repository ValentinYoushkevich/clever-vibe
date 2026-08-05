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
# Миграции НЕ здесь: prisma migrate deploy выполняется отдельным шагом (план 09, Task 2)
CMD ["node", "dist/index.js"]
