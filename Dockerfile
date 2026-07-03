FROM node:22-alpine AS backend-build
WORKDIR /app
COPY package.json package-lock.json* ./
RUN npm install
COPY . .
RUN npm run build

FROM node:22-alpine AS web-build
WORKDIR /app/web
# Valores publicos por design (chave anon do Supabase, protegida por RLS no lado do banco,
# nao por sigilo - e feita para ser embutida em bundles de frontend). Bakeados como default
# para o build funcionar direto no EasyPanel sem precisar configurar build args na UI;
# ainda podem ser sobrescritos com --build-arg se o projeto Supabase mudar.
ARG VITE_SUPABASE_URL=https://zfxzenmvbriqbddmwluc.supabase.co
ARG VITE_SUPABASE_ANON_KEY=eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6InpmeHplbm12YnJpcWJkZG13bHVjIiwicm9sZSI6ImFub24iLCJpYXQiOjE3ODI4NzgyNTcsImV4cCI6MjA5ODQ1NDI1N30.F7RzHsyaLWe9sRCC8Q9YNbZSi-RKVUKMNsGMw2EObsQ
ENV VITE_SUPABASE_URL=$VITE_SUPABASE_URL
ENV VITE_SUPABASE_ANON_KEY=$VITE_SUPABASE_ANON_KEY
COPY web/package.json web/package-lock.json* ./
RUN npm install
COPY web/ .
RUN npm run build

FROM node:22-alpine
WORKDIR /app
ENV NODE_ENV=production
COPY package.json package-lock.json* ./
RUN npm install --omit=dev
COPY --from=backend-build /app/dist ./dist
COPY --from=backend-build /app/workflows ./workflows
COPY --from=web-build /app/web/dist ./web-dist

EXPOSE 5000
CMD ["node", "dist/server.js"]
