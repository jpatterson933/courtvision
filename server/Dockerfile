FROM python:3.12-slim

WORKDIR /app

# Install uv for fast package management
COPY --from=ghcr.io/astral-sh/uv:latest /uv /usr/local/bin/uv

# Copy dependency file and install
COPY server/pyproject.toml server/pyproject.toml
RUN uv pip install --system -e "./server[dev]"

# Copy full project (server needs to be importable as a package)
COPY server/ server/

EXPOSE 8000

CMD ["uvicorn", "server.main:app", "--host", "0.0.0.0", "--port", "8000", "--reload"]
