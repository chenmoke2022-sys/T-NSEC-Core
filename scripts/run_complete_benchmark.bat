@echo off
chcp 65001 >nul
echo ============================================================
echo T-NSEC 3.0 完整基准测试
echo ============================================================
echo.

REM 检查 Python 3.12
py -3.12 --version >nul 2>&1
if %ERRORLEVEL% NEQ 0 (
    echo 错误: Python 3.12 未找到
    echo 请从 https://www.python.org/downloads/ 下载安装
    pause
    exit /b 1
)

REM 运行测试脚本
py -3.12 scripts\run_complete_benchmark.py

pause

