FROM python:3.13.17-slim-trixie
RUN apt-get update && apt-get install -y --no-install-recommends ca-certificates && rm -rf /var/lib/apt/lists/* \
 && dpkg --compare-versions "$(dpkg-query -W -f='${Version}' ca-certificates)" ge 20250419+deb13u1  # eMudhra CA fix, fail build if unpatched
WORKDIR /app
RUN pip install --no-cache-dir uv
COPY pyproject.toml uv.lock ./
RUN uv sync --frozen --no-dev
COPY server ./server
EXPOSE 8000
CMD [".venv/bin/uvicorn", "server.main:app", "--host", "0.0.0.0", "--port", "8000"]
