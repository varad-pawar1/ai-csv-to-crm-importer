FROM node:20-alpine

WORKDIR /app

COPY package*.json ./
COPY backend/package*.json ./backend/

RUN npm install

COPY . .

RUN npm run build --workspace=backend

WORKDIR /app/backend

EXPOSE 4000

CMD ["npm", "start"]