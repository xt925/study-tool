# -*- coding: utf-8 -*-
"""从 packages/core/src/data/words*.ts 提取单词和例句，用 edge-tts 批量生成 MP3。

用法：
    python scripts/generate_audio.py

产物：
    apps/h5/public/audio/words/<wordId>.mp3        单词发音
    apps/h5/public/audio/examples/<wordId>.mp3     例句发音
    apps/h5/public/audio/manifest.json             文本 -> mp3 路径 的映射（speak() 依赖它）
"""
import json
import re
import subprocess
import sys
import time
from pathlib import Path

ROOT = Path(__file__).resolve().parent.parent
# 词库按册拆分在 words.ts / words_7a.ts ... words_9b.ts 多个文件中
DATA_DIR = ROOT / 'packages' / 'core' / 'src' / 'data'
OUT_DIR = ROOT / 'apps' / 'h5' / 'public' / 'audio'
VOICE = 'en-US-AriaNeural'

# 单词对象的特征：id 后面紧跟 word 字段（grade/unit 对象紧跟的是 name/title），
# 且单词对象是扁平的（无嵌套），可以安全地用非贪婪匹配到闭合括号
WORD_RE = re.compile(
    r"\{\s*id: '(?P<id>[^']+)',\s*word: '(?P<word>(?:\\'|[^'])*)'(?P<body>.*?)\n\s*\}",
    re.DOTALL,
)
FIELD_RE = r"'((?:\\'|[^'])*)'"


def unescape(s: str) -> str:
    return s.replace("\\'", "'")


def parse_words() -> list[dict]:
    words = []
    seen = set()
    for f in sorted(DATA_DIR.glob('words*.ts')):
        text = f.read_text(encoding='utf-8')
        for m in WORD_RE.finditer(text):
            if m.group('id') in seen:
                continue
            seen.add(m.group('id'))
            example_m = re.search(r"example: " + FIELD_RE, m.group('body'))
            words.append({
                'id': m.group('id'),
                'word': unescape(m.group('word')),
                'example': unescape(example_m.group(1)) if example_m else None,
            })
    return words


def tts(text: str, out: Path) -> bool:
    if out.exists():
        return True
    r = subprocess.run(
        ['edge-tts', '--voice', VOICE, '--text', text, '--write-media', str(out)],
        capture_output=True, text=True,
    )
    if r.returncode != 0:
        print(f'  失败: {text}\n{r.stderr.strip()}', file=sys.stderr)
        return False
    return True


def main() -> None:
    words = parse_words()
    print(f'共解析到 {len(words)} 个单词')
    if not words:
        # 一个词都没解析到多半是数据文件结构变了，中止以免清空 manifest
        print('错误：未解析到任何单词，请检查数据文件路径，已中止', file=sys.stderr)
        sys.exit(1)

    (OUT_DIR / 'words').mkdir(parents=True, exist_ok=True)
    (OUT_DIR / 'examples').mkdir(parents=True, exist_ok=True)

    manifest: dict[str, str] = {}
    fail = 0
    for i, w in enumerate(words, 1):
        print(f'[{i}/{len(words)}] {w["word"]}')
        ok = tts(w['word'], OUT_DIR / 'words' / f'{w["id"]}.mp3')
        if ok:
            manifest[w['word']] = f'audio/words/{w["id"]}.mp3'
        if w['example']:
            ok2 = tts(w['example'], OUT_DIR / 'examples' / f'{w["id"]}.mp3')
            if ok2:
                manifest[w['example']] = f'audio/examples/{w["id"]}.mp3'
            ok = ok and ok2
        if not ok:
            fail += 1
        time.sleep(0.3)  # 避免请求过快被限流

    (OUT_DIR / 'manifest.json').write_text(
        json.dumps(manifest, ensure_ascii=False, indent=1), encoding='utf-8'
    )
    print(f'完成：{len(manifest)} 条音频映射，失败 {fail} 个')


if __name__ == '__main__':
    main()
