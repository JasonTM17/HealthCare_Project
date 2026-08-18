# Deployment

## Local Development

```bash
cp .env.example .env
# Set AI_SERVICE_TOKEN and strong local-only values in .env before starting.
docker compose -f infrastructure/docker-compose.yml up --build
```

Services:
- Frontend: http://localhost:3000
- Backend: http://localhost:8080
- AI Service: http://localhost:8000
- MinIO Console: http://localhost:9001

## Production Checklist

1. Set strong secrets in `.env` (`JWT_SECRET`, database passwords, MinIO keys)
2. Configure CORS allowed origins
3. Enable HTTPS/TLS termination
4. Set up database backups
5. Configure monitoring and alerting

The Compose stack is a local development boundary. It is not evidence of
multi-instance CMS fan-out, provider availability, backup/restore, or a
production deployment.
