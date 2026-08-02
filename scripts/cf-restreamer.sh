#!/usr/bin/env bash
# Nova TV — Cloudflare Stream restreamer worker.
#
# Cloudflare Stream cannot pull a live Xtream feed, so this worker runs on the
# VPS, fetches the channel roster from Nova TV, and pushes each Xtream TS feed
# into its Cloudflare Live Input over RTMPS with ffmpeg (stream copy, no
# re-encode). It also sends a heartbeat so /admin/cdn shows node health.
#
# Requirements: bash, curl, jq, ffmpeg.
#
# Env:
#   NOVA_BASE_URL          e.g. https://tv.canarmodern.com
#   NOVA_RESTREAMER_TOKEN  same value as the Nova TV secret
#   NODE_NAME              optional, defaults to $(hostname)
#   POLL_INTERVAL          optional, seconds between roster refreshes (default 60)

set -uo pipefail

BASE_URL="${NOVA_BASE_URL:?NOVA_BASE_URL is required}"
TOKEN="${NOVA_RESTREAMER_TOKEN:?NOVA_RESTREAMER_TOKEN is required}"
NODE_NAME="${NODE_NAME:-$(hostname)}"
POLL_INTERVAL="${POLL_INTERVAL:-60}"
VERSION="1.0.0"

declare -A PIDS

cleanup() {
  echo "==> stopping all ffmpeg workers"
  for id in "${!PIDS[@]}"; do kill "${PIDS[$id]}" 2>/dev/null || true; done
  exit 0
}
trap cleanup INT TERM

start_channel() {
  local id="$1" src="$2" rtmps="$3" key="$4" title="$5"
  echo "==> [$title] starting push → ${rtmps}"
  (
    while true; do
      ffmpeg -hide_banner -loglevel warning \
        -reconnect 1 -reconnect_streamed 1 -reconnect_delay_max 5 \
        -i "$src" \
        -c:v copy -c:a aac -b:a 128k -ar 44100 \
        -f flv "${rtmps%/}/${key}" || true
      echo "==> [$title] ffmpeg exited, retrying in 10s"
      sleep 10
    done
  ) &
  PIDS["$id"]=$!
}

heartbeat() {
  curl -fsS -X POST "${BASE_URL}/api/public/cf-stream/restreamer" \
    -H "authorization: Bearer ${TOKEN}" \
    -H "content-type: application/json" \
    -d "{\"nodeName\":\"${NODE_NAME}\",\"version\":\"${VERSION}\",\"activeChannels\":${#PIDS[@]}}" \
    >/dev/null || echo "!! heartbeat failed"
}

while true; do
  ROSTER="$(curl -fsS "${BASE_URL}/api/public/cf-stream/restreamer" \
    -H "authorization: Bearer ${TOKEN}" || echo '')"

  if [ -n "$ROSTER" ]; then
    while IFS=$'\t' read -r id src rtmps key title; do
      [ -z "$id" ] && continue
      if [ -n "${PIDS[$id]:-}" ] && kill -0 "${PIDS[$id]}" 2>/dev/null; then continue; fi
      start_channel "$id" "$src" "$rtmps" "$key" "$title"
    done < <(echo "$ROSTER" | jq -r '.channels[] | [.id, .sourceUrl, .rtmpsUrl, .rtmpsStreamKey, (.title // .xtreamId)] | @tsv')
  else
    echo "!! roster fetch failed"
  fi

  heartbeat
  sleep "$POLL_INTERVAL"
done
