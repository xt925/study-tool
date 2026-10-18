# -*- coding: utf-8 -*-
"""从 packages/core/src/data/words*.ts 提取单词和例句，用 edge-tts 批量生成 MP3。

用法：
    python scripts/generate_audio.py

产物：
    apps/h5/public/audio/words/<wordId>.mp3        单词发音
    apps/h5/public/audio/examples/<wordId>.mp3     例句发音
    apps/h5/public/audio/manifest.json             文本 -> mp3 路径 的映射（speak() 依赖它）
    apps/h5/public/audio/text-index.json           id -> 上次生成时用的文本（词条文本改了才重新生成）
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
# 记录每个 id 上次生成音频时用的文本：CI 用缓存复用音频，
# 词条文本改了必须让对应 mp3 失效，否则新词会指向读错词的旧音频
INDEX_FILE = OUT_DIR / 'text-index.json'

# 单词对象的特征：id 后面紧跟 word 字段（grade/unit 对象紧跟的是 name/title），
# 且单词对象是扁平的（无嵌套），可以安全地用非贪婪匹配到闭合括号
WORD_RE = re.compile(
    r"\{\s*id: '(?P<id>[^']+)',\s*word: '(?P<word>(?:\\'|[^'])*)'(?P<body>.*?)\n\s*\}",
    re.DOTALL,
)
FIELD_RE = r"'((?:\\'|[^'])*)'"


def unescape(s: str) -> str:
    return s.replace("\\'", "'")


# 词表里用 sb / sth 表示「某人/某物」占位符，直接送去 TTS 会被按字母念出来
PLACEHOLDER_RE = re.compile(r"\bsb\b|\bsth\b", re.IGNORECASE)


def tts_text(text: str) -> str:
    return PLACEHOLDER_RE.sub(
        lambda m: 'somebody' if m.group(0).lower() == 'sb' else 'something', text
    )


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


def tts(text: str, out: Path) -> str:
    """生成一条音频。返回 'skip'（已存在）/ 'ok'（新生成）/ 'fail'。"""
    if out.exists():
        return 'skip'
    r = subprocess.run(
        ['edge-tts', '--voice', VOICE, '--text', text, '--write-media', str(out)],
        capture_output=True, text=True,
    )
    # 只在真的发了请求之后限速；命中的缓存不该陪着一起等
    time.sleep(0.3)
    if r.returncode != 0:
        print(f'  失败: {text}\n{r.stderr.strip()}', file=sys.stderr)
        return 'fail'
    return 'ok'


def main() -> None:
    words = parse_words()
    print(f'共解析到 {len(words)} 个单词')
    if not words:
        # 一个词都没解析到多半是数据文件结构变了，中止以免清空 manifest
        print('错误：未解析到任何单词，请检查数据文件路径，已中止', file=sys.stderr)
        sys.exit(1)

    (OUT_DIR / 'words').mkdir(parents=True, exist_ok=True)
    (OUT_DIR / 'examples').mkdir(parents=True, exist_ok=True)

    index: dict[str, dict] = {}
    if INDEX_FILE.exists():
        try:
            index = json.loads(INDEX_FILE.read_text(encoding='utf-8'))
        except json.JSONDecodeError:
            index = {}
    new_index: dict[str, dict] = {}

    manifest: dict[str, str] = {}
    fail = 0
    skipped = 0
    generated = 0
    for i, w in enumerate(words, 1):
        word_file = OUT_DIR / 'words' / f'{w["id"]}.mp3'
        example_file = OUT_DIR / 'examples' / f'{w["id"]}.mp3'
        prev = index.get(w['id'], {})
        example = w['example'] or ''
        # 文本变了：先删掉旧音频，否则 tts() 会因为文件已存在而跳过，留下读错词的音频
        if prev.get('word') != w['word']:
            word_file.unlink(missing_ok=True)
        if prev.get('example', '') != example:
            example_file.unlink(missing_ok=True)

        word_status = tts(tts_text(w['word']), word_file)
        if word_status == 'ok':
            generated += 1
            print(f'[{i}/{len(words)}] 新生成 {w["word"]}')
        elif word_status == 'skip':
            skipped += 1
        else:
            fail += 1
        if word_status != 'fail':
            manifest[w['word']] = f'audio/words/{w["id"]}.mp3'

        example_status = 'skip'
        if w['example']:
            example_status = tts(tts_text(w['example']), example_file)
            if example_status == 'ok':
                generated += 1
                print(f'[{i}/{len(words)}] 新生成例句 {w["example"]}')
            elif example_status == 'skip':
                skipped += 1
            else:
                fail += 1
            if example_status != 'fail':
                manifest[w['example']] = f'audio/examples/{w["id"]}.mp3'

        # 词和例句都成功才记进索引：失败的下次运行还会重新生成
        if word_status != 'fail' and example_status != 'fail':
            new_index[w['id']] = {'word': w['word'], 'example': example}

    (OUT_DIR / 'manifest.json').write_text(
        json.dumps(manifest, ensure_ascii=False, indent=1), encoding='utf-8'
    )
    INDEX_FILE.write_text(
        json.dumps(new_index, ensure_ascii=False, indent=1), encoding='utf-8'
    )
    print(
        f'完成：{len(manifest)} 条音频映射，'
        f'新生成 {generated} 个，跳过 {skipped} 个，失败 {fail} 个'
    )


if __name__ == '__main__':
    main()
