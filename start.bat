@echo off
chcp 65001 >nul
cd /d "%~dp0"
start "" "http://localhost:8000/index.html"
node server.js 8000
