# Deploying SIMS on Coolify with Traefik

This guide walks you through deploying the Student Information Management System (SIMS) on a VPS using Coolify with Traefik as the reverse proxy and TLS terminator.

## Architecture Overview

```
Internet
   ↓
Traefik (ports 80/443) ← Managed by Coolify
   ↓
   ├─→ app.yourdomain.com → Frontend Container (port 80)
   └─→ api.yourdomain.com → Backend Container (port 8000)
```

**Key Points:**
- Traefik handles ALL HTTP/HTTPS traffic and TLS termination
- Backend and frontend are deployed as **separate Coolify resources**
- No containers publish ports 80/443 to the host
- Domain-based routing (not path-based like `/api/`)

## Prerequisites

1. **VPS with Coolify installed**
   - Coolify v4+ recommended
   - Traefik automatically installed by Coolify
   
2. **Domain names configured**
   - `api.yourdomain.com` → A record pointing to VPS IP
   - `app.yourdomain.com` → A record pointing to VPS IP
   
3. **GitHub repository access**
   - Coolify needs access to your repository

## Deployment Steps

### Step 1: Prepare Your Environment Variables

Create environment variables for both backend and frontend. You'll enter these in Coolify's UI.

#### Backend Environment Variables

```bash
# Django Core
DJANGO_SECRET_KEY=your-secure-random-key-here-min-50-chars
DJANGO_DEBUG=False
DJANGO_ALLOWED_HOSTS=api.yourdomain.com

# CRITICAL: Proxy Settings for Traefik
USE_X_FORWARDED_HOST=True
SECURE_PROXY_SSL_HEADER=True
SECURE_SSL_REDIRECT=False

# Database (use Coolify's PostgreSQL or external)
DB_ENGINE=django.db.backends.postgresql
DB_NAME=sims_db
DB_USER=sims_user
DB_PASSWORD=your-db-password
DB_HOST=postgres  # Service name if using Coolify's PostgreSQL
DB_PORT=5432

# Redis (use Coolify's Redis or external)
REDIS_HOST=redis  # Service name if using Coolify's Redis
REDIS_PORT=6379

# CORS/CSRF (MUST include HTTPS)
CORS_ALLOWED_ORIGINS=https://app.yourdomain.com
CSRF_TRUSTED_ORIGINS=https://app.yourdomain.com,https://api.yourdomain.com

# JWT Tokens
JWT_ACCESS_TOKEN_LIFETIME=60
JWT_REFRESH_TOKEN_LIFETIME=1440

# Email (optional, configure if needed)
EMAIL_BACKEND=django.core.mail.backends.smtp.EmailBackend
EMAIL_HOST=smtp.gmail.com
EMAIL_PORT=587
EMAIL_USE_TLS=True
EMAIL_HOST_USER=your-email@gmail.com
EMAIL_HOST_PASSWORD=your-app-password
DEFAULT_FROM_EMAIL=noreply@yourdomain.com
```

#### Frontend Environment Variables

```bash
# API URL - MUST be HTTPS and match backend domain
VITE_API_URL=https://api.yourdomain.com
```

### Step 2: Deploy PostgreSQL Database

1. In Coolify dashboard, go to your project
2. Click **"+ Add Resource"** → **"PostgreSQL"**
3. Configure:
   - **Name:** `sims-postgres`
   - **Database:** `sims_db`
   - **Username:** `sims_user`
   - **Password:** (generate strong password)
   - **Port:** Leave blank (internal only)
4. Click **"Deploy"**
5. **Important:** Note the internal service name (usually `sims-postgres`)

### Step 3: Deploy Redis Cache

1. Click **"+ Add Resource"** → **"Redis"**
2. Configure:
   - **Name:** `sims-redis`
   - **Port:** Leave blank (internal only)
3. Click **"Deploy"**
4. **Important:** Note the internal service name (usually `sims-redis`)

### Step 4: Deploy Backend (Django API)

1. Click **"+ Add Resource"** → **"Application"** → **"GitHub"**
2. **Basic Configuration:**
   - **Repository:** `munaimtahir/fmu`
   - **Branch:** `main` (or your branch)
   - **Build Pack:** Dockerfile
   - **Base Directory:** `backend`
   - **Dockerfile:** `Dockerfile`
   
3. **Network Configuration:**
   - **Domains:** `api.yourdomain.com`
   - **Port:** `8000`
   - **Protocol:** HTTP (Traefik handles HTTPS)
   
4. **Build Configuration:**
   - **Build Command:** (leave default, uses Dockerfile)
   - **Start Command:** 
     ```bash
     sh -c "python manage.py migrate && python manage.py collectstatic --noinput && gunicorn sims_backend.wsgi:application --bind 0.0.0.0:8000 --workers 4 --timeout 120"
     ```

