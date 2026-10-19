"""Verify an extracted AcadeX source candidate without installing or accessing a DB."""
import hashlib
import json
from pathlib import Path


def main():
    root = Path(__file__).resolve().parents[1]
    manifest = json.loads((root / 'ACADEX_RELEASE_MANIFEST.json').read_text(encoding='utf8'))
    actual = []
    for item in manifest['files']:
        path = root / item['path']
        if not path.resolve().is_relative_to(root) or not path.is_file():
            raise SystemExit('Missing or unsafe source path: ' + item['path'])
        digest = hashlib.sha256(path.read_bytes()).hexdigest()
        if digest != item['sha256']:
            raise SystemExit('Source hash differs: ' + item['path'])
        if item['identity_input']:
            actual.append(item['path'] + '\0' + digest + '\n')
    digest = hashlib.sha256(''.join(sorted(actual)).encode()).hexdigest()
    if digest != manifest['source_sha256']:
        raise SystemExit('Source identity differs.')
    print('PASSED:', manifest['candidate_id'], len(manifest['files']), 'verified files')
    print('This is source integrity evidence, not production or deployment approval.')


if __name__ == '__main__':
    main()
