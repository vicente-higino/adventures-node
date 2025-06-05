#!/bin/bash


cd ${REPO_PATH};
# docker compose up -d --force-recreate --pull always "server";
# docker image prune -a -f;
docker ps;
# docker compose restart "server";
sleep 10;
docker compose logs "server";
exit;