@echo off
REM Installation script for Windows
REM Feedback Plugin - Universidad Andrés Bello

echo ==========================================
echo Feedback Plugin - Installation Script
echo Universidad Andrés Bello - UNIDA
echo ==========================================

REM Check Docker
docker --version >nul 2>&1
if %errorlevel% neq 0 (
    echo [ERROR] Docker is not installed. Please install Docker Desktop for Windows first.
    pause
    exit /b 1
)

docker-compose --version >nul 2>&1
if %errorlevel% neq 0 (
    echo [ERROR] Docker Compose is not installed.
    pause
    exit /b 1
)

echo [OK] Docker and Docker Compose are installed

REM Create .env from template if not exists
if not exist .env (
    echo [INFO] .env file not found. Creating from template...
    copy .env.example .env
    echo [OK] .env file created.
    echo.
    echo IMPORTANT: Edit .env and set:
    echo   - JWT_SECRET (generate with: openssl rand -base64 32)
    echo   - OPENAI_API_KEY
    echo   - CANVAS_URL
    echo.
)

REM Generate LTI keys if they don't exist
if not exist lti_private.pem (
    echo [INFO] Generating LTI RSA keys...
    openssl genrsa -out lti_private.pem 2048
    openssl rsa -pubout -in lti_private.pem -out lti_public.pem
    echo [OK] LTI keys generated
)

REM Build and start
echo.
echo Building and starting services...
docker-compose build --no-cache
docker-compose up -d

REM Wait
timeout /t 5 /nobreak >nul

REM Check database
echo Checking database...
docker-compose exec -T postgres pg_isready -U feedback_user >nul 2>&1
if %errorlevel% equ 0 (
    echo [OK] Database is ready
) else (
    echo [ERROR] Database failed to start
    pause
    exit /b 1
)

echo.
echo ==========================================
echo [SUCCESS] Installation Complete!
echo ==========================================
echo.
echo Services:
echo   Frontend:    http://localhost:3000
echo   Backend:     http://localhost:3001
echo   pgAdmin:     http://localhost:5050
echo.
echo Next: Configure LTI in Canvas LMS
echo.
pause