5. **Environment Variables:**
   - Click **"Environment Variables"** tab
   - Add ALL backend variables from Step 1
   - **Important:** Set `DB_HOST` to match your PostgreSQL service name (e.g., `sims-postgres`) and `REDIS_HOST` to match your Redis service name (e.g., `sims-redis`). These service names work when all backend services (postgres, redis, backend, rqworker) are deployed together in the same Coolify resource or explicitly connected via a shared network.

6. **Health Check:**
   - **Path:** `/healthz/`
   - **Port:** `8000`
   - **Interval:** 30s
   - **Timeout:** 10s
   - **Retries:** 3

7. **Storage (Optional but Recommended):**
   - Add persistent volume for media files:
     - **Source:** `/app/media`
     - **Mount:** `/app/media`

8. Click **"Deploy"**

### Step 5: Deploy RQ Worker (Background Jobs)

1. Click **"+ Add Resource"** → **"Application"** → **"GitHub"**
2. **Basic Configuration:**
   - **Repository:** `munaimtahir/fmu`
   - **Branch:** `main`
   - **Build Pack:** Dockerfile
   - **Base Directory:** `backend`
   - **Dockerfile:** `Dockerfile`
   
3. **Network Configuration:**
   - **No domain needed** (internal service only)
   - **Port:** Leave blank
   
4. **Build Configuration:**
   - **Start Command:** `python manage.py rqworker default`

5. **Environment Variables:**
   - Add same database and Redis variables as backend
   - Must include: `DB_*`, `REDIS_*`, `DJANGO_SECRET_KEY`
   - **Important:** If deploying as a separate resource from the backend, ensure `DB_HOST` and `REDIS_HOST` point to accessible services, or deploy backend services (postgres, redis, backend, rqworker) together in the same resource for automatic network connectivity.

6. **Storage:**
   - Share media volume with backend:
     - **Source:** `/app/media`
     - **Mount:** `/app/media`
   - **Important:** If backend and RQ worker are separate resources, both must mount persistent volumes at the same path, or deploy them together to automatically share the volume.

7. Click **"Deploy"**

### Step 6: Deploy Frontend (React/Vite)

1. Click **"+ Add Resource"** → **"Application"** → **"GitHub"**
2. **Basic Configuration:**
   - **Repository:** `munaimtahir/fmu`
   - **Branch:** `main`
   - **Build Pack:** Dockerfile
   - **Base Directory:** `frontend`
   - **Dockerfile:** `Dockerfile.prod`
   
3. **Network Configuration:**
   - **Domains:** `app.yourdomain.com`
   - **Port:** `80`
   - **Protocol:** HTTP (Traefik handles HTTPS)
   
4. **Build Configuration:**
   - **Build Args:**
     - `VITE_API_URL=https://api.yourdomain.com`
   - Note: Build args must be set for the build to include the API URL

5. **Environment Variables:**
   - `VITE_API_URL=https://api.yourdomain.com`
   - (This may be redundant with build args, but ensures consistency)

6. Click **"Deploy"**

### Step 7: Configure SSL/TLS

Coolify automatically configures Let's Encrypt SSL certificates for your domains via Traefik.

1. Ensure DNS records are pointing to your VPS
2. Coolify will automatically obtain certificates when you deploy
3. Certificates auto-renew

**Verification:**
- Visit `https://api.yourdomain.com/healthz/` - should return JSON with status "ok"
- Visit `https://app.yourdomain.com` - should load the frontend

## Network Architecture in Coolify

### Recommended Deployment Model

For optimal resource sharing and network communication, we recommend deploying services in **two main resources**:

**Resource 1: Backend Stack** (deployed together in one resource)
```
sims-postgres (internal only)
sims-redis (internal only)
sims-backend:8000 ← Traefik → api.yourdomain.com
sims-rqworker (internal only)
```

**Resource 2: Frontend** (deployed separately)
```
sims-frontend:80 ← Traefik → app.yourdomain.com
```

### Network Communication

- **Backend Stack Services:** When deployed together (postgres, redis, backend, rqworker), they share the same Docker network automatically. Services communicate using service names (e.g., `DB_HOST=sims-postgres`, `REDIS_HOST=sims-redis`).

- **Frontend to Backend:** The frontend is a separate resource and does NOT share the backend's internal network. Communication happens through Traefik using the public API domain (`https://api.yourdomain.com`), not via Docker service names.

- **Volume Sharing:** Services in the same resource automatically share named volumes. If deploying backend and rqworker as separate resources, both must mount persistent volumes at `/app/media` for media file sharing.

### Alternative: All-in-One Resource

