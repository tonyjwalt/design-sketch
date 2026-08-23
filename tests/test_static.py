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


# -- tune subcommand ---------------------------------------------------------------------


def run_tune(tmp, filename, args, check=True):
    """Runs `sketch-tool tune` against `tmp/filename` and returns the CompletedProcess."""
    result = subprocess.run(
        ["node", str(SKETCH_TOOL), "tune", str(Path(tmp) / filename), *args],
        capture_output=True,
        text=True,
    )
    if check:
        assert result.returncode == 0, result.stderr
    return result


def test_tune_first_call_forks_to_tuned_file_and_leaves_exploration_untouched():
    """`tune` against an exploration sketch forks a `<subject>-tuned.html` copy and injects a
    working tuner panel, without touching the original file."""
    with tempfile.TemporaryDirectory() as tmp:
        exploration = Path(tmp) / "sketch-demo.html"
        exploration.write_text(FIXTURE_SKETCH)

        run_tune(
            tmp,
            "sketch-demo.html",
            ["--type", "css-var", "--target", "--space-md", "--label", "Spacing", "--min", "4", "--max", "64"],
        )

        assert exploration.read_text() == FIXTURE_SKETCH  # exploration sketch untouched

        tuned = Path(tmp) / "sketch-demo-tuned.html"
        assert tuned.exists()
        out = tuned.read_text()
        assert "<!-- design-sketch:tuner-panel -->" in out
        assert "<!-- /design-sketch:tuner-panel -->" in out
        assert 'class="tuner-panel"' in out
        assert out.count("<fieldset") == 1
        assert 'data-bind="css-var"' in out
        assert 'data-target="--space-md"' in out
        assert "Spacing" in out
        assert "function applyCssVar" in out  # generic listener script came along


def test_tune_continuous_control_wires_min_max_value_unit():
    """A continuous css-var control carries --min/--max/--value/--unit through to the input."""
    with tempfile.TemporaryDirectory() as tmp:
        (Path(tmp) / "sketch-demo.html").write_text(FIXTURE_SKETCH)
        run_tune(
            tmp,
            "sketch-demo.html",
            [
                "--type", "css-var", "--target", "--space-md", "--label", "Spacing",
                "--min", "4", "--max", "64", "--value", "20", "--unit", "rem",
            ],
        )
        out = (Path(tmp) / "sketch-demo-tuned.html").read_text()
        assert 'type="range"' in out
        assert 'min="4"' in out and 'max="64"' in out and 'value="20"' in out
        assert 'data-unit="rem"' in out


def test_tune_readout_wires_data_readout_and_output():
    """`--readout` adds a `data-readout` attribute plus a matching `<output>` element."""
    with tempfile.TemporaryDirectory() as tmp:
        (Path(tmp) / "sketch-demo.html").write_text(FIXTURE_SKETCH)
        run_tune(
            tmp,
            "sketch-demo.html",
            ["--type", "css-var", "--target", "--space-md", "--label", "Spacing", "--min", "4", "--max", "64", "--readout"],
        )
        out = (Path(tmp) / "sketch-demo-tuned.html").read_text()
        assert 'data-readout="spacingOut"' in out
        assert '<output id="spacingOut"' in out


def test_tune_swatch_control_wires_one_button_per_option():
    """`--type css-var --options a,b` wires a swatch row with one button per color."""
    with tempfile.TemporaryDirectory() as tmp:
        (Path(tmp) / "sketch-demo.html").write_text(FIXTURE_SKETCH)
        run_tune(
            tmp,
            "sketch-demo.html",
            ["--type", "css-var", "--target", "--accent-color", "--label", "Accent", "--options", "#3366ff,#e0403f"],
        )
        out = (Path(tmp) / "sketch-demo-tuned.html").read_text()
        assert out.count("<button") == 2
        assert 'value="#3366ff"' in out and 'value="#e0403f"' in out
        assert 'class="swatch-row"' in out


def test_tune_class_toggle_wires_select_with_target_as_selector():
    """`--type class-toggle` builds a `<select>` and treats --target as a CSS selector."""
    with tempfile.TemporaryDirectory() as tmp:
        (Path(tmp) / "sketch-demo.html").write_text(FIXTURE_SKETCH)
        run_tune(
            tmp,
            "sketch-demo.html",
            ["--type", "class-toggle", "--target", "body", "--label", "Layout", "--options", "compact,spacious"],
        )
        out = (Path(tmp) / "sketch-demo-tuned.html").read_text()
        assert 'data-bind="class-toggle"' in out
        assert 'data-target="body"' in out
        assert out.count("<option") == 2
        assert "Compact" in out and "Spacious" in out


def test_tune_second_call_appends_without_duplicating_panel():
    """A second `tune` call against the already-tuned file appends its control to the existing
    panel instead of duplicating the fieldset, style, or script."""
    with tempfile.TemporaryDirectory() as tmp:
        (Path(tmp) / "sketch-demo.html").write_text(FIXTURE_SKETCH)
        run_tune(
            tmp,
            "sketch-demo.html",
            ["--type", "css-var", "--target", "--space-md", "--label", "Spacing", "--min", "4", "--max", "64"],
        )
        run_tune(
            tmp,
            "sketch-demo-tuned.html",
            ["--type", "class-toggle", "--target", "body", "--label", "Layout", "--options", "compact,spacious"],
        )

        out = (Path(tmp) / "sketch-demo-tuned.html").read_text()
        assert out.count("<!-- design-sketch:tuner-panel -->") == 1
        assert out.count("<!-- /design-sketch:tuner-panel -->") == 1
        assert out.count("<fieldset") == 1
        assert out.count("function applyCssVar") == 1  # script not duplicated
        assert 'data-target="--space-md"' in out  # first control still present
        assert 'data-target="body"' in out  # second control appended


def test_tune_fork_target_already_existing_errors_instead_of_overwriting():
    """Calling `tune` twice against the exploration file (instead of the tuned file the second
    time) refuses to clobber the already-tuned file."""
    with tempfile.TemporaryDirectory() as tmp:
        (Path(tmp) / "sketch-demo.html").write_text(FIXTURE_SKETCH)
        run_tune(
            tmp,
            "sketch-demo.html",
            ["--type", "css-var", "--target", "--space-md", "--label", "Spacing", "--min", "4", "--max", "64"],
        )
        result = run_tune(
            tmp,
            "sketch-demo.html",
            ["--type", "class-toggle", "--target", "body", "--label", "Layout", "--options", "compact,spacious"],
            check=False,
        )
        assert result.returncode != 0
        assert "already exists" in result.stderr


def test_tune_css_var_requires_min_max_or_options():
    """`--type css-var` without --min/--max or --options fails with a clear error."""
    with tempfile.TemporaryDirectory() as tmp:
        (Path(tmp) / "sketch-demo.html").write_text(FIXTURE_SKETCH)
        result = run_tune(
            tmp, "sketch-demo.html",
            ["--type", "css-var", "--target", "--space-md", "--label", "Spacing"],
            check=False,
        )
        assert result.returncode != 0
        assert "--min/--max" in result.stderr or "--options" in result.stderr


def test_tune_class_toggle_rejects_min_max():
    """`--type class-toggle` combined with --min/--max fails — those only apply to css-var."""
    with tempfile.TemporaryDirectory() as tmp:
        (Path(tmp) / "sketch-demo.html").write_text(FIXTURE_SKETCH)
        result = run_tune(
            tmp, "sketch-demo.html",
            ["--type", "class-toggle", "--target", "body", "--label", "Layout", "--options", "a,b", "--min", "0"],
            check=False,
        )
        assert result.returncode != 0


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
