FROM python:3.12-alpine3.22

ENV PYTHONDONTWRITEBYTECODE=1 \
    PYTHONUNBUFFERED=1

RUN addgroup -S scanner && adduser -S -G scanner -u 10001 scanner

WORKDIR /app
COPY --chown=scanner:scanner scanner.py /app/scanner.py

USER scanner
EXPOSE 8080

CMD ["python", "/app/scanner.py"]
