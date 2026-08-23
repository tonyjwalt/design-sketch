#!/usr/bin/env python3
"""Structural validation for design-sketch."""
import re
import subprocess
import tempfile
from pathlib import Path

DIR = Path(__file__).parent.parent
SKILL_MD = DIR / "SKILL.md"
SKETCH_TOOL = DIR / "tools" / "sketch-tool.js"

FIXTURE_SKETCH = """<!doctype html>
<html>
<head>
<meta charset="utf-8">
<style>
  :root {
    --demo-color: #333;
  }
  body { font-family: sans-serif; }
</style>
</head>
<body>
<main id="content">Hello</main>
</body>
</html>
"""


def read(path):
    return path.read_text()


def run_create(html, args=(), runs=1):
    """Writes `html` to a temp sketch file, runs `sketch-tool create` on it `runs` times (to
    exercise idempotency), and returns the resulting content."""
    with tempfile.TemporaryDirectory() as tmp:
        sketch = Path(tmp) / "sketch-demo.html"
        sketch.write_text(html)
        for _ in range(runs):
            subprocess.run(
                ["node", str(SKETCH_TOOL), "create", str(sketch), *args],
                check=True,
                capture_output=True,
                text=True,
            )
        return sketch.read_text()


def test_main_file_exists():
    """SKILL.md exists."""
    assert SKILL_MD.exists()


def test_under_size_limit():
    """SKILL.md under 500 lines."""
    lines = read(SKILL_MD).count("\n")
    assert lines <= 500, f"{lines} lines (limit: 500)"


def test_frontmatter_has_required_fields():
    """Frontmatter includes name and description."""
    content = read(SKILL_MD)
    assert content.startswith("---")
    front = content.split("---")[1]
    assert "name:" in front
    assert "description:" in front


def test_no_version_in_frontmatter():
    """Version lives only in kiro.json, not duplicated in frontmatter."""
    front = read(SKILL_MD).split("---")[1]
    assert "version" not in front


def test_name_matches_directory():
    """Frontmatter name matches parent directory name."""
    content = read(SKILL_MD)
    front = content.split("---")[1]
    name_line = [l for l in front.split("\n") if l.startswith("name:")][0]
    name = name_line.split(":", 1)[1].strip()
    assert name == DIR.name, f"name '{name}' != directory '{DIR.name}'"


def test_referenced_files_exist():
    """All referenced references/ and templates/ paths resolve."""
    content = read(SKILL_MD)
    all_refs = re.findall(r"`((?:references|templates)/[^`]+)`", content)
    assert all_refs, "expected at least one references/ or templates/ path in SKILL.md"
    missing = [r for r in all_refs if not (DIR / r).exists()]
    assert not missing, f"Missing: {missing}"


def test_kiro_json_exists():
    """kiro.json exists with version and dependencies."""
    import json
    kiro = DIR / "kiro.json"
    assert kiro.exists()
    data = json.loads(read(kiro))
    assert "version" in data
    assert "dependencies" in data


def test_single_file_rule_stated():
    """SKILL.md states the self-contained single-file rule at least once."""
    content = read(SKILL_MD)
    assert "self-contained" in content.lower()


def test_sketch_tool_exists():
    """tools/sketch-tool.js exists and is referenced by SKILL.md."""
    assert SKETCH_TOOL.exists()
    assert "tools/sketch-tool.js" in read(SKILL_MD)


def test_create_injects_id_overlay_by_default():
    """`create` with no flags injects the id-overlay style+script block."""
    out = run_create(FIXTURE_SKETCH)
    assert "<!-- design-sketch:id-overlay -->" in out
    assert "<!-- /design-sketch:id-overlay -->" in out
    assert "id-badge" in out
    assert "</body>" in out and "</html>" in out


def test_create_no_overlay_skips_injection():
    """`create --no-overlay` omits the id-overlay block entirely."""
    out = run_create(FIXTURE_SKETCH, ["--no-overlay"])
    assert "id-overlay" not in out
    assert "id-badge" not in out


def test_create_wireframe_merges_tokens_into_existing_root():
    """`create --type wireframe` merges wireframe-tokens.css props into an existing :root, without
    disturbing what was already declared there."""
    out = run_create(FIXTURE_SKETCH, ["--type", "wireframe"])
    assert "--wf-bg: #ffffff;" in out
    assert "--wf-space-md: 16px;" in out
    assert "--demo-color: #333;" in out  # original declaration preserved
    assert out.count(":root") == 1  # merged in place, not a second :root block


def test_create_styled_does_not_inject_tokens():
    """`create --type styled` injects the overlay but no wireframe tokens."""
    out = run_create(FIXTURE_SKETCH, ["--type", "styled"])
    assert "--wf-bg" not in out
    assert "id-badge" in out


def test_create_no_type_flag_behaves_like_styled():
    """`create` with no --type at all matches --type styled: overlay only, no tokens."""
    default_out = run_create(FIXTURE_SKETCH)
    styled_out = run_create(FIXTURE_SKETCH, ["--type", "styled"])
    assert "--wf-bg" not in default_out
    assert "id-badge" in default_out
    assert default_out == styled_out


def test_create_twice_does_not_duplicate_id_overlay():
    """Running `create` twice against the same file injects the overlay block only once."""
    out = run_create(FIXTURE_SKETCH, runs=2)
    assert out.count("<!-- design-sketch:id-overlay -->") == 1
    assert out.count("<!-- /design-sketch:id-overlay -->") == 1


def test_create_twice_does_not_duplicate_wireframe_tokens():
    """Running `create --type wireframe` twice does not duplicate the merged custom properties."""
    out = run_create(FIXTURE_SKETCH, ["--type", "wireframe"], runs=2)
    assert out.count("--wf-bg: #ffffff;") == 1
    assert out.count(":root") == 1


if __name__ == "__main__":
    tests = [v for k, v in sorted(globals().items()) if k.startswith("test_")]
    passed = failed = 0
    for test in tests:
        try:
            test()
            print(f"  ✅ {test.__doc__ or test.__name__}")
            passed += 1
        except AssertionError as e:
            print(f"  ❌ {test.__doc__ or test.__name__}: {e}")
            failed += 1
    print(f"\n{passed}/{passed + failed} passed")
    exit(1 if failed else 0)
