#!/bin/bash

# Example usage:
# REPO_PATH=/path/to/repo bash deploy.sh
# or when using ssh:
# ssh user@remote_host 'REPO_PATH=/path/to/repo bash -s' < deploy.sh


cd ${REPO_PATH};
docker compose up -d --force-recreate --pull always "server";
docker image prune -a -f;
docker ps;
# docker compose restart "server";
# sleep 10;
docker compose logs -f "server";
exit;