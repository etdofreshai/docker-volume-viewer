# Docker Volume Viewer

Read-only Docker container + volume viewer API with a lightweight verification UI.

The goal is safe inspection: list Docker metadata, browse a container filesystem, and read file contents without exposing any write, exec, delete, copy-into-container, or mutation endpoints.

## Authentication

Set one unique API key:

```bash
DOCKER_VOLUME_VIEWER_API_KEY=change-me
```

Clients may send it as:

```http
Authorization: Bearer change-me
```

or:

```http
X-API-Key: change-me
```

If no key is configured the API runs open, which is only suitable for local development.

## Docker run

```bash
docker build -t docker-volume-viewer .
docker run --rm -p 3000:3000 \
  -e DOCKER_VOLUME_VIEWER_API_KEY=change-me \
  -v /var/run/docker.sock:/var/run/docker.sock:ro \
  docker-volume-viewer
```

## Dokploy

Mount the Docker socket read-only:

```text
/var/run/docker.sock:/var/run/docker.sock:ro
```

Set env:

```text
DOCKER_VOLUME_VIEWER_API_KEY=your-unique-key
PORT=3000
```

Expose port `3000`.

## API

OpenAPI document:

- `GET /api/openapi.json`

Health:

- `GET /api/health`

Docker metadata:

- `GET /api/docker/info`
- `GET /api/docker/version`
- `GET /api/images`
- `GET /api/volumes`
- `GET /api/volumes/:name`

Containers:

- `GET /api/containers?all=true`
- `GET /api/containers/:id`
- `GET /api/containers/:id/logs?tail=200`
- `GET /api/containers/:id/stats`

Container filesystem, read-only:

- `GET /api/containers/:id/files?path=/app`
  - Lists files/directories at a path inside the container.
- `GET /api/containers/:id/files/content?path=/app/package.json`
  - Returns JSON with `encoding: utf8` for likely text, otherwise `encoding: base64`.
- `GET /api/containers/:id/files/content?path=/bin/sh&encoding=base64`
  - Forces base64 JSON response.
- `GET /api/containers/:id/files/raw?path=/app/package.json`
  - Streams raw file bytes with a best-effort content type.

Example:

```bash
curl -H "Authorization: Bearer $DOCKER_VOLUME_VIEWER_API_KEY" \
  'http://localhost:3000/api/containers'

curl -H "Authorization: Bearer $DOCKER_VOLUME_VIEWER_API_KEY" \
  'http://localhost:3000/api/containers/<id>/files?path=/app'

curl -H "Authorization: Bearer $DOCKER_VOLUME_VIEWER_API_KEY" \
  'http://localhost:3000/api/containers/<id>/files/content?path=/app/package.json'
```

## UI

`GET /` serves a small UI for verifying the API: save the key locally in your browser, list containers, browse directories, and preview file content.

## Security/read-only design

- No write/edit API.
- No `docker exec` API.
- No container start/stop/restart/delete endpoints.
- No upload endpoint.
- Docker socket should still be treated as powerful; deploy only behind the API key and trusted network/domain controls.
- Paths are normalized as virtual absolute paths so `..` cannot escape above the container root.

## Development

```bash
npm install
npm test
npm run build
npm run dev
```
