FROM node:lts-alpine

WORKDIR /usr/src/app

COPY package.json package-lock.json ./

COPY . .

RUN npm ci

CMD ["sh", "-c", "npm run db:deploy && npm run dev"]