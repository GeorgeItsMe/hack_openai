"""Build the English voice stem and timed captions for the live browser film."""
import json
import os
from pathlib import Path
import re
import subprocess

ff = os.environ.get('TABBY_FFMPEG', 'ffmpeg')
root = Path('artifacts/tabby-live-video')
items = json.loads((root / 'narration-timing.json').read_text())
starts = dict(intro=.5, goal=6.5, aligned=14.5, distraction=22, task=32.2, tabs=43, ending=53.4)
args = [ff, '-hide_banner', '-y']
filters = []
for n, item in enumerate(items):
    args += ['-i', str(root / 'voice' / (item['id'] + '.mp3'))]
    filters.append(f'[{n}:a]adelay={round(starts[item["id"]]*1000)}:all=1[a{n}]')
filters.append(''.join(f'[a{n}]' for n in range(len(items))) +
               f'amix=inputs={len(items)}:normalize=0,apad,atrim=duration=60,loudnorm=I=-16:TP=-1.5:LRA=9[voice]')
args += ['-filter_complex', ';'.join(filters), '-map', '[voice]', '-ar', '48000', str(root / 'voiceover.wav')]
subprocess.run(args, check=True, capture_output=True)
subprocess.run([ff, '-hide_banner', '-y', '-i', str(root / 'voiceover.wav'),
                '-i', 'artifacts/browser-video-review/soundtrack.wav',
                '-filter_complex', '[1:a]volume=0.18[bed];[0:a][bed]amix=inputs=2:normalize=0,alimiter=limit=0.89[out]',
                '-map', '[out]', '-c:a', 'pcm_s16le', str(root / 'soundtrack.wav')], check=True, capture_output=True)
subprocess.run([ff, '-hide_banner', '-y', '-i', str(root / 'voiceover.wav'), '-c:a', 'libmp3lame',
                '-b:a', '192k', 'public/demo/tabby-narration-en.mp3'], check=True, capture_output=True)

def stamp(t, srt=False):
    ms=round(t*1000)
    return f'{ms//3600000:02}:{ms//60000%60:02}:{ms//1000%60:02}' + (',' if srt else '.') + f'{ms%1000:03}'

cues=[]
for item in items:
    sentences=re.findall(r'[^.!?]+[.!?]?', item['text'])
    total=sum(len(s.split()) for s in sentences)
    cursor=starts[item['id']]
    for sentence in sentences:
        duration=item['duration']*len(sentence.split())/total
        cues.append((cursor,cursor+duration,sentence.strip()))
        cursor+=duration
vtt='WEBVTT\n\n'+'\n\n'.join(f'{stamp(a)} --> {stamp(b)}\n{text}' for a,b,text in cues)+'\n'
Path('public/demo/tabby-live-demo.vtt').write_text(vtt)
(root/'captions.srt').write_text('\n\n'.join(f'{n+1}\n{stamp(a, True)} --> {stamp(b, True)}\n{text}' for n,(a,b,text) in enumerate(cues))+'\n')
(root/'voice-timeline.json').write_text(json.dumps({'duration':60,'starts':starts,'voice':'Licensed stock synthetic voice; English narration'}, indent=2)+'\n')
print('English voiceover, music mix and captions ready: 60 seconds.')
