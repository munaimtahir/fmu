# Local Development Guide

This guide explains how to run the SIMS application locally for development.

## Prerequisites

- Docker and Docker Compose installed
- Git
- At least 4GB RAM available
- Ports 5174, 8001 available (or configure different ports)

## Quick Start

1. **Clone the repository:**
   ```bash
   git clone https://github.com/munaimtahir/fmu.git
   cd fmu
   ```

2. **Create environment file:**
   ```bash
   cp .env.example .env
   ```

3. **Start all services:**
   ```bash
   docker-compose -f docker-compose.local.yml up
   ```

4. **Access the application:**
   - **Frontend:** http://localhost:5174
   - **Backend API:** http://localhost:8001
   - **Django Admin:** http://localhost:8001/admin/
   - **API Docs:** http://localhost:8001/api/docs/

## Architecture

The local development setup uses docker-compose with the following services:

```
┌─────────────────────────────────────────┐
│  Your Machine (localhost)               │
├─────────────────────────────────────────┤
│                                         │
│  Frontend (React/Vite)                  │
│  Port: 5174 → Container 5173            │
│  Hot Module Replacement (HMR) enabled   │
│                                         │
│  Backend (Django)                       │
│  Port: 8001 → Container 8000            │
│  Auto-reload on code changes            │
│                                         │
│  PostgreSQL                             │
│  Port: 5432 (optional, for DB tools)    │
│                                         │
│  Redis                                  │
│  Port: 6379 (optional, for tools)       │
│                                         │
│  RQ Worker (Background Jobs)            │
│  No external port                       │
│                                         │
└─────────────────────────────────────────┘
```

## Environment Configuration

The `.env` file controls all configuration. Key settings for local development:

```bash
# Django - Development settings
DJANGO_DEBUG=True
DJANGO_SECRET_KEY=dev-secret-key-not-for-production
DJANGO_ALLOWED_HOSTS=localhost,127.0.0.1

# Database - Uses docker-compose service names
DB_HOST=postgres
DB_NAME=sims_db
DB_USER=sims_user
DB_PASSWORD=sims_password

# Redis
REDIS_HOST=redis

# Frontend
VITE_API_URL=http://localhost:8001

# CORS/CSRF - Local development URLs
CORS_ALLOWED_ORIGINS=http://localhost:5174,http://localhost:8001,http://127.0.0.1:5174
CSRF_TRUSTED_ORIGINS=http://localhost:5174,http://localhost:8001,http://127.0.0.1:5174

# Proxy Settings - FALSE for local development
USE_X_FORWARDED_HOST=False
SECURE_PROXY_SSL_HEADER=False
SECURE_SSL_REDIRECT=False
```

## Common Commands

### Starting Services

```bash
# Start all services in foreground
docker-compose -f docker-compose.local.yml up

# Start in background (detached)
docker-compose -f docker-compose.local.yml up -d

# Start only specific services
docker-compose -f docker-compose.local.yml up postgres redis backend

# Rebuild containers (after dependency changes)
docker-compose -f docker-compose.local.yml up --build
```

### Stopping Services

```bash
# Stop all services
docker-compose -f docker-compose.local.yml down

# Stop and remove volumes (DELETES DATABASE DATA)
docker-compose -f docker-compose.local.yml down -v
```

### Viewing Logs

```bash
# All services
docker-compose -f docker-compose.local.yml logs -f

# Specific service
docker-compose -f docker-compose.local.yml logs -f backend
docker-compose -f docker-compose.local.yml logs -f frontend
```

### Running Django Commands

```bash
# Create superuser
docker-compose -f docker-compose.local.yml exec backend python manage.py createsuperuser

# Run migrations
docker-compose -f docker-compose.local.yml exec backend python manage.py migrate

# Collect static files
docker-compose -f docker-compose.local.yml exec backend python manage.py collectstatic

# Django shell
docker-compose -f docker-compose.local.yml exec backend python manage.py shell

# Run tests
docker-compose -f docker-compose.local.yml exec backend python manage.py test

# Create new migration
docker-compose -f docker-compose.local.yml exec backend python manage.py makemigrations
```

### Database Operations

```bash
# Access PostgreSQL shell
docker-compose -f docker-compose.local.yml exec postgres psql -U sims_user -d sims_db

# Backup database
docker-compose -f docker-compose.local.yml exec postgres pg_dump -U sims_user sims_db > backup.sql

# Restore database
docker-compose -f docker-compose.local.yml exec -T postgres psql -U sims_user -d sims_db < backup.sql

# Reset database (DELETES ALL DATA)
docker-compose -f docker-compose.local.yml down -v
docker-compose -f docker-compose.local.yml up -d postgres
docker-compose -f docker-compose.local.yml exec backend python manage.py migrate
```

### Redis Operations

```bash
# Access Redis CLI
docker-compose -f docker-compose.local.yml exec redis redis-cli

# Monitor Redis commands
docker-compose -f docker-compose.local.yml exec redis redis-cli monitor

# Clear all Redis data
docker-compose -f docker-compose.local.yml exec redis redis-cli FLUSHALL
```

## Development Workflow

### Making Backend Changes

1. Edit Python files in `backend/`
2. Backend auto-reloads (gunicorn with `--reload` flag)
3. View changes at http://localhost:8001

