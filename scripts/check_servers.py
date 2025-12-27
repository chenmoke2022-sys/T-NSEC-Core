#!/usr/bin/env python3
# -*- coding: utf-8 -*-
"""快速检查服务器状态"""

import requests
import time
import sys
import platform

# 设置Windows控制台编码
if platform.system() == 'Windows':
    import io
    sys.stdout = io.TextIOWrapper(sys.stdout.buffer, encoding='utf-8', errors='replace')
    sys.stderr = io.TextIOWrapper(sys.stderr.buffer, encoding='utf-8', errors='replace')

ports = [8080, 8081, 8082, 8083]
names = ['0.5B', '1.5B', '3B', '14B']

print("检查服务器状态...")
print("=" * 60)

all_running = True
for name, port in zip(names, ports):
    try:
        response = requests.get(f'http://localhost:{port}/health', timeout=2)
        if response.status_code == 200:
            print(f"[OK] {name} 服务器运行中 (端口 {port})")
        else:
            print(f"[FAIL] {name} 服务器响应异常 (端口 {port})")
            all_running = False
    except:
        print(f"[FAIL] {name} 服务器未运行 (端口 {port})")
        all_running = False

print("=" * 60)
if all_running:
    print("所有服务器已运行！")
    sys.exit(0)
else:
    print("部分服务器未运行")
    sys.exit(1)