You can deploy all services (backend, frontend, postgres, redis, rqworker) in a single Coolify resource using the reference `docker-compose.coolify.yml` file. This approach:
- ✅ Simplifies network configuration (all services share one network)
- ✅ Automatically shares volumes
- ❌ Couples frontend and backend deployment (can't deploy independently)
- ❌ Less flexible for scaling individual services

## Environment Variable Reference

### Required Backend Variables

| Variable | Example | Description |
|----------|---------|-------------|
| `DJANGO_SECRET_KEY` | `django-insecure-xyz...` | **CRITICAL:** Generate unique key |
| `DJANGO_DEBUG` | `False` | Must be False in production |
| `DJANGO_ALLOWED_HOSTS` | `api.yourdomain.com` | Backend domain |
| `USE_X_FORWARDED_HOST` | `True` | **CRITICAL for Traefik** |
| `SECURE_PROXY_SSL_HEADER` | `True` | **CRITICAL for Traefik** |
| `SECURE_SSL_REDIRECT` | `False` | Let Traefik handle redirects |
| `DB_HOST` | `sims-postgres` | PostgreSQL service name |
| `DB_NAME` | `sims_db` | Database name |
| `DB_USER` | `sims_user` | Database user |
| `DB_PASSWORD` | `***` | Strong password |
| `REDIS_HOST` | `sims-redis` | Redis service name |
| `CORS_ALLOWED_ORIGINS` | `https://app.yourdomain.com` | Frontend domain with HTTPS |
| `CSRF_TRUSTED_ORIGINS` | `https://app.yourdomain.com,https://api.yourdomain.com` | Both domains with HTTPS |

### Required Frontend Variables

| Variable | Example | Description |
|----------|---------|-------------|
| `VITE_API_URL` | `https://api.yourdomain.com` | Backend API URL with HTTPS |

## Troubleshooting

### Backend returns 400 Bad Request
- **Cause:** `DJANGO_ALLOWED_HOSTS` doesn't include your domain
- **Fix:** Add `api.yourdomain.com` to `DJANGO_ALLOWED_HOSTS`

### CSRF verification failed
- **Cause:** `CSRF_TRUSTED_ORIGINS` missing or incorrect
- **Fix:** Add `https://app.yourdomain.com,https://api.yourdomain.com` to `CSRF_TRUSTED_ORIGINS`
- **Important:** MUST use `https://` prefix

### CORS errors in browser console
- **Cause:** `CORS_ALLOWED_ORIGINS` missing or incorrect
- **Fix:** Add `https://app.yourdomain.com` to `CORS_ALLOWED_ORIGINS`
- **Important:** MUST use `https://` prefix

### Frontend can't reach backend
- **Cause:** `VITE_API_URL` incorrect or missing
- **Fix:** Rebuild frontend with correct `VITE_API_URL=https://api.yourdomain.com`

### Redirect loops
- **Cause:** `SECURE_SSL_REDIRECT=True` while Traefik handles HTTPS
- **Fix:** Set `SECURE_SSL_REDIRECT=False`

### Database connection failed
- **Cause:** Incorrect `DB_HOST` or database not deployed
- **Fix:** Verify `DB_HOST` matches PostgreSQL service name in Coolify

### Health check failing
- **Verify:** `curl http://localhost:8000/healthz/` from backend container
- **Check:** Database and Redis connectivity
- **Logs:** Check backend logs in Coolify

## Security Checklist

- [ ] `DJANGO_SECRET_KEY` is unique and strong (50+ chars)
- [ ] `DJANGO_DEBUG=False` in production
- [ ] `DJANGO_ALLOWED_HOSTS` contains ONLY your domains (no `*`)
- [ ] `CSRF_TRUSTED_ORIGINS` uses `https://` prefix
- [ ] `CORS_ALLOWED_ORIGINS` uses `https://` prefix
- [ ] Database password is strong
- [ ] SSL certificates are active (check in browser)
- [ ] No containers publish ports 80/443
- [ ] `USE_X_FORWARDED_HOST=True` is set
- [ ] `SECURE_PROXY_SSL_HEADER=True` is set

## Updating Your Deployment

Coolify supports multiple deployment methods:

1. **Automatic (GitHub Webhooks):**
   - Enable webhooks in Coolify
   - Every push to main branch auto-deploys
   
2. **Manual:**
   - In Coolify dashboard, click "Redeploy" for the resource
   
3. **Rollback:**
   - Coolify keeps previous deployments
   - Click "Rollback" to revert

## Monitoring

- **Backend Health:** `https://api.yourdomain.com/healthz/`
- **Coolify Dashboard:** Check logs and resource usage
- **Django Admin:** `https://api.yourdomain.com/admin/`

## Cost Optimization

- **Shared Resources:** Use same PostgreSQL and Redis for multiple apps
- **Worker Scaling:** Start with 1 RQ worker, add more under load
- **Backend Workers:** Adjust gunicorn `--workers` based on CPU cores (2-4 is typical)

## Next Steps

- Configure email settings for notifications
- Set up automated backups for PostgreSQL
- Configure monitoring/alerting
- Review logs regularly
- Set up CI/CD pipeline

## Support

For issues specific to:
- **Coolify:** https://coolify.io/docs
- **This application:** Open an issue in the repository
- **Traefik:** https://doc.traefik.io/traefik/
