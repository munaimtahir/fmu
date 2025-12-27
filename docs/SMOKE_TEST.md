# Smoke Tests - SIMS Application

This document provides smoke test procedures to verify that the SIMS application is working correctly in different environments.

## Test Scenarios

1. [Local Development Tests](#local-development-tests)
2. [Coolify/Production Tests](#coolifyproduction-tests)
3. [Health Check Tests](#health-check-tests)
4. [Authentication Tests](#authentication-tests)
5. [API Tests](#api-tests)
6. [Frontend Tests](#frontend-tests)

---

## Local Development Tests

### Prerequisites
- Application running via `docker-compose -f docker-compose.local.yml up`
- `.env` file configured for local development

### Test 1: Services Are Running

```bash
# Check all services are up
docker-compose -f docker-compose.local.yml ps

# Expected: All services showing "Up" or "healthy"
# - postgres (healthy)
# - redis (healthy)
# - backend (healthy)
# - frontend (Up)
# - rqworker (healthy)
```

### Test 2: Backend Health Check

```bash
# Test backend health endpoint
curl http://localhost:8001/healthz/

# Expected Response (200 OK):
{
  "status": "ok",
  "service": "SIMS Backend",
  "components": {
    "database": "ok",
    "redis": "ok",
    "rq_queue": "ok"
  }
}
```

### Test 3: Frontend Loads

```bash
# Test frontend is serving
curl -I http://localhost:5174/

# Expected: 200 OK
```

**Browser Test:**
- Open http://localhost:5174
- Should see login page
- No console errors in browser DevTools

### Test 4: CORS Configuration

```bash
# Test CORS headers
curl -H "Origin: http://localhost:5174" \
     -H "Access-Control-Request-Method: POST" \
     -H "Access-Control-Request-Headers: Content-Type" \
     -X OPTIONS \
     http://localhost:8001/api/auth/login/ -v

# Expected: 
# - 200 OK
# - Access-Control-Allow-Origin: http://localhost:5174
# - Access-Control-Allow-Credentials: true
```

---

## Coolify/Production Tests

### Prerequisites
- Application deployed to Coolify
- DNS configured for both domains
- SSL certificates active

### Test 1: DNS Resolution

```bash
# Verify DNS is pointing to your VPS
nslookup api.yourdomain.com
nslookup app.yourdomain.com

# Expected: Both resolve to your VPS IP address
```

### Test 2: SSL/TLS Configuration

```bash
# Test backend SSL
curl -I https://api.yourdomain.com/healthz/

# Expected:
# - 200 OK
# - No SSL errors
# - Certificate valid

# Test frontend SSL
curl -I https://app.yourdomain.com/

# Expected:
# - 200 OK
# - No SSL errors
```

**Browser Test:**
- Open https://app.yourdomain.com
- Check SSL certificate (click padlock icon)
- Should be valid Let's Encrypt certificate

### Test 3: Backend Health Check (Production)

```bash
# Test backend health
curl https://api.yourdomain.com/healthz/

# Expected Response (200 OK):
{
  "status": "ok",
  "service": "SIMS Backend",
  "components": {
    "database": "ok",
    "redis": "ok",
    "rq_queue": "ok"
  }
}
```

### Test 4: Proxy Headers

```bash
# Verify proxy headers are working
curl https://api.yourdomain.com/admin/ -I

# Expected:
# - Should NOT redirect to HTTP (no redirect loop)
# - Should load admin login page
```

### Test 5: CORS Configuration (Production)

```bash
# Test CORS from frontend domain
curl -H "Origin: https://app.yourdomain.com" \
     -H "Access-Control-Request-Method: POST" \
     -H "Access-Control-Request-Headers: Content-Type" \
     -X OPTIONS \
     https://api.yourdomain.com/api/auth/login/ -v

# Expected:
# - 200 OK
# - Access-Control-Allow-Origin: https://app.yourdomain.com
# - Access-Control-Allow-Credentials: true
```

---

## Health Check Tests

### Backend Health Endpoint

```bash
# Local
curl http://localhost:8001/healthz/

# Production
curl https://api.yourdomain.com/healthz/

# Expected (both):
{
  "status": "ok",
  "service": "SIMS Backend",
  "components": {
    "database": "ok",
    "redis": "ok",
    "rq_queue": "ok"
  }
}
```

### Database Connectivity

```bash
# From within backend container
docker-compose -f docker-compose.local.yml exec backend python manage.py dbshell

# Or run query
docker-compose -f docker-compose.local.yml exec backend python -c "from django.db import connection; cursor = connection.cursor(); cursor.execute('SELECT 1'); print('Database OK')"

# Expected: "Database OK"
```

### Redis Connectivity

```bash
# From within backend container
docker-compose -f docker-compose.local.yml exec backend python -c "import django_rq; queue = django_rq.get_queue('default'); queue.connection.ping(); print('Redis OK')"

# Expected: "Redis OK"
```

---

## Authentication Tests

### Test 1: Login API

```bash
# Create a test user first (via Django admin or shell)
docker-compose -f docker-compose.local.yml exec backend python manage.py createsuperuser

# Test login endpoint
curl -X POST http://localhost:8001/api/auth/login/ \
  -H "Content-Type: application/json" \
  -d '{
    "email": "admin@example.com",
    "password": "your-password"
  }'

# Expected Response (200 OK):
{
  "access": "eyJ0eXAiOiJKV1QiLCJhbGc...",
  "refresh": "eyJ0eXAiOiJKV1QiLCJhbGc...",
  "user": {
    "id": 1,
    "email": "admin@example.com",
    ...
  }
}
```

### Test 2: Protected Endpoint

```bash
# Use access token from login
export TOKEN="your-access-token"

curl http://localhost:8001/api/auth/me/ \
  -H "Authorization: Bearer $TOKEN"

# Expected Response (200 OK):
{
  "id": 1,
  "email": "admin@example.com",
  ...
}
```

### Test 3: Browser Login Flow

1. Open http://localhost:5174 (or https://app.yourdomain.com)
2. Enter credentials
3. Click "Login"
4. Should redirect to dashboard
5. Check browser DevTools:
   - No CORS errors
   - No 400/403 errors
   - Token stored in localStorage

---

## API Tests

### Test 1: API Documentation

```bash
# Local
open http://localhost:8001/api/docs/

# Production
open https://api.yourdomain.com/api/docs/

# Expected: Swagger UI with API documentation
```

### Test 2: List Endpoints

```bash
# Test a list endpoint (example: students)
curl http://localhost:8001/api/students/ \
  -H "Authorization: Bearer $TOKEN"

# Expected: 200 OK with JSON response
```

### Test 3: CSRF Token (for session auth)

```bash
# Get CSRF token
curl -c cookies.txt http://localhost:8001/admin/login/

# Use in POST request
curl -b cookies.txt \
  -H "X-CSRFToken: your-csrf-token" \
  -X POST http://localhost:8001/api/some-endpoint/

# Expected: No CSRF errors
```

---

## Frontend Tests

### Test 1: Frontend Loads

**Browser Test:**
1. Open http://localhost:5174 (local) or https://app.yourdomain.com (prod)
2. Should see login page
3. Check browser console (F12) - no errors

### Test 2: Frontend Can Reach Backend

**Browser Test:**
1. Open browser DevTools → Network tab
2. Try to login
3. Check request to `/api/auth/login/`
4. Should see:
   - Request to correct domain (localhost:8001 or api.yourdomain.com)
   - 200 OK response
   - No CORS errors

### Test 3: Static Assets Loading

**Browser Test:**
1. Check Network tab
2. All JS, CSS, images should load
3. No 404 errors
4. HTTPS in production (no mixed content warnings)

### Test 4: Routing Works

**Browser Test:**
1. Login to application
2. Navigate to different pages
3. Refresh page (should still load, not 404)
4. Back button works

---

## Checklist for Production Deployment

Before marking deployment as complete, verify all tests pass:

### Backend Checks
- [ ] Health endpoint returns 200 OK
- [ ] Database connection working
- [ ] Redis connection working
- [ ] No redirect loops on admin page
- [ ] SSL certificate valid
- [ ] CORS headers correct
- [ ] CSRF protection working
- [ ] API documentation accessible

### Frontend Checks
- [ ] Homepage loads over HTTPS
- [ ] No mixed content warnings
- [ ] No console errors
- [ ] Login flow works
- [ ] API calls successful
- [ ] Routing works
- [ ] Static assets load

### Security Checks
- [ ] `DEBUG=False` in production
- [ ] Strong `DJANGO_SECRET_KEY` set
- [ ] `ALLOWED_HOSTS` configured correctly
- [ ] SSL/TLS certificates active
- [ ] No default passwords in use
- [ ] Database password is strong

### Infrastructure Checks
- [ ] DNS resolves correctly
- [ ] Both domains point to VPS
- [ ] No containers publishing ports 80/443
- [ ] Services auto-restart on failure
- [ ] Logs are accessible in Coolify
- [ ] Health checks configured in Coolify

---

## Troubleshooting Common Issues

### Issue: CORS Error in Browser

**Symptoms:**
```
Access to XMLHttpRequest at 'https://api.yourdomain.com' from origin 'https://app.yourdomain.com' has been blocked by CORS policy
```

**Solution:**
1. Check `CORS_ALLOWED_ORIGINS` includes frontend domain
2. Must use `https://` prefix in production
3. Restart backend after changing env vars

### Issue: CSRF Verification Failed

**Symptoms:**
```
CSRF verification failed. Request aborted.
```

**Solution:**
1. Check `CSRF_TRUSTED_ORIGINS` includes both domains
2. Must use `https://` prefix in production
3. Clear browser cookies and try again

### Issue: Backend Returns 400 Bad Request

**Symptoms:**
```
Bad Request (400)
```

**Solution:**
1. Check `DJANGO_ALLOWED_HOSTS` includes your domain
2. Add `api.yourdomain.com` to the list
3. Restart backend

### Issue: Redirect Loop on Admin

**Symptoms:**
Admin page keeps redirecting infinitely

**Solution:**
1. Check `SECURE_SSL_REDIRECT=False`
2. Check `USE_X_FORWARDED_HOST=True`
3. Check `SECURE_PROXY_SSL_HEADER=True`
4. Restart backend

### Issue: Frontend Shows Blank Page

**Symptoms:**
White screen, no errors in console

**Solution:**
1. Check `VITE_API_URL` is correct
2. Rebuild frontend with correct env vars
3. Clear browser cache

---

## Automated Test Script

Save this as `smoke-test.sh` for quick testing:

```bash
#!/bin/bash

# Configuration
BACKEND_URL=${1:-http://localhost:8001}
FRONTEND_URL=${2:-http://localhost:5174}

echo "🧪 Running smoke tests..."
echo "Backend: $BACKEND_URL"
echo "Frontend: $FRONTEND_URL"
echo ""

# Test 1: Backend Health
echo "✓ Testing backend health..."
response=$(curl -s -o /dev/null -w "%{http_code}" $BACKEND_URL/healthz/)
if [ $response -eq 200 ]; then
  echo "  ✅ Backend health check passed"
else
  echo "  ❌ Backend health check failed (HTTP $response)"
fi

# Test 2: Frontend
echo "✓ Testing frontend..."
response=$(curl -s -o /dev/null -w "%{http_code}" $FRONTEND_URL/)
if [ $response -eq 200 ]; then
  echo "  ✅ Frontend loads"
else
  echo "  ❌ Frontend failed (HTTP $response)"
fi

# Test 3: API Docs
echo "✓ Testing API documentation..."
response=$(curl -s -o /dev/null -w "%{http_code}" $BACKEND_URL/api/docs/)
if [ $response -eq 200 ]; then
  echo "  ✅ API docs accessible"
else
  echo "  ❌ API docs failed (HTTP $response)"
fi

echo ""
echo "Smoke tests complete!"
```

**Usage:**
```bash
# Local testing
./smoke-test.sh

# Production testing
./smoke-test.sh https://api.yourdomain.com https://app.yourdomain.com
```

---

## Next Steps

After all smoke tests pass:
1. Monitor logs for errors
2. Set up monitoring/alerting
3. Configure automated backups
4. Document any custom configuration
5. Train users on the system
