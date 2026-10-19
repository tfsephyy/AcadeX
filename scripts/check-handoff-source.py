"""Read-only verification of the October 19 published handoff source fingerprint.

This checks file transport before new edits. It is not a production health check.
"""
import hashlib
import json
from pathlib import Path
import sys


def main():
    root = Path(__file__).resolve().parents[1]
    manifest = root / 'docs/handoff/PUBLICATION_SOURCE_SNAPSHOT_2026-10-19.json'
    if not manifest.is_file():
        manifest = root / 'docs/handoff/LOCAL_SOURCE_SNAPSHOT_2026-10-19.json'
    if not manifest.is_file():
        print('FAILED: the dated handoff source snapshot is missing.')
        return 1
    data = json.loads(manifest.read_text(encoding='utf-8'))
    problems = []
    for name in data.get('expected_absent_tracked_paths', []):
        path = root / name
        if not path.resolve().is_relative_to(root):
            problems.append((name, 'unsafe expected-absent path'))
        elif path.exists():
            problems.append((name, 'tracked deletion not applied'))
    for item in data['files']:
        relative = Path(item['path'])
        file = root / relative
        if relative.is_absolute() or not file.resolve().is_relative_to(root) or file.is_symlink():
            problems.append((item['path'], 'unsafe path or link'))
            continue
        if not file.is_file():
            problems.append((item['path'], 'missing'))
            continue
        content = file.read_bytes()
        expected = item.get('sha256_lf_utf8')
        if expected:
            try:
                content = content.decode('utf-8').replace('\r\n', '\n').encode('utf-8')
            except UnicodeError:
                problems.append((item['path'], 'text encoding differs'))
                continue
        else:
            expected = item['sha256_raw']
        if hashlib.sha256(content).hexdigest() != expected:
            problems.append((item['path'], 'content differs'))
    if problems:
        print('FAILED:', len(problems), 'files differ from the dated local source snapshot.')
        for path, reason in problems:
            print(reason + ': ' + path)
        print('Compare the handoff branch or intentional later edits; do not reset work to hide differences.')
        return 1
    print('PASSED:', len(data['files']), 'handoff source files match, normalizing UTF-8 text line endings.')
    print('This confirms the recorded local source arrived; it does not prove EC2 health or production acceptance.')
    return 0


if __name__ == '__main__':
    sys.exit(main())
