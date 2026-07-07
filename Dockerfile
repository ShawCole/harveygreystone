FROM node:22-slim

WORKDIR /app

COPY package.json package-lock.json ./
RUN npm ci --production

COPY server.js ./
COPY netlify/ ./netlify/
COPY public/ ./public/

EXPOSE 8080
CMD ["node", "server.js"]
