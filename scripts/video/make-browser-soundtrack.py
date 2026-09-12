"""Original, quiet instrumental bed. Standard library only; no samples or third-party music."""
import math
import wave
from array import array
from pathlib import Path

RATE, SECONDS, BPM = 24000, 60, 96
beat = 60 / BPM
chords = [(50, 57, 61, 64), (47, 54, 57, 62), (43, 54, 59, 62), (45, 55, 59, 64)]
melody = [74, 69, 66, 64, 69, 66, 62, 66, 71, 66, 62, 69, 64, 67, 69, 71]
frequency = lambda midi: 440 * 2 ** ((midi - 69) / 12)
tau = 2 * math.pi
data = array('h')
for i in range(RATE * SECONDS):
    t = i / RATE
    bar = int(t / (beat * 4))
    chord = chords[(bar // 2) % 4]
    phase = (t % (beat * 8)) / (beat * 8)
    swell = min(1, phase * 12, (1 - phase) * 12)
    value = 0.019 * swell * sum(math.sin(tau * frequency(n) * t) + 0.12 * math.sin(tau * frequency(n) * 2 * t) for n in chord)
    pluck_age = t % (beat * 2)
    midi = melody[int(t / (beat * 2)) % len(melody)]
    envelope = (1 - math.exp(-pluck_age * 100)) * math.exp(-pluck_age * 4.7)
    value += 0.075 * envelope * (math.sin(tau * frequency(midi) * pluck_age) + 0.17 * math.sin(tau * frequency(midi) * 2 * pluck_age))
    kick_age = t % (beat * 2)
    value += 0.07 * math.exp(-kick_age * 20) * math.sin(tau * (49 * kick_age + 2.2 * (1 - math.exp(-kick_age * 25))))
    fade = min(1, t / 1.8, max(0, (SECONDS - t) / 2.7))
    data.append(round(max(-1, min(1, value * fade)) * 32767))
out = Path('artifacts/browser-video-review/soundtrack.wav')
out.parent.mkdir(parents=True, exist_ok=True)
with wave.open(str(out), 'wb') as audio:
    audio.setnchannels(1)
    audio.setsampwidth(2)
    audio.setframerate(RATE)
    audio.writeframes(data.tobytes())
print(f'Original instrumental: {out} · {SECONDS}s')
