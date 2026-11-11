"""One bounded recording per invocation; parent enforces process deadline and cleanup."""
import argparse
import json
import sys
from pathlib import Path


def decode_recording(path):
    import av
    import numpy as np

    if Path(path).stat().st_size > 2 * 1024 * 1024:
        raise ValueError('Audio exceeds 2 MiB')
    chunks = []
    samples = 0
    with av.open(path) as container:
        if not container.streams.audio:
            raise ValueError('No audio track found')
        stream = container.streams.audio[0]
        stream.thread_count = 1
        resampler = av.AudioResampler(format='flt', layout='mono', rate=16000)

        def append(frame):
            nonlocal samples
            samples += frame.samples
            if samples > 60 * 16000:
                raise ValueError('Audio exceeds 60 seconds')
            chunks.append(frame.to_ndarray().reshape(-1))

        for frame in container.decode(stream):
            for converted in resampler.resample(frame):
                append(converted)
        for converted in resampler.resample(None):
            append(converted)
    if samples < 1600:
        raise ValueError('Audio recording is empty or too short')
    return np.concatenate(chunks), samples / 16000


def main():
    parser = argparse.ArgumentParser()
    parser.add_argument('--model', required=True)
    parser.add_argument('--audio', required=True)
    parser.add_argument('--language', required=True, choices=['en', 'zh'])
    args = parser.parse_args()
    try:
        audio, duration = decode_recording(args.audio)
        from faster_whisper import WhisperModel
        model = WhisperModel(args.model, device='cpu', compute_type='int8',
                             cpu_threads=2, num_workers=1, local_files_only=True)
        segments, _ = model.transcribe(audio, language=args.language,
                                       beam_size=5, vad_filter=True,
                                       condition_on_previous_text=False)
        pieces = []
        length = 0
        for segment in segments:
            value = segment.text.strip()
            length += len(value) + 1
            if length > 32000:
                raise ValueError('Transcript exceeds 32000 characters')
            pieces.append(value)
        print(json.dumps({'text': ' '.join(pieces), 'language': args.language,
                          'duration': duration}), flush=True)
    except Exception:
        # Do not expose server paths, decoder internals or audio in responses/logs.
        print(json.dumps({'error': 'Audio could not be transcribed within supported limits'}), flush=True)
        return 1
    return 0


if __name__ == '__main__':
    sys.exit(main())
