FROM python:3.12-slim
WORKDIR /app
ARG VCS_REF=unknown
LABEL org.opencontainers.image.revision=${VCS_REF} \
      org.opencontainers.image.source="https://github.com/JasonTM17/HealthCare_Project"
ENV PYTHONDONTWRITEBYTECODE=1
ENV PYTHONUNBUFFERED=1
COPY requirements.txt ./
RUN pip install --no-cache-dir -r requirements.txt
COPY app ./app
EXPOSE 8000
CMD ["uvicorn", "app.main:app", "--host", "0.0.0.0", "--port", "8000", "--no-access-log"]
