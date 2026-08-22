#!/usr/bin/env python3
"""Structural validation for design-sketch."""
import re
from pathlib import Path

DIR = Path(__file__).parent.parent
SKILL_MD = DIR / "SKILL.md"


def read(path):
    return path.read_text()


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
