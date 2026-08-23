FROM node:20-alpine

RUN apk add --no-cache \
    ffmpeg \
    ca-certificates

WORKDIR /app

COPY package*.json ./

RUN npm install

COPY . .

RUN npm run build

ENV FFMPEG_PATH=/usr/bin/ffmpeg

EXPOSE 3001
EXPOSE 4173

CMD ["npm", "start"]
