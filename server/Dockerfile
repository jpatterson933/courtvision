FROM python:3.12-slim

WORKDIR /app

# Install uv for fast package management
COPY --from=ghcr.io/astral-sh/uv:latest /uv /usr/local/bin/uv

# Copy dependency file and install
COPY pyproject.toml .
RUN uv pip install --system -e ".[dev]"

# Copy source
COPY . ./server/

EXPOSE 8000

CMD ["uvicorn", "server.main:app", "--host", "0.0.0.0", "--port", "8000", "--reload"]
