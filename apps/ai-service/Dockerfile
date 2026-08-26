# Pin the Python runtime manifest for reproducible beta images.
FROM python:3.12-slim@sha256:7a8b475003c4fe15a2cd4e55e5cfc2f3560bdc9333d624f24cdd6d4340fd7a17
WORKDIR /app
ARG VCS_REF=unknown
LABEL org.opencontainers.image.revision=${VCS_REF} \
      org.opencontainers.image.source="https://github.com/JasonTM17/HealthCare_Project"
ENV PYTHONDONTWRITEBYTECODE=1 \
    PYTHONUNBUFFERED=1
RUN addgroup --system app \
    && adduser --system --ingroup app --home /nonexistent --no-create-home app
COPY --chown=app:app requirements.txt ./
RUN pip install --no-cache-dir -r requirements.txt
COPY --chown=app:app app ./app
USER app:app
EXPOSE 8000
HEALTHCHECK --interval=30s --timeout=5s --start-period=15s --retries=3 \
  CMD python -c "import urllib.request; urllib.request.urlopen('http://127.0.0.1:8000/livez', timeout=3)"
CMD ["uvicorn", "app.main:app", "--host", "0.0.0.0", "--port", "8000", "--no-access-log"]
