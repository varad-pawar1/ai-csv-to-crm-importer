FROM node:20-alpine

WORKDIR /app

COPY package*.json ./
COPY frontend/package*.json ./frontend/

RUN npm install

COPY . .

RUN npm run build --workspace=frontend

WORKDIR /app/frontend

EXPOSE 3000

CMD ["npm", "start"]