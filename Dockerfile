FROM node:lts-alpine

WORKDIR /usr/src/app

COPY package.json package-lock.json ./

COPY . .

RUN npm ci
RUN npm run prisma:generate
RUN npm run build
CMD ["sh", "-c", "npm run db:deploy && npm run start"]