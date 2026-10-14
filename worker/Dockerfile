FROM node:22-slim
RUN apt-get update && apt-get install -y --no-install-recommends ffmpeg ca-certificates fonts-dejavu-core
WORKDIR /app
COPY package.json ./
RUN npm install --omit=dev
COPY src ./src
CMD ["npx", "tsx", "src/main.ts"]
