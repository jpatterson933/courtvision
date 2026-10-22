FROM python:3.12.15-slim-trixie
RUN apt-get update && apt-get install -y --no-install-recommends ca-certificates && rm -rf /var/lib/apt/lists/* \
 && dpkg --compare-versions "$(dpkg-query -W -f='${Version}' ca-certificates)" ge 20250419+deb13u1  # eMudhra CA fix, fail build if unpatched

WORKDIR /app

# Install uv for fast package management
RUN pip install uv

# Copy dependency file and install
COPY server/pyproject.toml server/pyproject.toml
RUN uv pip install --system -e "./server[dev]"

# Copy full project (server needs to be importable as a package)
COPY server/ server/

EXPOSE 8000

CMD ["uvicorn", "server.main:app", "--host", "0.0.0.0", "--port", "8000", "--reload"]