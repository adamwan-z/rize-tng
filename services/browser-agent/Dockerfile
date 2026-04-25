FROM mcr.microsoft.com/playwright/python:v1.48.0-jammy

WORKDIR /app

RUN pip install --no-cache-dir uv

COPY services/browser-agent/pyproject.toml services/browser-agent/uv.lock* ./
RUN uv sync --frozen --no-dev || uv sync --no-dev

COPY services/browser-agent/src ./src
COPY services/browser-agent/recordings ./recordings

ENV HEADLESS=1
ENV PORT=5001

EXPOSE 5001

CMD ["uv", "run", "python", "-m", "src.server"]
