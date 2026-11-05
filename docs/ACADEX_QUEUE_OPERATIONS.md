# AcadeX background queue operations

## Redis service

The optional Redis service is defined in [`deploy/redis.compose.yml`](../deploy/redis.compose.yml). It binds only to `127.0.0.1:6379`, requires a private password, keeps append-only data in a named Docker volume, and uses `noeviction` so queued jobs are not silently discarded when Redis reaches its configured memory cap.

Create a private environment file outside the repository with a strong random `REDIS_PASSWORD`, readable only by the deployment operator. Start the service with:

```sh
docker compose --env-file /etc/acadex/redis.env -f deploy/redis.compose.yml up -d
docker compose --env-file /etc/acadex/redis.env -f deploy/redis.compose.yml ps
```

After its health check passes, set the same value in the private Laravel environment and configure:

```dotenv
QUEUE_CONNECTION=redis
REDIS_CLIENT=predis
REDIS_HOST=127.0.0.1
REDIS_PORT=6379
REDIS_PASSWORD=<same-private-value>
REDIS_QUEUE=default
REDIS_QUEUE_RETRY_AFTER=660
```

The application includes the pure-PHP Predis client, so the queue does not depend on an unverified PHP extension. The existing `database` queue remains the local fallback. Do not enable `QUEUE_CONNECTION=redis` until Redis and the worker are running.

## Worker service

[`deploy/acadex-queue.service.example`](../deploy/acadex-queue.service.example) is a template, not an installable unit. Replace every placeholder with the verified release path and PHP CLI path, and use a dedicated least-privilege worker identity that can read private storage and write Laravel logs/cache. The worker runs one job at a time, has a 600-second timeout, and restarts after Laravel's successful `queue:restart` exit. Redis uses a 660-second retry window, which exceeds the worker timeout.

Install the completed unit, enable it at boot, and verify `systemctl status` and `journalctl` after startup. On each release, switch to the release directory, clear only that release's cached configuration, restart the worker, and confirm it returns to `active`. The queue's durable data volume is independent of release directories.

## Capacity and fallback

The production host described in the handoff is a small shared application/OCR machine. Redis is capped at 128 MiB and the Laravel worker processes one job at a time. Do not run an additional OCR/model worker or local AI runtime without separately checking memory and CPU headroom. Ollama remains optional and disabled by default.

If Redis is unavailable before activation, keep the application on the existing database queue and use its configured worker. If Redis fails after activation, restore the previous queue configuration and start the matching database worker before draining or replaying jobs. Do not flush Redis as a repair action; queued and failed job records are operational data.
