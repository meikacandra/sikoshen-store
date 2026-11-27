# Stage 1: Build antarmuka React (Vite)
FROM node:22-slim AS frontend-builder
WORKDIR /app

COPY package.json package-lock.json ./
RUN npm ci

COPY index.html tsconfig.json tsconfig.app.json tsconfig.node.json vite.config.ts tailwind.config.ts postcss.config.js ./
COPY public ./public
COPY src ./src
RUN npm run build

# Stage 2: Jalankan FastAPI + model Random Forest + static dist/
FROM python:3.13-slim AS runtime
WORKDIR /app

ENV PYTHONDONTWRITEBYTECODE=1 \
    PYTHONUNBUFFERED=1 \
    PORT=8000

COPY backend/requirements.txt ./backend/requirements.txt
RUN pip install --no-cache-dir -r backend/requirements.txt

COPY backend/main.py backend/sikoshen.py backend/sikoshen_pipeline.py backend/evaluation.py ./backend/
COPY backend/models/rf_sikoshen.pkl backend/models/prediksi_bulan_depan.csv backend/models/model_meta.json ./backend/models/
COPY --from=frontend-builder /app/dist ./dist

RUN useradd -m -u 1000 user \
    && chown -R user:user /app
USER user

EXPOSE 8000

HEALTHCHECK --interval=30s --timeout=5s --start-period=15s --retries=3 \
  CMD python -c "import os, urllib.request; urllib.request.urlopen(f'http://127.0.0.1:{os.environ.get(\"PORT\", \"8000\")}/api/health', timeout=4)" || exit 1

CMD ["sh", "-c", "uvicorn main:app --app-dir backend --host 0.0.0.0 --port ${PORT:-8000}"]
