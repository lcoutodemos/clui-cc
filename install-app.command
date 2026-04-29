#!/bin/bash
cd "$(dirname "$0")"
exec bash ./commands/install-app.command "$@"
