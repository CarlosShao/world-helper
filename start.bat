@echo off
chcp 65001 > nul
title World Helper 一键启动

echo ========================================
echo   World Helper 一键启动脚本
echo ========================================
echo.

REM 检查Docker是否在运行
echo [1/6] 检查Docker状态...
tasklist /FI "IMAGENAME eq Docker Desktop.exe" 2>NUL | find /I /N "Docker Desktop.exe">NUL
if "%ERRORLEVEL%"=="0" (
    echo √ Docker Desktop 已在运行
) else (
    echo × Docker Desktop 未运行，正在启动...
    start "" "C:\Program Files\Docker\Docker\Docker Desktop.exe"
    echo   等待Docker启动...
    timeout /t 30 /nobreak
)

echo.

REM 切换到项目目录
echo [2/6] 切换到项目目录...
cd /d "D:\work\java\freework-workspace\world-helper"
if errorlevel 1 (
    echo × 切换目录失败！请检查项目路径
    pause
    exit /b 1
)
echo √ 已切换到项目目录

echo.

REM 拉取最新的Git代码
echo [3/6] 拉取最新代码...
git fetch origin
if errorlevel 1 (
    echo × Git拉取失败！
    pause
    exit /b 1
)

REM 强制重置到远程main分支的最新版本
echo   重置到远程main分支最新版本...
git checkout main
git reset --hard origin/main
if errorlevel 1 (
    echo × Git重置失败！
    pause
    exit /b 1
)
echo √ 已更新到最新代码

echo.

REM 停止并清理旧的Docker容器和镜像
echo [4/6] 清理旧容器和镜像...
docker-compose down
docker rmi -f world-helper_word-helper 2>NUL
docker builder prune -f
echo √ 已清理旧容器和镜像

echo.

REM 重新构建并启动Docker服务
echo [5/6] 重新构建并启动服务...
docker-compose build --no-cache
if errorlevel 1 (
    echo × Docker构建失败！
    pause
    exit /b 1
)

docker-compose up -d
if errorlevel 1 (
    echo × Docker启动失败！
    echo   请检查Docker是否正常运行
    pause
    exit /b 1
)
echo √ Docker服务已启动

echo.

echo [6/6] 等待服务就绪...
timeout /t 5 /nobreak

echo.
echo ========================================
echo   √ 部署成功！
echo ========================================
echo.
echo 访问地址：http://localhost:3000
echo.
echo 按任意键退出...
pause > nul
