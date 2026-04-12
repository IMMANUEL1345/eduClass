# EduClass - GitHub Push Script
# Run: .\push-educlass.ps1

$projectPath = "C:\wamp64\www\educlass"
$repoUrl     = "https://github.com/IMMANUEL1345/eduClass.git"

Set-Location $projectPath

if (-not (Test-Path ".git")) {
    Write-Host "Initializing git repository..." -ForegroundColor Yellow
    git init
    git branch -M main
    git remote add origin $repoUrl
    Write-Host "Git initialized." -ForegroundColor Green
}

if (-not (Test-Path ".gitignore")) {
    $lines = @(
        "node_modules/",
        "backend/node_modules/",
        "frontend/node_modules/",
        "electron/node_modules/",
        ".env",
        "backend/.env",
        "frontend/.env",
        ".env.local",
        ".env.production",
        "frontend/build/",
        "electron/dist/",
        "*.log",
        ".DS_Store",
        "Thumbs.db"
    )
    $lines | Set-Content ".gitignore"
    Write-Host ".gitignore created." -ForegroundColor Green
}

git rm --cached .env --ignore-unmatch 2>$null | Out-Null
git rm --cached backend/.env --ignore-unmatch 2>$null | Out-Null
git rm --cached frontend/.env --ignore-unmatch 2>$null | Out-Null

$status = git status --porcelain

if ($status) {
    Write-Host "Changes detected:" -ForegroundColor Yellow
    git status --short

    git add .

    $stagedEnv = git diff --cached --name-only | Select-String "\.env"
    if ($stagedEnv) {
        Write-Host "WARNING: .env detected - removing from staging..." -ForegroundColor Red
        git reset HEAD -- .env backend/.env frontend/.env 2>$null | Out-Null
    }

    $timestamp = Get-Date -Format "yyyy-MM-dd HH:mm:ss"
    $message = "EduClass update: " + $timestamp
    git commit -m $message

    Write-Host "Pushing to GitHub..." -ForegroundColor Yellow
    git push origin main

    if ($LASTEXITCODE -eq 0) {
        Write-Host "Push successful!" -ForegroundColor Green
        Write-Host "Render will redeploy in ~1 minute." -ForegroundColor Cyan
        Write-Host "Vercel will redeploy in ~1 minute." -ForegroundColor Cyan
    } else {
        Write-Host "Push failed. Try: git push -u origin main" -ForegroundColor Red
    }
} else {
    Write-Host "No changes to commit." -ForegroundColor Cyan
}