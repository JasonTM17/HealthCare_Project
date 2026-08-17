# Deployment

## Local Development

```bash
cp .env.example .env
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
