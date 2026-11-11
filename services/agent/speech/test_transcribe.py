import tempfile
import unittest
import wave
from pathlib import Path
from transcribe import decode_recording


class RecordingLimits(unittest.TestCase):
    def setUp(self):
        self.directory = tempfile.TemporaryDirectory(prefix='overleaf-speech-test-')
        self.path = Path(self.directory.name) / 'audio.wav'

    def tearDown(self):
        self.directory.cleanup()

    def wav(self, seconds, rate=8000):
        with wave.open(str(self.path), 'wb') as output:
            output.setnchannels(1)
            output.setsampwidth(2)
            output.setframerate(rate)
            output.writeframes(b'\0\0' * int(seconds * rate))

    def test_resamples_to_mono_16khz(self):
        self.wav(1)
        audio, duration = decode_recording(str(self.path))
        self.assertEqual(len(audio), 16000)
        self.assertAlmostEqual(duration, 1)
        self.assertEqual(audio.dtype.name, 'float32')

    def test_rejects_long_recording_even_when_file_is_small(self):
        self.wav(61)
        self.assertLess(self.path.stat().st_size, 2 * 1024 * 1024)
        with self.assertRaisesRegex(ValueError, '60 seconds'):
            decode_recording(str(self.path))

    def test_rejects_too_short_recording(self):
        self.wav(0.01)
        with self.assertRaisesRegex(ValueError, 'too short'):
            decode_recording(str(self.path))

    def test_rejects_oversize_file_before_decoding(self):
        self.path.write_bytes(b'x' * (2 * 1024 * 1024 + 1))
        with self.assertRaisesRegex(ValueError, '2 MiB'):
            decode_recording(str(self.path))


if __name__ == '__main__':
    unittest.main()
