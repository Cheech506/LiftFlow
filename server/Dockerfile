FROM python:3.12-slim AS base

ENV PYTHONDONTWRITEBYTECODE=1 \
    PYTHONUNBUFFERED=1 \
    PIP_DISABLE_PIP_VERSION_CHECK=1 \
    PIP_NO_CACHE_DIR=1

WORKDIR /app

RUN groupadd --system liftflow \
    && useradd --system --gid liftflow --home-dir /app --shell /usr/sbin/nologin liftflow

COPY requirements.txt ./requirements.txt
RUN python -m pip install --no-cache-dir --requirement requirements.txt

COPY --chown=liftflow:liftflow alembic.ini ./alembic.ini
COPY --chown=liftflow:liftflow migrations ./migrations
COPY --chown=liftflow:liftflow app ./app

FROM base AS runtime

USER liftflow
EXPOSE 8000

CMD ["sh", "-c", "alembic upgrade head && exec uvicorn app.main:app --host 0.0.0.0 --port 8000"]

FROM base AS test

USER root
COPY requirements-dev.txt ./requirements-dev.txt
RUN python -m pip install --no-cache-dir --requirement requirements-dev.txt
COPY --chown=liftflow:liftflow tests ./tests
USER liftflow

CMD ["python", "-m", "pytest"]
