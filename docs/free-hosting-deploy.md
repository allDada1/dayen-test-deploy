# Dayen free temporary hosting

This copy is prepared for:

- Frontend: Netlify Free
- Backend: Render Free Web Service
- PostgreSQL: Supabase Free

Do not commit real secrets. Put production values only in the hosting dashboards.

## Netlify frontend

Connect the repository root and keep `netlify.toml` enabled.

- Base directory: `apps/web`
- Build command: `npm run build`
- Publish directory: `apps/web/dist`

Environment variables:

```env
VITE_API_BASE_URL=https://your-dayen-api.koyeb.app
```

After the Render service is created, replace the placeholder with the real Render URL.

## Render backend

Create a Web Service from the same repository.

- Root directory: `apps/api`
- Build command: `npm install && npm run build`
- Run command: `npm start`
- Port: use the platform-provided `PORT` variable

Environment variables:

```env
DATABASE_URL=postgresql://...
APP_BASE_URL=https://your-dayen-site.netlify.app
CORS_ORIGINS=https://your-dayen-site.netlify.app
COOKIE_SECURE=1
COOKIE_SAMESITE=none
ALLOW_LOCALHOST_ORIGINS=0
RUN_MIGRATIONS_ON_START=1
OWNER_EMAIL=owner@example.com
UPLOAD_DIR=/tmp/dayen-uploads

RESEND_API_KEY=
RESEND_FROM_EMAIL=Dayen <noreply@dayen.store>
GOOGLE_CLIENT_ID=
OPENAI_API_KEY=
OPENAI_MODEL=gpt-4o-mini
```

Use `RESEND_*` only if email verification/password reset must send real email.
Use `GOOGLE_CLIENT_ID` only if Google login is needed.
Use `OPENAI_API_KEY` only if the AI assistant is needed.

## Database

Create PostgreSQL in Supabase Free and copy its connection string into `DATABASE_URL`.
With `RUN_MIGRATIONS_ON_START=1`, the API runs migrations during startup.

## Uploads

The current API stores uploaded files on local disk under `UPLOAD_DIR`.
Free containers can lose local files on restart/redeploy, so uploaded product images, avatars, banners, and support screenshots are temporary unless storage is moved to persistent object storage.
