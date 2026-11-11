# Optional local voice transcription

The local agent can transcribe short English or Mandarin recordings without a cloud speech API key. The Web app authorizes project write access before proxying audio to the token-protected agent. Audio is not added to project files, task records or conversations. The worker uses a temporary file and removes it after success, error, cancellation or timeout.

## Install on the agent host

Use a project-specific Python 3.12 environment:

```sh
uv venv .speech-venv --python 3.12
uv pip install --python .speech-venv/bin/python -r services/agent/speech/requirements.txt
```

Download a CTranslate2 Whisper model before starting the service. The validated tiny-model revision is `Systran/faster-whisper-tiny` at `d90ca5fe260221311c53c58e660288d3deb8d356`. Model files include `model.bin`, `config.json`, `tokenizer.json` and `vocabulary.txt`. Keep them in a dedicated directory accessible only to the agent operator. Runtime inference uses local files only and does not download models.

Set these environment variables alongside the existing agent token and backend configuration:

```sh
export OVERLEAF_SPEECH_PYTHON="/absolute/path/to/.speech-venv/bin/python"
export OVERLEAF_SPEECH_MODEL="/absolute/path/to/installed/model-directory"
```

Restart the agent only when existing tasks are idle. Authenticated `/agent/health` reports `capabilities.speech` when those configuration fields are set. This is configuration detection; test an actual recording to confirm model/interpreter health.

The production worker decodes audio using its own duration-bounded PyAV path, then passes a NumPy array to faster-whisper. Do not replace this with faster-whisper's file-path decoder: faster-whisper 1.2.1 passes a removed `metadata_errors` argument with PyAV 19. The pinned environment is tested through the bounded path.

## Use

In Paper Assistant, choose **Local agent transcription** under **Voice recognition service**. Select the spoken language, click **Record instruction**, and allow microphone access. **Stop and transcribe** ends recording and uploads it to the configured local agent. Edit the returned text and use **Insert recorded text**. Sending the instruction and accepting any proposed manuscript change remain separate actions.

Recording requires HTTPS or localhost and a browser supporting MediaRecorder. Browser speech recognition remains a separate selectable service. Switching services clears the uninserted transcript. Recordings stop automatically after 59 seconds; the server rejects decoded audio longer than 60 seconds and encoded files larger than 2 MiB. Only one transcription runs at a time, on two CPU threads, with a 120-second process deadline.

Tiny is a compact baseline model, not an accuracy guarantee. In the synthetic Mandarin check it substituted a homophone for 引言. Always review mathematical terms, names and punctuation before sending. A larger compatible local model can be configured instead.

## Verification status

Real English transcription through the Python worker and Node subprocess service passed; the temporary recording was removed. Actual browser recording-to-reviewed-message/PDF acceptance and real browser microphone-denial handling passed in isolated v14. See `plan/prism-voice-plan.md` and `plan/prism-voice-acceptance-report.md` for current evidence and remaining checks.
