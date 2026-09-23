FROM node:24-bookworm-slim AS build
WORKDIR /app
COPY package.json package-lock.json ./
RUN npm ci
COPY . .
RUN npm run build && npm prune --omit=dev

FROM node:24-bookworm-slim AS runtime
ENV NODE_ENV=production
WORKDIR /app
RUN groupadd --system eduai && useradd --system --gid eduai --create-home eduai
COPY --from=build --chown=eduai:eduai /app/package.json /app/package-lock.json ./
COPY --from=build --chown=eduai:eduai /app/node_modules ./node_modules
COPY --from=build --chown=eduai:eduai /app/.next ./.next
COPY --from=build --chown=eduai:eduai /app/public ./public
RUN mkdir -p /data && chown eduai:eduai /data
USER eduai
EXPOSE 3000
CMD ["npm", "start", "--", "-H", "0.0.0.0", "-p", "3000"]
