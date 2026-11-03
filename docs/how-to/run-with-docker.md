# Run with Docker

1. Start Ollama on the host and make a model available with `ollama list`.
2. From the repository root, build and start the app:

```sh
docker compose up --build -d
```

3. Open http://localhost:3000.
4. Select the Ollama model in the model picker.
5. Read logs when a request fails:

```sh
docker compose logs --tail=100 standard-ui
```

Compose forwards container port 3000 to `127.0.0.1:3000`. It uses `http://host.docker.internal:11434` for host Ollama.

The `standard_ui_data` volume holds uploaded files and custom provider definitions. `docker compose down -v` deletes the volume.
