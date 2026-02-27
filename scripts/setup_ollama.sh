#!/usr/bin/env bash

set -euo pipefail

MODEL="${MODEL:-qwen2.5:7b}"
OLLAMA_HOST="${OLLAMA_HOST:-0.0.0.0}"
OLLAMA_PORT="${OLLAMA_PORT:-11434}"
TEST_PROMPT="${TEST_PROMPT:-Return exactly: OK}"
SERVICE_NAME="${SERVICE_NAME:-ollama}"

log() {
  printf "[setup-ollama] %s\n" "$*"
}

need_cmd() {
  if ! command -v "$1" >/dev/null 2>&1; then
    log "Missing required command: $1"
    exit 1
  fi
}

run_sudo() {
  if [ "$(id -u)" -eq 0 ]; then
    "$@"
    return
  fi
  if command -v sudo >/dev/null 2>&1; then
    sudo "$@"
    return
  fi
  log "Need root privileges for: $*"
  exit 1
}

install_ollama_if_missing() {
  if command -v ollama >/dev/null 2>&1; then
    log "Ollama already installed."
    return
  fi

  need_cmd curl
  local os
  os="$(uname -s)"

  if [ "$os" = "Linux" ]; then
    log "Installing Ollama on Linux..."
    curl -fsSL https://ollama.com/install.sh | sh
    return
  fi

  if [ "$os" = "Darwin" ]; then
    if command -v brew >/dev/null 2>&1; then
      log "Installing Ollama with Homebrew..."
      brew install ollama
      return
    fi
    log "macOS detected but Homebrew is missing. Install Ollama manually: https://ollama.com/download"
    exit 1
  fi

  log "Unsupported OS: $os"
  exit 1
}

configure_systemd_host() {
  if ! command -v systemctl >/dev/null 2>&1; then
    log "systemd not found; skipping service host override."
    return
  fi

  if ! systemctl list-unit-files | grep -q "^${SERVICE_NAME}\.service"; then
    log "No ${SERVICE_NAME}.service unit found; skipping systemd override."
    return
  fi

  local dropin_dir="/etc/systemd/system/${SERVICE_NAME}.service.d"
  local dropin_file="${dropin_dir}/override.conf"

  log "Configuring ${SERVICE_NAME}.service to listen on ${OLLAMA_HOST}:${OLLAMA_PORT}..."
  run_sudo mkdir -p "$dropin_dir"
  run_sudo tee "$dropin_file" >/dev/null <<EOF
[Service]
Environment="OLLAMA_HOST=${OLLAMA_HOST}:${OLLAMA_PORT}"
EOF
  run_sudo systemctl daemon-reload
  run_sudo systemctl enable --now "${SERVICE_NAME}.service"
  run_sudo systemctl restart "${SERVICE_NAME}.service"
}

start_ollama_if_needed() {
  need_cmd curl
  need_cmd ollama

  if curl -fsS "http://127.0.0.1:${OLLAMA_PORT}/api/tags" >/dev/null 2>&1; then
    log "Ollama API already reachable on 127.0.0.1:${OLLAMA_PORT}."
    return
  fi

  if command -v systemctl >/dev/null 2>&1 && systemctl list-unit-files | grep -q "^${SERVICE_NAME}\.service"; then
    log "Starting ${SERVICE_NAME}.service..."
    run_sudo systemctl enable --now "${SERVICE_NAME}.service"
  else
    log "Starting ollama serve in background..."
    OLLAMA_HOST="${OLLAMA_HOST}:${OLLAMA_PORT}" nohup ollama serve >/tmp/ollama.log 2>&1 &
  fi

  local retries=40
  local i=0
  until curl -fsS "http://127.0.0.1:${OLLAMA_PORT}/api/tags" >/dev/null 2>&1; do
    i=$((i + 1))
    if [ "$i" -ge "$retries" ]; then
      log "Ollama API did not become ready in time."
      exit 1
    fi
    sleep 1
  done
  log "Ollama API is ready."
}

pull_model() {
  log "Pulling model: ${MODEL}"
  ollama pull "${MODEL}"
}

run_health_test() {
  local payload
  payload="$(printf '{"model":"%s","prompt":"%s","stream":false}' "$MODEL" "$TEST_PROMPT")"

  log "Running generation test on ${MODEL}..."
  local response
  response="$(curl -fsS "http://127.0.0.1:${OLLAMA_PORT}/api/generate" \
    -H "Content-Type: application/json" \
    -d "$payload")"

  if ! printf "%s" "$response" | grep -q '"response"[[:space:]]*:[[:space:]]*'; then
    log "Generation test failed: unexpected response."
    printf "%s\n" "$response"
    exit 1
  fi

  log "Generation test passed."
  printf "%s\n" "$response"
}

print_env_hint() {
  local host_ip
  host_ip="$(hostname -I 2>/dev/null | awk '{print $1}')"
  if [ -z "${host_ip}" ]; then
    host_ip="YOUR_TAILSCALE_IP"
  fi

  cat <<EOF

Use these frontend env values:
VITE_OLLAMA_URL=http://${host_ip}:${OLLAMA_PORT}
VITE_OLLAMA_MODEL=${MODEL}

If hostname -I is unavailable, replace IP with your Tailscale IP (100.x.x.x).
EOF
}

main() {
  install_ollama_if_missing
  configure_systemd_host
  start_ollama_if_needed
  pull_model
  run_health_test
  print_env_hint
  log "Done."
}

main "$@"
