FROM node:20-alpine

WORKDIR /app

COPY package*.json ./
RUN npm ci

COPY . .

RUN npm run build

EXPOSE 3000

CMD ["sh", "-c", "node dist/db/run-migrate.js && node dist/db/run-backfill.js && node dist/server.js"]
