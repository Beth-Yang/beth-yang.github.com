#!/usr/bin/env bash
# 每日推送脚本：重新生成今日数据 → 提交 → 经 GitHub API 推送（绕过被封的 github.com:443）
set -e
cd "$(dirname "$0")/.."

NODE="C:/Users/123/.workbuddy/binaries/node/versions/22.22.2/node.exe"
if [ ! -f "$NODE" ]; then NODE="node"; fi

echo "▶ 1/2 生成今日数据..."
"$NODE" scripts/generate-data.js

echo "▶ 2/2 经 API 推送到 GitHub main..."
"$NODE" scripts/api-push.js
