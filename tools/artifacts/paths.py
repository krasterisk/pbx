"""Explicit artifact path resolution; never patches global filesystem APIs."""
import json, os, re
from pathlib import Path

REPOSITORY = Path(__file__).resolve().parents[2]
POLICY = json.loads(Path(__file__).with_name('policy.json').read_text(encoding='utf-8'))
PRESERVED = set(POLICY['preserve'])

def artifacts_root():
    configured = os.environ.get('ARTIFACTS_ROOT')
    if configured and not Path(configured).is_absolute():
        raise ValueError('ARTIFACTS_ROOT must be absolute')
    root = Path(configured) if configured else Path.home() / 'Documents' / 'DevArtifacts' / 'krasterisk_v4'
    resolved = root.resolve()
    repo = REPOSITORY.resolve()
    if resolved == repo or repo in resolved.parents or resolved in repo.parents:
        raise ValueError('ARTIFACTS_ROOT must be outside and separate from the repository')
    return root

def is_artifact(relative):
    rel = str(relative).replace('\\', '/')
    if rel in PRESERVED: return False
    if rel in POLICY.get('additionalArtifactPaths', []) or any(rel == p or rel.startswith(p + '/') for p in POLICY.get('additionalArtifactDirectories', [])) or any(re.search(p, rel) for p in POLICY.get('additionalArtifactPatterns', [])): return True
    if any(rel == x or rel.startswith(x + '/') for x in POLICY['excludedScopes']): return False
    if any(rel == x.rstrip('/') or rel.startswith(x) for x in POLICY['outputRoots']): return True
    if not rel.startswith('.planning/'): return False
    parts = rel.split('/')
    if any(re.match(r'^(backend|frontend|shared)(-runtime)?-dist($|-)', p) or p.startswith('.vite') or p in {'__pycache__','tts-cache','sapi-cache','reranker-cache'} for p in parts): return True
    if Path(rel).suffix.lower() in POLICY['generatedExtensions']: return True
    name = parts[-1].lower()
    return name.endswith('.json') and any(rel.startswith(x) for x in POLICY['jsonScopes']) and not any(x in name for x in POLICY['jsonPreserveWords'])

def artifact_path(value, create=False):
    if not isinstance(value, (str, os.PathLike)) or '\n' in str(value) or '\0' in str(value): return value
    original = Path(value)
    # Do not resolve junctions here: classify the caller's original repo-relative path.
    full = Path(os.path.abspath(original))
    try: relative = full.relative_to(REPOSITORY)
    except ValueError:
        candidate = Path(os.environ.get('ARTIFACTS_ROOT') or Path.home() / 'Documents' / 'DevArtifacts' / 'krasterisk_v4')
        candidate = Path(os.path.abspath(candidate))
        if create and (full == candidate or candidate in full.parents):
            validated = artifacts_root().resolve()
            resolved_full = full.resolve()
            if resolved_full == validated or validated in resolved_full.parents:
                full.parent.mkdir(parents=True, exist_ok=True)
        return value
    if not is_artifact(relative.as_posix()): return value
    target = artifacts_root() / 'legacy' / relative
    if create: target.parent.mkdir(parents=True, exist_ok=True)
    return target

def output_path(*parts):
    if any(Path(p).is_absolute() or '..' in str(p).replace('\\','/').split('/') for p in parts):
        raise ValueError('Artifact output segments must stay relative')
    return artifacts_root().joinpath(*parts)
