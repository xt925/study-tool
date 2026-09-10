# -*- coding: utf-8 -*-
"""把课本原始词表解析成 words.ts 需要的 TS 数据。

输入格式（每行一条）：
    单词 /音标/ 词性.释义 [词性.释义 ...]     例如: doubt /daut/ n.不确定 v.怀疑
    词组 词组意思                              例如: instead of 代替......;而不是......

用法：
    python scripts/parse_words.py <输入文件> --id-prefix g8a-u1 -o 输出.ts

输出：TS 数组元素。用 -o 指定输出文件（推荐，固定 UTF-8）；
不加 -o 则打印到 stdout，可重定向后粘贴进 words.ts
（注意：PowerShell 的 > 重定向会转码导致乱码，务必用 -o 或在 Git Bash 里重定向）。
无法解析的行打印到 stderr，方便人工检查。
"""
import argparse
import re
import sys

# Windows 控制台默认 GBK，重定向到文件时必须强制 UTF-8
sys.stdout.reconfigure(encoding='utf-8', newline='\n')
sys.stderr.reconfigure(encoding='utf-8', newline='\n')

# 常见词性标记（不含点号）
POS_TAGS = {
    'n', 'v', 'vt', 'vi', 'adj', 'adv', 'prep', 'conj', 'pron', 'num',
    'det', 'art', 'interj', 'int', 'aux', 'abbr', 'modal', 'link v',
}
POS_RE = re.compile(r"([a-z]+(?:\s+v)?)\.")

# 词组行：英文部分（字母/空格/连字符/撇号/括号，如 lend(sb) a hand）+ 中文部分
# 中文部分允许以括号开头（如 "clear sb's throat (尤指说话前…)清清嗓子"）
PHRASE_RE = re.compile(r"^([A-Za-z][A-Za-z''\- ()]*?)\s+([一-鿿(].*)$")


def clean_meaning(s: str) -> str:
    # 去掉开头多余的点（如 "n........巷"）、结尾粘上的页码数字（如 "有风险的12"）
    s = s.lstrip('.').strip()
    s = re.sub(r'\d+$', '', s).strip()
    return s


def parse_senses(tail: str) -> list[tuple[str, str]] | None:
    """解析 'n.不确定 v.怀疑' 为 [(pos, meaning), ...]，没有词性返回 None"""
    matches = [m for m in POS_RE.finditer(tail) if m.group(1).strip() in POS_TAGS]
    if not matches:
        return None
    senses = []
    for i, m in enumerate(matches):
        pos = m.group(1).strip() + '.'
        end = matches[i + 1].start() if i + 1 < len(matches) else len(tail)
        meaning = clean_meaning(tail[m.end():end])
        if meaning:
            senses.append((pos, meaning))
    return senses or None


def esc(s: str) -> str:
    return s.replace("\\", "\\\\").replace("'", "\\'")


def parse_line(line: str) -> dict | None:
    parts = line.split('/')
    if len(parts) >= 3:
        # 单词 /音标/ 词性.释义...
        word = parts[0].strip()
        phonetic = '/' + parts[1].strip() + '/'
        tail = '/'.join(parts[2:]).strip()
        senses = parse_senses(tail)
        if not senses:
            # 没有词性标记（如 am/pm 这类缩写），整条释义作为一个无词性义项
            meaning = clean_meaning(tail)
            if meaning:
                senses = [('', meaning)]
        if not word or not senses:
            return None
        return {'word': word, 'phonetic': phonetic, 'senses': senses, 'phrase': False}
    if len(parts) == 2:
        # 没有音标：单词 词性.释义
        word = parts[0].strip()
        senses = parse_senses(parts[1].strip())
        if word and senses:
            return {'word': word, 'phonetic': None, 'senses': senses, 'phrase': False}
        return None
    # 词组：纯英文 + 中文意思
    m = PHRASE_RE.match(line)
    if m:
        phrase = re.sub(r'\s+', ' ', m.group(1)).strip()
        meaning = clean_meaning(m.group(2))
        if phrase and meaning:
            return {'word': phrase, 'phonetic': None,
                    'senses': [('', meaning)], 'phrase': True}
    return None


def to_ts(entry: dict, wid: str) -> str:
    lines = [f"          {{", f"            id: '{wid}',",
             f"            word: '{esc(entry['word'])}',"]
    if entry['phonetic']:
        lines.append(f"            phonetic: '{esc(entry['phonetic'])}',")
    senses = ', '.join(
        "{ pos: '%s', meaning: '%s' }" % (esc(p), esc(m)) if p
        else "{ pos: '', meaning: '%s' }" % esc(m)
        for p, m in entry['senses']
    )
    lines.append(f'            senses: [{senses}],')
    if entry['phrase']:
        lines.append('            isPhrase: true,')
    lines.append('          },')
    return '\n'.join(lines)


def main() -> None:
    ap = argparse.ArgumentParser()
    ap.add_argument('input')
    ap.add_argument('--id-prefix', required=True, help='如 g8a-u1，生成 g8a-u1-w1...')
    ap.add_argument('-o', '--output',
                    help='输出文件路径（推荐！比 shell 重定向可靠，避免 PowerShell 转码）')
    args = ap.parse_args()

    text = open(args.input, encoding='utf-8').read()
    out_lines: list[str] = []
    ok = bad = 0
    for i, raw in enumerate(text.splitlines(), 1):
        line = raw.strip()
        if not line:
            continue
        entry = parse_line(line)
        if entry:
            out_lines.append(to_ts(entry, f'{args.id_prefix}-w{ok + 1}'))
            ok += 1
        else:
            print(f'[第{i}行无法解析] {line}', file=sys.stderr)
            bad += 1

    if args.output:
        # 直接写文件，固定 UTF-8，不经过 shell 重定向（PowerShell 会转码导致乱码）
        with open(args.output, 'w', encoding='utf-8', newline='\n') as f:
            f.write('\n'.join(out_lines) + '\n')
    else:
        print('\n'.join(out_lines))

    print(f'解析成功 {ok} 条，失败 {bad} 条', file=sys.stderr)


if __name__ == '__main__':
    main()
