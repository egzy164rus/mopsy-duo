# ---- Мопсик вдвоём ---------------------------------------------------------
# Зависимостей нет: образ собирается за пару секунд.
FROM node:20-alpine

ENV NODE_ENV=production \
    PORT=3000 \
    HOST=0.0.0.0

WORKDIR /app

COPY package.json ./
COPY server ./server
COPY public ./public
COPY sql ./sql

# база MVP — в томе, чтобы данные переживали перезапуск контейнера
VOLUME ["/app/data"]
EXPOSE 3000

HEALTHCHECK --interval=30s --timeout=3s --start-period=5s \
  CMD wget -qO- http://127.0.0.1:3000/api/health || exit 1

CMD ["node", "server/index.js"]
