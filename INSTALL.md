# Laravel Login System - Installation & Setup Guide

## Prerequisites

Before starting, ensure you have the following installed:
- **PHP** 8.1+ (`php -v`)
- **Composer** (PHP package manager) (`composer -v`)
- **Node.js** 18+ & npm (`node -v` && `npm -v`)
- **MySQL** 8.0+ or **SQLite** (for local development)
- **Git** (`git -v`)

---

## Step 1: Install PHP Dependencies

From the project root directory, install Laravel and all PHP dependencies:

```bash
composer install
```

This reads `composer.json` and installs all required packages into the `vendor/` directory.

---

## Step 2: Environment Configuration

### Create `.env` file

Copy the example environment file:

```bash
cp .env.example .env
```

### Generate Application Key

Laravel requires a unique encryption key:

```bash
php artisan key:generate
```

This adds `APP_KEY=base64:...` to your `.env` file.

### Configure Database

Edit `.env` and set your database connection. For **local development with SQLite**:

```env
DB_CONNECTION=sqlite
DB_DATABASE=/absolute/path/to/database.sqlite
```

Or for **MySQL**:

```env
DB_CONNECTION=mysql
DB_HOST=127.0.0.1
DB_PORT=3306
DB_DATABASE=laravel_login
DB_USERNAME=root
DB_PASSWORD=your_password
```

If using MySQL, create the database first:

```bash
mysql -u root -p
> CREATE DATABASE laravel_login;
> EXIT;
```

---

## Step 3: Create Database File (SQLite Only)

If using SQLite, create an empty database file:

```bash
touch database/database.sqlite
```

---

## Step 4: Run Database Migrations

Create all necessary tables:

```bash
php artisan migrate
```

This runs all migration files in `database/migrations/` and creates the schema.

---

## Step 5: Install Frontend Dependencies

Install JavaScript/React dependencies:

```bash
npm install
```

---

## Step 6: Create First User

You can create the first user via tinker (interactive shell):

```bash
php artisan tinker
```

Then run:

```php
App\Models\User::create([
    'name' => 'Admin User',
    'email' => 'admin@example.com',
    'password' => bcrypt('password'),
]);
```

Exit tinker with `exit`.

**Alternative:** Use a seeder (if available in `database/seeders/`):

```bash
php artisan db:seed
```

---

## Step 7: Start Development Server

### Backend (Laravel)

In one terminal window:

```bash
php artisan serve
```

This starts the Laravel development server on `http://localhost:8000`

### Frontend (React)

In another terminal window:

```bash
npm run dev
```

This starts the Vite development server (typically on `http://localhost:5173`)

---

## Step 8: Verify Installation

1. **Check backend:** Visit `http://localhost:8000`
2. **Check frontend:** Visit `http://localhost:5173`
3. **Try login:** Use the credentials from Step 6

---

## Common Issues & Troubleshooting

### `composer install` fails
- **Solution:** Update Composer: `composer self-update`
- **Solution:** Clear cache: `composer clear-cache && composer install`

### Database migration fails
- **Solution:** Ensure database exists and credentials are correct in `.env`
- **Solution:** Check file permissions on `database/` directory: `chmod -R 775 database/`

### Permission denied on `storage/` or `bootstrap/cache/`
```bash
chmod -R 775 storage bootstrap/cache
```

### Frontend not connecting to backend
- **Solution:** Check `http://localhost:8000` is running
- **Solution:** Verify API URLs in React code match backend URLs

### "Class not found" errors
```bash
composer dump-autoload
php artisan cache:clear
```

---

## Optional: Useful Commands

```bash
# Clear all caches
php artisan cache:clear
php artisan config:clear
php artisan view:clear

# Rollback migrations (destructive)
php artisan migrate:reset

# View all routes
php artisan route:list

# Run tests
php artisan test

# Build frontend for production
npm run build
```

---

## Development Workflow

1. Backend runs on `http://localhost:8000`
2. Frontend runs on `http://localhost:5173`
3. Frontend proxies API calls to backend (configured in Vite)
4. Edit PHP files → auto-reloaded by Laravel
5. Edit React/TypeScript files → auto-reloaded by Vite

---

## Next Steps

- Read `CLAUDE.md` for collaboration guidelines
- Check `README.md` for project overview
- Review `database/migrations/` to understand schema
- Explore `app/Http/Controllers/` for backend logic
- Check `resources/` for frontend components

