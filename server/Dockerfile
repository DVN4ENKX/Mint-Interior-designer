FROM node:22-alpine
WORKDIR /app
# lockfile в server/ отсутствует, поэтому npm install (не ci)
COPY package.json ./
RUN npm install --omit=dev
COPY . .
ENV PORT=8787
EXPOSE 8787
CMD ["node", "index.js"]
