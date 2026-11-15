# DriveTrade

A ready made website for car dealers: a public showroom with car pages, filters, share links, reviews and WhatsApp enquiries, plus a dealer dashboard to manage stock, photos and branding. React (Vite) + Django REST Framework.

# DriveTrade

A ready-to-use website for car dealers. Each dealer gets their own online showroom for buyers to browse, plus a dashboard to manage their stock, branding and reviews without touching code.

**Stack:** React (Vite) + react-router-dom on the frontend, Django 6.1 + Django REST Framework on the backend, token-based login.

## Features

### Public site (for buyers)

- Browse a dealer's cars with filters and see similar cars
- A page and shareable link for every car, with a preview card in chat apps
- Photo galleries with exterior and interior shots, plus the VIN
- Recently sold cars and customer reviews
- Dealer branding: logo, banners, brand strip, tagline
- Map and contact details
- WhatsApp buttons to start a conversation or enquiry

### Dealer dashboard

- Add, edit and delete cars, with a main photo, extra photos and a VIN
- Manage reviews, logo and banners
- Flyer maker for sharing cars
- Password change

## Project structure

```
.
├── src/
│   ├── App.jsx                  # Public site
│   ├── dashboard/Dashboard.jsx  # Dealer dashboard
│   ├── api.js                   # All calls to the backend
│   └── main.jsx                 # Entry point and routes
├── backend/
│   ├── config/                  # Django settings and URLs
│   ├── cars/                    # Cars, sellers, photos, reviews
│   └── manage.py
├── package.json
└── vite.config.js
```

## Running it locally (Windows)

You need Node.js and Python 3.12 or newer.

### 1. Backend

```powershell
cd backend
python -m venv venv
venv\Scripts\activate
pip install -r requirements.txt
python manage.py migrate
python manage.py createsuperuser
python manage.py runserver
```

The API runs at http://127.0.0.1:8000. Sign in to `/admin/` with the superuser to create the first seller record, then log in to the dashboard with that dealer's account.

### 2. Frontend

In a second terminal, from the project root:

```powershell
npm install
npm run dev
```

The site runs at http://localhost:5173. The dealer login is at `/login`.

By default the frontend talks to `http://127.0.0.1:8000`. To point it somewhere else, set `VITE_API_URL` (see below).

## Configuration

### Frontend

| Variable       | Purpose                                                                                                                |
| -------------- | ---------------------------------------------------------------------------------------------------------------------- |
| `VITE_API_URL` | Full URL of the backend, e.g. `https://yourname.pythonanywhere.com`. Read at build time, so rebuild after changing it. |

### Backend

The production settings switch on only when `DJANGO_SECRET_KEY` is set, so local development needs no configuration.

| Variable                    | Purpose                                                                 |
| --------------------------- | ----------------------------------------------------------------------- |
| `DJANGO_SECRET_KEY`         | Required in production. A long random string.                           |
| `DJANGO_ALLOWED_HOSTS`      | Comma-separated hostnames of the backend.                               |
| `CORS_ALLOWED_ORIGINS`      | Comma-separated frontend URLs allowed to call the API.                  |
| `CSRF_TRUSTED_ORIGINS`      | Comma-separated trusted origins, including the backend's own URL.       |
| `FRONTEND_URL`              | Public URL of the website, used when sending people to a car page.      |
| `DJANGO_SSL_REDIRECT`       | Set to `0` to turn off the HTTPS redirect if it causes a redirect loop. |
| `DATABASE_URL`              | Optional. Use PostgreSQL instead of SQLite.                             |
| `SQLITE_PATH`, `MEDIA_ROOT` | Optional. Move the database file or uploaded photos.                    |

Generate a secret key with:

```powershell
python -c "from django.core.management.utils import get_random_secret_key; print(get_random_secret_key())"
```

## Deployment

The free demo setup:

- **Frontend:** Cloudflare Pages. Build command `npm run build`, output directory `dist`, and `VITE_API_URL` set as an environment variable.
- **Backend:** PythonAnywhere (manual configuration with a virtualenv). Environment variables go in the WSGI file, and `/static/` and `/media/` are mapped to `backend/staticfiles` and `backend/media` in the Web tab.

Run `python manage.py migrate` and `python manage.py collectstatic` on the server after each deployment that changes models or static files.

## Notes

- Uploaded photos live in `backend/media/`, which is not committed. Back it up or move it to durable storage when moving to a paid host.
- The local database (`backend/db.sqlite3`) is not committed either.
- Email is set to print to the console, so password reset by email needs a real email backend before it will send messages.

## License

Proprietary. All rights reserved.
