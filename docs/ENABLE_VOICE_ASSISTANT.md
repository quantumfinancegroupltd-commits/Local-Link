# Enabling voice in the AI assistant (YAO)

The assistant can transcribe your speech (Whisper) and read replies aloud (TTS). Both use OpenAI and require an API key on the **server** where the API runs.

## Why you see "Voice is not configured" / 503

The backend returns **503** and "Voice is not configured" when `OPENAI_API_KEY` is not set in the API process environment. The frontend then shows a message asking the admin to add the key.

## Automatic: key from your machine to the server

If **`backend/.env`** on your Mac (or CI) already contains `OPENAI_API_KEY=sk-...`, then **`./deploy.sh`** will copy that file to the server as the repo’s `.env` and recreate the API container so it picks up the key. No need to edit anything on the server. Just ensure `backend/.env` has the key and run deploy as usual.

## How to enable voice (server admin, manual)

1. **Get an OpenAI API key**  
   Create one at [platform.openai.com](https://platform.openai.com/api-keys). Billing must be enabled; Whisper and TTS usage is charged per request.

2. **Add the key to the API environment**  
   The API reads `OPENAI_API_KEY` from the environment. For the Docker-based deploy:

   - On the server, in the directory that contains `docker-compose.selfhost.yml` (e.g. `~/LocalLink`), ensure there is a **`.env`** file.
   - Add a line:
     ```bash
     OPENAI_API_KEY=sk-your-key-here
     ```
   - The `api` service is configured with `env_file: .env`, so it will load this file.

3. **Restart the API**  
   So the new variable is picked up:
   ```bash
   cd ~/LocalLink   # or your repo path
   docker compose -f docker-compose.selfhost.yml up -d --force-recreate api
   ```

4. **Verify**  
   Use the assistant in the app: hold the mic button, speak, and release. If the key is valid and the service is up, you should get transcription and a spoken reply.

## Same key for chat and voice

The same `OPENAI_API_KEY` is used for:

- **Chat** (text replies) – already used by the assistant.
- **Transcribe** – Whisper (`whisper-1`).
- **Speak** – TTS (`tts-1`, voice `onyx`).

If chat works but voice returns 503, the key is likely not in the environment seen by the API process (e.g. missing from the server `.env` or API not restarted after adding it).
