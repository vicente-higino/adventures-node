FROM node:lts-alpine

WORKDIR /usr/src/app

COPY package.json package-lock.json ./
RUN npm ci

COPY . .

RUN npm run prisma:generate
RUN npm run build
CMD ["sh", "-c", "npm run db:deploy && npm run clickhouse:migrate && npm run start"]