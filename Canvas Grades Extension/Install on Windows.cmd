@echo off
rem Double-click to install Canvas Grades with automatic updates.
powershell -NoProfile -ExecutionPolicy Bypass -File "%~dp0update.ps1" -Install
pause
