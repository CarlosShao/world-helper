@echo off
chcp 65001 >nul
title 移除SSH密钥密码

echo ========================================
echo   移除SSH密钥密码工具
echo ========================================
echo.
echo 此脚本将移除你的SSH密钥的密码，
echo 之后就不需要每次输入密码了！
echo.

set /p confirm="确认要移除SSH密钥密码吗(Y/N)？"

if /i not "%confirm%"=="Y" (
    echo 已取消操作。
    pause
    exit /b 0
)

echo.
echo 正在移除SSH密钥密码...
echo 注意：需要输入原密码进行验证！
echo.

REM 使用PowerShell来处理密钥重写
powershell -Command "$env:PATH = [Environment]::GetEnvironmentVariable('PATH','Machine') + ';' + [Environment]::GetEnvironmentVariable('PATH','User'); $keyPath = 'C:\Users\swq\.ssh\id_ed25519'; if (Test-Path $keyPath) { Write-Host '找到密钥文件，正在移除密码...'; ssh-keygen -p -f $keyPath } else { Write-Host '未找到密钥文件！' -ForegroundColor Red }"

echo.
echo 完成！现在Git操作不需要输入密码了。
echo.
pause