**If models changed:**
```bash
docker-compose -f docker-compose.local.yml exec backend python manage.py makemigrations
docker-compose -f docker-compose.local.yml exec backend python manage.py migrate
```

**If dependencies changed:**
```bash
docker-compose -f docker-compose.local.yml up --build backend
```

### Making Frontend Changes

1. Edit files in `frontend/src/`
2. Vite auto-reloads (HMR)
3. View changes at http://localhost:5174

**If dependencies changed:**
```bash
docker-compose -f docker-compose.local.yml up --build frontend
```

### Testing Background Jobs

The RQ worker processes background jobs automatically. To test:

1. **Enqueue a job from Django shell:**
   ```python
   import django_rq
   queue = django_rq.get_queue('default')
   queue.enqueue('myapp.tasks.my_task', arg1, arg2)
   ```

2. **Monitor worker logs:**
   ```bash
   docker-compose -f docker-compose.local.yml logs -f rqworker
   ```

## Troubleshooting

### Port Already in Use

If you get "port already allocated" error:

```bash
# Check what's using the port
lsof -i :5174
lsof -i :8001

# Kill the process or change ports in docker-compose.local.yml
```

### Database Connection Refused

```bash
# Wait for database to be ready
docker-compose -f docker-compose.local.yml logs postgres

# Ensure postgres service is healthy
docker-compose -f docker-compose.local.yml ps
```

### Frontend Can't Reach Backend

Check `VITE_API_URL` in `.env`:
```bash
VITE_API_URL=http://localhost:8001
```

Rebuild frontend if changed:
```bash
docker-compose -f docker-compose.local.yml up --build frontend
```

### Permission Denied on Linux

Add your user to docker group:
```bash
sudo usermod -aG docker $USER
newgrp docker
```

### Containers Keep Restarting

Check logs for errors:
```bash
docker-compose -f docker-compose.local.yml logs backend
```

Common issues:
- Database not ready (wait for health check)
- Missing environment variables
- Port conflicts

### Static Files Not Loading

Collect static files:
```bash
docker-compose -f docker-compose.local.yml exec backend python manage.py collectstatic --noinput
```

### Volume Permission Issues

On Linux, volumes might have permission issues:
```bash
sudo chown -R $USER:$USER ./backend
```

## IDE Setup

### VS Code

1. **Install extensions:**
   - Docker
   - Python
   - ESLint
   - Prettier

2. **Python debugger:**
   Add to `.vscode/launch.json`:
   ```json
   {
     "version": "0.2.0",
     "configurations": [
       {
         "name": "Django: Remote Attach",
         "type": "python",
         "request": "attach",
         "connect": {
           "host": "localhost",
           "port": 5678
         },
         "pathMappings": [
           {
             "localRoot": "${workspaceFolder}/backend",
             "remoteRoot": "/app"
           }
         ]
       }
     ]
   }
   ```

### PyCharm

1. **Configure Docker Compose:**
   - Settings → Build, Execution, Deployment → Docker
   - Add Docker Compose configuration

2. **Configure Python Interpreter:**
   - Settings → Project → Python Interpreter
   - Add Remote Interpreter → Docker Compose
   - Select `backend` service

## Testing

### Backend Tests

```bash
# Run all tests
docker-compose -f docker-compose.local.yml exec backend python manage.py test

# Run specific app tests
docker-compose -f docker-compose.local.yml exec backend python manage.py test sims_backend.admissions

# Run with coverage
docker-compose -f docker-compose.local.yml exec backend coverage run --source='.' manage.py test
docker-compose -f docker-compose.local.yml exec backend coverage report
```

### Frontend Tests

```bash
# Run tests
docker-compose -f docker-compose.local.yml exec frontend npm test

# Run with coverage
docker-compose -f docker-compose.local.yml exec frontend npm test -- --coverage
```

## Performance Tips

1. **Use volumes for code:** Already configured for hot reload
2. **Limit logs:** Use `docker-compose logs --tail=100`
3. **Prune unused resources:**
   ```bash
   docker system prune -a
   ```
4. **Adjust resource limits:** In Docker Desktop preferences

## Security Notes for Local Development

- **Never commit `.env` file** - it's in `.gitignore`
- Use development secret key (already in `.env.example`)
- `DEBUG=True` is OK for local development
- No HTTPS needed locally (use HTTP)
- Proxy settings should be `False` locally

## Switching Between Dev and Production Testing

If you want to test production-like setup locally:

1. Use `docker-compose.prod.yml` or `docker-compose.staging.yml`
2. These include nginx gateway (legacy setup)
3. Not recommended - use Coolify for production testing

## Next Steps

- Read [DEPLOY_COOLIFY_TRAEFIK.md](./DEPLOY_COOLIFY_TRAEFIK.md) for production deployment
- Read [SMOKE_TEST.md](./SMOKE_TEST.md) for verification steps
- Check [SETUP.md](./SETUP.md) for additional configuration

## Getting Help

- Check logs: `docker-compose -f docker-compose.local.yml logs`
- Check service status: `docker-compose -f docker-compose.local.yml ps`
- Restart services: `docker-compose -f docker-compose.local.yml restart`
- Rebuild from scratch: `docker-compose -f docker-compose.local.yml down -v && docker-compose -f docker-compose.local.yml up --build`
