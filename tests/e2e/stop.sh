#!/usr/bin/env bash
# Stops what start.sh started, by the ports they use.
for port in 8090 8081 9913 9912 9915 9911; do
  pid=$(ss -ltnp 2>/dev/null | grep ":$port " | sed -E 's/.*pid=([0-9]+).*/\1/' | head -1)
  [ -n "$pid" ] && kill "$pid" 2>/dev/null
done
exit 0
