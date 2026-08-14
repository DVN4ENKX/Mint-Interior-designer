# этап 1: сборка
FROM node:22-alpine AS build
WORKDIR /app
COPY package*.json ./
RUN npm ci
COPY . .
# адреса бэкендов зашиваются при сборке (Vite). По умолчанию — тот же
# домен через nginx-прокси, поэтому дефолтные build-args относительные.
ARG VITE_API_URL=/
ARG VITE_RECONSTRUCTOR_URL=/
ENV VITE_API_URL=${VITE_API_URL} VITE_RECONSTRUCTOR_URL=${VITE_RECONSTRUCTOR_URL}
RUN npm run build

# этап 2: раздача статики + проксирование API и реконструктора
FROM nginx:alpine
COPY nginx.conf /etc/nginx/conf.d/default.conf
COPY --from=build /app/dist /usr/share/nginx/html
EXPOSE 80
