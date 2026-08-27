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
    --space-md: 16px;
    --space-lg: 32px;
    --accent-color: #3366ff;
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


def test_version_in_frontmatter():
    """Frontmatter carries the version under metadata (no kiro.json — this skill isn't published
    through the agents-of-shield registry, so that convention doesn't apply here)."""
    front = read(SKILL_MD).split("---")[1]
    assert "metadata:" in front
    assert "version:" in front


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


def test_create_refuses_against_reference_sketch():
    """`create` refuses to run against a `-reference.html` file (docs/adr/0006) — it's frozen at
    bake, and create writes in place, so nothing else would stop it from silently resurrecting the
    ID overlay into a handoff artifact."""
    with tempfile.TemporaryDirectory() as tmp:
        sketch = Path(tmp) / "sketch-demo-reference.html"
        sketch.write_text(FIXTURE_SKETCH)
        result = subprocess.run(
            ["node", str(SKETCH_TOOL), "create", str(sketch)],
            capture_output=True,
            text=True,
        )
        assert result.returncode != 0
        assert "reference sketch" in result.stderr
        assert sketch.read_text() == FIXTURE_SKETCH  # untouched


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
        assert out.count("<details") == 1
        assert 'class="tuner-panel-body"' in out
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
    panel instead of duplicating the details/summary chrome, style, or script."""
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
        assert out.count("<details") == 1
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


def test_tune_css_var_without_range_or_options_scaffolds_color_input():
    """`--type css-var` with neither --min/--max nor --options scaffolds a color-input control."""
    with tempfile.TemporaryDirectory() as tmp:
        (Path(tmp) / "sketch-demo.html").write_text(FIXTURE_SKETCH)
        run_tune(
            tmp, "sketch-demo.html",
            ["--type", "css-var", "--target", "--accent-color", "--label", "Accent"],
        )
        out = (Path(tmp) / "sketch-demo-tuned.html").read_text()
        assert 'type="color"' in out
        assert 'data-bind="css-var"' in out
        assert 'data-target="--accent-color"' in out
        assert 'value="#000000"' in out  # sensible fallback when --value is omitted


def test_tune_color_input_value_flag_sets_initial_hex():
    """`--value` on a color-input control sets its initial hex value."""
    with tempfile.TemporaryDirectory() as tmp:
        (Path(tmp) / "sketch-demo.html").write_text(FIXTURE_SKETCH)
        run_tune(
            tmp, "sketch-demo.html",
            ["--type", "css-var", "--target", "--accent-color", "--label", "Accent", "--value", "#3366ff"],
        )
        out = (Path(tmp) / "sketch-demo-tuned.html").read_text()
        assert 'value="#3366ff"' in out


def test_tune_color_input_rejects_readout():
    """`--readout` on a color-input control (no --min/--max) fails clearly."""
    with tempfile.TemporaryDirectory() as tmp:
        (Path(tmp) / "sketch-demo.html").write_text(FIXTURE_SKETCH)
        result = run_tune(
            tmp, "sketch-demo.html",
            ["--type", "css-var", "--target", "--accent-color", "--label", "Accent", "--readout"],
            check=False,
        )
        assert result.returncode != 0
        assert "--readout" in result.stderr


def test_tune_css_var_partial_range_errors():
    """Only one of --min/--max (without the other, and without --options) is rejected rather than
    silently falling through to a color-input control."""
    with tempfile.TemporaryDirectory() as tmp:
        (Path(tmp) / "sketch-demo.html").write_text(FIXTURE_SKETCH)
        result = run_tune(
            tmp, "sketch-demo.html",
            ["--type", "css-var", "--target", "--space-md", "--label", "Spacing", "--min", "4"],
            check=False,
        )
        assert result.returncode != 0
        assert "--min" in result.stderr and "--max" in result.stderr


# -- tune: css-var root-scope validation (.scratch/tuner-scaffold-gaps/issues/02) ---------------


def test_tune_rejects_css_var_target_not_declared_in_root():
    """A range control targeting a custom property that's never declared in :root fails fast,
    naming the property and saying it needs to live in :root — instead of silently scaffolding a
    control that would never visibly affect the page (a property re-declared closer to the target
    element shadows whatever `setProperty` writes at the root, with no error anywhere downstream)."""
    with tempfile.TemporaryDirectory() as tmp:
        (Path(tmp) / "sketch-demo.html").write_text(FIXTURE_SKETCH)
        result = run_tune(
            tmp, "sketch-demo.html",
            ["--type", "css-var", "--target", "--undeclared-space", "--label", "Spacing", "--min", "4", "--max", "64"],
            check=False,
        )
        assert result.returncode != 0
        assert "--undeclared-space" in result.stderr
        assert ":root" in result.stderr
        assert not (Path(tmp) / "sketch-demo-tuned.html").exists()  # nothing written


def test_tune_rejects_swatch_target_not_declared_in_root():
    """The same root-scope check applies to a swatch (--options) css-var control, not just range."""
    with tempfile.TemporaryDirectory() as tmp:
        (Path(tmp) / "sketch-demo.html").write_text(FIXTURE_SKETCH)
        result = run_tune(
            tmp, "sketch-demo.html",
            ["--type", "css-var", "--target", "--undeclared-accent", "--label", "Accent", "--options", "#111,#222"],
            check=False,
        )
        assert result.returncode != 0
        assert "--undeclared-accent" in result.stderr


def test_tune_rejects_color_input_target_not_declared_in_root():
    """The same root-scope check applies to a color-input (no --min/--max, no --options) control."""
    with tempfile.TemporaryDirectory() as tmp:
        (Path(tmp) / "sketch-demo.html").write_text(FIXTURE_SKETCH)
        result = run_tune(
            tmp, "sketch-demo.html",
            ["--type", "css-var", "--target", "--undeclared-accent", "--label", "Accent"],
            check=False,
        )
        assert result.returncode != 0
        assert "--undeclared-accent" in result.stderr


def test_tune_accepts_css_var_target_declared_via_var_indirection():
    """A target declared in :root through `var()` indirection (e.g. `--nav-bg: var(--color-surface);`)
    counts as declared — the check only cares that the property itself has a :root declaration, not
    that its value is a literal."""
    indirect_fixture = FIXTURE_SKETCH.replace(
        "--demo-color: #333;", "--demo-color: #333;\n    --nav-bg: var(--demo-color);"
    )
    with tempfile.TemporaryDirectory() as tmp:
        (Path(tmp) / "sketch-demo.html").write_text(indirect_fixture)
        run_tune(
            tmp, "sketch-demo.html",
            ["--type", "css-var", "--target", "--nav-bg", "--label", "Nav background"],
        )
        out = (Path(tmp) / "sketch-demo-tuned.html").read_text()
        assert 'data-target="--nav-bg"' in out


def test_tune_rejects_undeclared_target_when_appending_to_existing_panel():
    """The root-scope check also applies on the append path (a file that already has a panel), not
    just the first fork."""
    with tempfile.TemporaryDirectory() as tmp:
        (Path(tmp) / "sketch-demo.html").write_text(FIXTURE_SKETCH)
        run_tune(
            tmp, "sketch-demo.html",
            ["--type", "css-var", "--target", "--space-md", "--label", "Spacing", "--min", "4", "--max", "64"],
        )
        before = (Path(tmp) / "sketch-demo-tuned.html").read_text()
        result = run_tune(
            tmp, "sketch-demo-tuned.html",
            ["--type", "css-var", "--target", "--undeclared-accent", "--label", "Accent"],
            check=False,
        )
        assert result.returncode != 0
        after = (Path(tmp) / "sketch-demo-tuned.html").read_text()
        assert before == after  # nothing appended


def test_tune_edit_rejects_new_target_not_declared_in_root():
    """`--edit` re-validates the (possibly new) --target the same way create/first-add does."""
    with tempfile.TemporaryDirectory() as tmp:
        (Path(tmp) / "sketch-demo.html").write_text(FIXTURE_SKETCH)
        run_tune(
            tmp, "sketch-demo.html",
            ["--type", "css-var", "--target", "--space-md", "--label", "Spacing", "--min", "4", "--max", "64"],
        )
        before = (Path(tmp) / "sketch-demo-tuned.html").read_text()
        result = run_tune(
            tmp, "sketch-demo-tuned.html",
            [
                "--edit", "--space-md", "--type", "css-var", "--target", "--undeclared-space",
                "--label", "Spacing", "--min", "4", "--max", "64",
            ],
            check=False,
        )
        assert result.returncode != 0
        assert "--undeclared-space" in result.stderr
        after = (Path(tmp) / "sketch-demo-tuned.html").read_text()
        assert before == after  # old control left in place, not swapped out


def test_tune_color_input_second_call_appends_to_existing_panel():
    """A color-input control appends into an already-forked panel like range/swatch controls do."""
    with tempfile.TemporaryDirectory() as tmp:
        (Path(tmp) / "sketch-demo.html").write_text(FIXTURE_SKETCH)
        run_tune(
            tmp, "sketch-demo.html",
            ["--type", "css-var", "--target", "--space-md", "--label", "Spacing", "--min", "4", "--max", "64"],
        )
        run_tune(
            tmp, "sketch-demo-tuned.html",
            ["--type", "css-var", "--target", "--accent-color", "--label", "Accent"],
        )
        out = (Path(tmp) / "sketch-demo-tuned.html").read_text()
        assert out.count("<!-- design-sketch:tuner-panel -->") == 1
        assert out.count("<details") == 1
        assert 'data-target="--space-md"' in out
        assert 'data-target="--accent-color"' in out
        assert 'type="color"' in out


def test_tune_edit_color_input_replaces_value_in_place():
    """`--edit <target>` replaces a color-input control's definition, preserving other controls."""
    with tempfile.TemporaryDirectory() as tmp:
        make_two_control_tuned_file(tmp)  # --space-md (Spacing), body (Layout)
        run_tune(
            tmp, "sketch-demo-tuned.html",
            ["--type", "css-var", "--target", "--accent-color", "--label", "Accent", "--value", "#111111"],
        )
        run_tune(
            tmp, "sketch-demo-tuned.html",
            [
                "--edit", "--accent-color", "--type", "css-var", "--target", "--accent-color",
                "--label", "Accent", "--value", "#222222",
            ],
        )
        out = (Path(tmp) / "sketch-demo-tuned.html").read_text()
        assert out.count("<label>") == 3
        assert 'value="#222222"' in out
        assert 'value="#111111"' not in out
        assert 'data-target="body"' in out  # untouched control survives


def test_tune_remove_color_input_control():
    """`--remove <target>` deletes a color-input control like it does range/swatch controls."""
    with tempfile.TemporaryDirectory() as tmp:
        make_two_control_tuned_file(tmp)
        run_tune(
            tmp, "sketch-demo-tuned.html",
            ["--type", "css-var", "--target", "--accent-color", "--label", "Accent"],
        )
        run_tune(tmp, "sketch-demo-tuned.html", ["--remove", "--accent-color"])
        out = (Path(tmp) / "sketch-demo-tuned.html").read_text()
        assert 'data-target="--accent-color"' not in out
        assert 'data-target="--space-md"' in out
        assert 'data-target="body"' in out


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


def make_two_control_tuned_file(tmp):
    """Sets up sketch-demo-tuned.html with a Spacing (css-var) and a Layout (class-toggle) control."""
    (Path(tmp) / "sketch-demo.html").write_text(FIXTURE_SKETCH)
    run_tune(
        tmp, "sketch-demo.html",
        ["--type", "css-var", "--target", "--space-md", "--label", "Spacing", "--min", "4", "--max", "64"],
    )
    run_tune(
        tmp, "sketch-demo-tuned.html",
        ["--type", "class-toggle", "--target", "body", "--label", "Layout", "--options", "compact,spacious"],
    )


def test_tune_remove_deletes_one_of_several_controls():
    """`--remove <target>` deletes just the matching control, leaving the others and the panel."""
    with tempfile.TemporaryDirectory() as tmp:
        make_two_control_tuned_file(tmp)
        run_tune(tmp, "sketch-demo-tuned.html", ["--remove", "body"])
        out = (Path(tmp) / "sketch-demo-tuned.html").read_text()
        assert "<!-- design-sketch:tuner-panel -->" in out
        assert out.count("<label>") == 1
        assert 'data-target="--space-md"' in out
        assert 'data-target="body"' not in out


def test_tune_remove_last_control_drops_entire_panel():
    """`--remove` on a panel's only remaining control drops the whole marker-wrapped panel block."""
    with tempfile.TemporaryDirectory() as tmp:
        (Path(tmp) / "sketch-demo.html").write_text(FIXTURE_SKETCH)
        run_tune(
            tmp, "sketch-demo.html",
            ["--type", "css-var", "--target", "--space-md", "--label", "Spacing", "--min", "4", "--max", "64"],
        )
        run_tune(tmp, "sketch-demo-tuned.html", ["--remove", "--space-md"])
        out = (Path(tmp) / "sketch-demo-tuned.html").read_text()
        assert "design-sketch:tuner-panel" not in out
        assert "tuner-panel" not in out
        assert "function applyCssVar" not in out


def test_tune_remove_unknown_target_errors():
    """`--remove` against a target with no matching control fails clearly."""
    with tempfile.TemporaryDirectory() as tmp:
        make_two_control_tuned_file(tmp)
        result = run_tune(tmp, "sketch-demo-tuned.html", ["--remove", "--nonexistent"], check=False)
        assert result.returncode != 0
        assert "--nonexistent" in result.stderr


def test_tune_remove_on_file_with_no_panel_errors():
    """`--remove` against a file that never had a tuner panel fails clearly."""
    with tempfile.TemporaryDirectory() as tmp:
        (Path(tmp) / "sketch-demo.html").write_text(FIXTURE_SKETCH)
        result = run_tune(tmp, "sketch-demo.html", ["--remove", "--space-md"], check=False)
        assert result.returncode != 0
        assert "no tuner panel" in result.stderr


def test_tune_edit_on_file_with_no_panel_errors():
    """`--edit` against a file that never had a tuner panel fails clearly."""
    with tempfile.TemporaryDirectory() as tmp:
        (Path(tmp) / "sketch-demo.html").write_text(FIXTURE_SKETCH)
        result = run_tune(
            tmp, "sketch-demo.html",
            ["--edit", "--space-md", "--type", "css-var", "--target", "--space-md", "--label", "Spacing", "--min", "0", "--max", "1"],
            check=False,
        )
        assert result.returncode != 0
        assert "no tuner panel" in result.stderr


def test_tune_edit_replaces_value_in_place():
    """`--edit <target>` replaces that control's definition, preserving the other control."""
    with tempfile.TemporaryDirectory() as tmp:
        make_two_control_tuned_file(tmp)
        run_tune(
            tmp, "sketch-demo-tuned.html",
            [
                "--edit", "--space-md", "--type", "css-var", "--target", "--space-md",
                "--label", "Spacing", "--min", "8", "--max", "128",
            ],
        )
        out = (Path(tmp) / "sketch-demo-tuned.html").read_text()
        assert out.count("<label>") == 2  # still two controls
        assert 'min="8"' in out and 'max="128"' in out
        assert 'min="4"' not in out  # old range is gone, not left behind
        assert 'data-target="body"' in out  # untouched control survives


def test_tune_edit_preserves_position_among_three_controls():
    """Editing the middle control of three keeps the original ordering — a 2-control fixture can't
    distinguish "edited in place" from "removed and re-appended at the end", so this uses three."""
    with tempfile.TemporaryDirectory() as tmp:
        make_two_control_tuned_file(tmp)  # gives --space-md (Spacing), body (Layout)
        run_tune(
            tmp, "sketch-demo-tuned.html",
            ["--type", "css-var", "--target", "--accent-color", "--label", "Accent", "--options", "#111,#222"],
        )  # now: Spacing, Layout, Accent

        run_tune(
            tmp, "sketch-demo-tuned.html",
            [
                "--edit", "body", "--type", "class-toggle", "--target", "body",
                "--label", "Layout", "--options", "compact,spacious,cozy",
            ],
        )

        out = (Path(tmp) / "sketch-demo-tuned.html").read_text()
        order = [out.index('data-target="--space-md"'), out.index('data-target="body"'), out.index('data-target="--accent-color"')]
        assert order == sorted(order)  # Spacing, then Layout, then Accent — unchanged order
        assert out.count("<option") == 3  # the edited select picked up the new third option


def test_tune_edit_can_change_the_target():
    """`--edit <old-target>` can rebind the control to a different --target."""
    with tempfile.TemporaryDirectory() as tmp:
        make_two_control_tuned_file(tmp)
        run_tune(
            tmp, "sketch-demo-tuned.html",
            [
                "--edit", "--space-md", "--type", "css-var", "--target", "--space-lg",
                "--label", "Spacing", "--min", "4", "--max", "64",
            ],
        )
        out = (Path(tmp) / "sketch-demo-tuned.html").read_text()
        assert 'data-target="--space-lg"' in out
        assert 'data-target="--space-md"' not in out


def test_tune_edit_unknown_target_errors():
    """`--edit` against a target with no matching control fails clearly."""
    with tempfile.TemporaryDirectory() as tmp:
        make_two_control_tuned_file(tmp)
        result = run_tune(
            tmp, "sketch-demo-tuned.html",
            ["--edit", "--nonexistent", "--type", "css-var", "--target", "--x", "--label", "X", "--min", "0", "--max", "1"],
            check=False,
        )
        assert result.returncode != 0
        assert "--nonexistent" in result.stderr


def test_tune_remove_and_edit_are_mutually_exclusive():
    """Passing both --remove and --edit fails rather than silently picking one."""
    with tempfile.TemporaryDirectory() as tmp:
        make_two_control_tuned_file(tmp)
        result = run_tune(
            tmp, "sketch-demo-tuned.html",
            ["--remove", "body", "--edit", "--space-md"],
            check=False,
        )
        assert result.returncode != 0


def test_tune_remove_rejects_control_definition_flags():
    """`--remove` combined with control-definition flags (e.g. --label) fails clearly."""
    with tempfile.TemporaryDirectory() as tmp:
        make_two_control_tuned_file(tmp)
        result = run_tune(
            tmp, "sketch-demo-tuned.html",
            ["--remove", "body", "--label", "Layout"],
            check=False,
        )
        assert result.returncode != 0


# -- bake subcommand ----------------------------------------------------------------------


BAKE_FIXTURE = """<!doctype html>
<html>
<head>
<meta charset="utf-8">
<style>
  :root {
    --space-md: 16px;
    --accent-color: #3366ff;
  }
  body { font-family: sans-serif; }
</style>
</head>
<body>
<main id="content">Hello</main>
</body>
</html>
"""


def run_bake(tmp, filename, args, check=True):
    """Runs `sketch-tool bake` against `tmp/filename` and returns the CompletedProcess."""
    result = subprocess.run(
        ["node", str(SKETCH_TOOL), "bake", str(Path(tmp) / filename), *args],
        capture_output=True,
        text=True,
    )
    if check:
        assert result.returncode == 0, result.stderr
    return result


def make_bake_ready_tuned_file(tmp):
    """Sets up sketch-demo-tuned.html with a Spacing (css-var, --space-md) and a Layout
    (class-toggle, body) control, against a :root that already declares --space-md so css-var
    override tests have something real to substitute into."""
    (Path(tmp) / "sketch-demo.html").write_text(BAKE_FIXTURE)
    run_tune(
        tmp, "sketch-demo.html",
        ["--type", "css-var", "--target", "--space-md", "--label", "Spacing", "--min", "4", "--max", "64"],
    )
    run_tune(
        tmp, "sketch-demo-tuned.html",
        ["--type", "class-toggle", "--target", "body", "--label", "Layout", "--options", "compact,spacious"],
    )


def test_bake_writes_reference_file_anchored_to_subject_not_chained_on_tuned():
    """`bake` writes `<subject>-reference.html`, not `<subject>-tuned-reference.html`."""
    with tempfile.TemporaryDirectory() as tmp:
        make_bake_ready_tuned_file(tmp)
        run_bake(tmp, "sketch-demo-tuned.html", [])
        assert (Path(tmp) / "sketch-demo-reference.html").exists()
        assert not (Path(tmp) / "sketch-demo-tuned-reference.html").exists()


def test_bake_does_not_overwrite_tuned_file():
    """The tuned file is left byte-for-byte untouched after baking."""
    with tempfile.TemporaryDirectory() as tmp:
        make_bake_ready_tuned_file(tmp)
        before = (Path(tmp) / "sketch-demo-tuned.html").read_text()
        run_bake(tmp, "sketch-demo-tuned.html", [])
        after = (Path(tmp) / "sketch-demo-tuned.html").read_text()
        assert before == after


def test_bake_css_var_override_substitutes_root_declaration():
    """A css-var entry in `--values` replaces the `:root` declaration with a static value."""
    with tempfile.TemporaryDirectory() as tmp:
        make_bake_ready_tuned_file(tmp)
        run_bake(tmp, "sketch-demo-tuned.html", ["--values", '{"--space-md": "40px"}'])
        out = (Path(tmp) / "sketch-demo-reference.html").read_text()
        assert "--space-md: 40px;" in out
        assert "--space-md: 16px;" not in out


def test_bake_class_toggle_override_hardcodes_class_on_target():
    """A class-toggle entry in `--values` hardcodes the class onto the target element, leaving the
    class-gated CSS rule (there isn't one in this fixture, but the selector's own markup) alone."""
    with tempfile.TemporaryDirectory() as tmp:
        make_bake_ready_tuned_file(tmp)
        run_bake(tmp, "sketch-demo-tuned.html", ["--values", '{"body": "spacious"}'])
        out = (Path(tmp) / "sketch-demo-reference.html").read_text()
        assert '<body class="spacious">' in out


def test_bake_color_input_control_leaves_root_declaration_untouched_without_override():
    """A color-input control with no `--values` override leaves :root's declared value as-is —
    same as a range/swatch css-var control (via `bakeCssVarControls`/`substituteRootProp`), which
    only ever substitutes on an explicit override."""
    with tempfile.TemporaryDirectory() as tmp:
        (Path(tmp) / "sketch-demo.html").write_text(BAKE_FIXTURE)  # declares --accent-color: #3366ff
        run_tune(
            tmp, "sketch-demo.html",
            ["--type", "css-var", "--target", "--accent-color", "--label", "Accent", "--value", "#e0403f"],
        )
        run_bake(tmp, "sketch-demo-tuned.html", [])
        out = (Path(tmp) / "sketch-demo-reference.html").read_text()
        assert "--accent-color: #3366ff;" in out
        assert "tuner-panel" not in out


def test_bake_color_input_override_substitutes_root_declaration():
    """A `--values` entry for a color-input control's target overrides its authored default."""
    with tempfile.TemporaryDirectory() as tmp:
        (Path(tmp) / "sketch-demo.html").write_text(BAKE_FIXTURE)
        run_tune(
            tmp, "sketch-demo.html",
            ["--type", "css-var", "--target", "--accent-color", "--label", "Accent", "--value", "#e0403f"],
        )
        run_bake(tmp, "sketch-demo-tuned.html", ["--values", '{"--accent-color": "#00ff00"}'])
        out = (Path(tmp) / "sketch-demo-reference.html").read_text()
        assert "--accent-color: #00ff00;" in out
        assert "--accent-color: #e0403f;" not in out


def test_bake_sparse_values_only_overrides_named_controls():
    """A `--values` map naming only one of two controls overrides that one and defaults the other."""
    with tempfile.TemporaryDirectory() as tmp:
        make_bake_ready_tuned_file(tmp)
        run_bake(tmp, "sketch-demo-tuned.html", ["--values", '{"--space-md": "40px"}'])
        out = (Path(tmp) / "sketch-demo-reference.html").read_text()
        assert "--space-md: 40px;" in out
        assert '<body class="compact">' in out  # first --options value, the select's default


def test_bake_no_values_flag_bakes_every_control_at_its_authored_default():
    """`bake <tuned-file>` with no `--values` flag at all is valid: every control bakes at its
    currently authored default."""
    with tempfile.TemporaryDirectory() as tmp:
        make_bake_ready_tuned_file(tmp)
        run_bake(tmp, "sketch-demo-tuned.html", [])
        out = (Path(tmp) / "sketch-demo-reference.html").read_text()
        assert "--space-md: 16px;" in out  # untouched authored default
        assert '<body class="compact">' in out  # select's default option


def test_bake_class_toggle_default_uses_selected_option_not_first():
    """A class-toggle control's default follows whichever `<option>` is marked `selected`, even
    when that isn't the first option — not baked's own separate notion of "default"."""
    with tempfile.TemporaryDirectory() as tmp:
        (Path(tmp) / "sketch-demo.html").write_text(BAKE_FIXTURE)
        run_tune(
            tmp, "sketch-demo.html",
            [
                "--type", "class-toggle", "--target", "body", "--label", "Layout",
                "--options", "compact,spacious", "--value", "spacious",
            ],
        )
        run_bake(tmp, "sketch-demo-tuned.html", [])
        out = (Path(tmp) / "sketch-demo-reference.html").read_text()
        assert '<body class="spacious">' in out


def test_bake_strips_tuner_panel_markup_style_and_script():
    """Output file has the tuner-panel block (markup, style, and script) entirely absent."""
    with tempfile.TemporaryDirectory() as tmp:
        make_bake_ready_tuned_file(tmp)
        run_bake(tmp, "sketch-demo-tuned.html", [])
        out = (Path(tmp) / "sketch-demo-reference.html").read_text()
        assert "design-sketch:tuner-panel" not in out
        assert "tuner-panel" not in out
        assert "function applyCssVar" not in out
        assert "<details" not in out


def test_bake_strips_id_overlay_markup_style_and_script():
    """Output file has the id-overlay block (markup, style, and script) entirely absent."""
    with tempfile.TemporaryDirectory() as tmp:
        (Path(tmp) / "sketch-demo.html").write_text(BAKE_FIXTURE)
        subprocess.run(
            ["node", str(SKETCH_TOOL), "create", str(Path(tmp) / "sketch-demo.html")],
            check=True, capture_output=True, text=True,
        )
        run_tune(
            tmp, "sketch-demo.html",
            ["--type", "css-var", "--target", "--space-md", "--label", "Spacing", "--min", "4", "--max", "64"],
        )
        run_bake(tmp, "sketch-demo-tuned.html", [])
        out = (Path(tmp) / "sketch-demo-reference.html").read_text()
        assert "design-sketch:id-overlay" not in out
        assert "id-badge" not in out


def test_bake_no_panel_or_overlay_still_produces_a_reference_file():
    """Baking a file that never got tuners or an overlay is valid — nothing to strip or substitute,
    a reference file still comes out anchored to the subject."""
    with tempfile.TemporaryDirectory() as tmp:
        (Path(tmp) / "sketch-demo.html").write_text(BAKE_FIXTURE)
        run_bake(tmp, "sketch-demo.html", [])
        out = (Path(tmp) / "sketch-demo-reference.html").read_text()
        assert "tuner-panel" not in out
        assert "id-overlay" not in out


def test_bake_class_toggle_radio_group_default_uses_checked_radio():
    """A hand-authored radio-group class-toggle control (references/tuner-conventions.md's
    select-or-radio option) bakes in whichever radio is marked `checked`."""
    radio_panel = (
        '<!-- design-sketch:tuner-panel -->\n'
        '<style>.tuner-panel{}</style>\n\n'
        '<details class="tuner-panel" id="tunerPanel" open>\n'
        '  <summary class="tuner-panel-header">Tuners</summary>\n'
        '  <div class="tuner-panel-body">\n\n'
        '  <label>\n'
        '    Layout\n'
        '    <span role="radiogroup" aria-label="Layout">\n'
        '      <input type="radio" name="layout" data-bind="class-toggle" data-target="body" value="compact">\n'
        '      <input type="radio" name="layout" data-bind="class-toggle" data-target="body" value="spacious" checked>\n'
        '    </span>\n'
        '  </label>\n\n'
        '  </div>\n'
        '</details>\n\n'
        '<script>(function () {})();</script>\n'
        '<!-- /design-sketch:tuner-panel -->\n'
    )
    html = BAKE_FIXTURE.replace("</body>", radio_panel + "</body>")
    with tempfile.TemporaryDirectory() as tmp:
        (Path(tmp) / "sketch-demo-tuned.html").write_text(html)
        run_bake(tmp, "sketch-demo-tuned.html", [])
        out = (Path(tmp) / "sketch-demo-reference.html").read_text()
        assert '<body class="spacious">' in out
        assert "tuner-panel" not in out


def test_bake_values_unknown_target_errors():
    """`--values` naming a target no control in the panel actually uses fails clearly, instead of
    silently doing nothing — bake is supposed to catch exactly this kind of typo."""
    with tempfile.TemporaryDirectory() as tmp:
        make_bake_ready_tuned_file(tmp)
        result = run_bake(tmp, "sketch-demo-tuned.html", ["--values", '{"--nonexistent": "1"}'], check=False)
        assert result.returncode != 0
        assert "--nonexistent" in result.stderr


def test_bake_css_var_override_of_undeclared_property_errors():
    """Overriding a css-var control whose custom property was never declared in `:root` fails
    clearly rather than silently writing nothing. `tune` itself now refuses to scaffold a control
    like this in the first place (test_tune_rejects_css_var_target_not_declared_in_root), so this
    hand-builds the panel to exercise bake's own independent, defense-in-depth check against a
    panel that got into this state some other way (hand-authored, or from an older tool version)."""
    panel = (
        '<!-- design-sketch:tuner-panel -->\n'
        '<style>.tuner-panel{}</style>\n\n'
        '<details class="tuner-panel" id="tunerPanel" open>\n'
        '  <summary class="tuner-panel-header">Tuners</summary>\n'
        '  <div class="tuner-panel-body">\n\n'
        '  <label>\n'
        '    Spacing\n'
        '    <input id="spacingRange" type="range" data-bind="css-var" data-target="--undeclared-space" min="4" max="64" value="16">\n'
        '  </label>\n\n'
        '  </div>\n'
        '</details>\n\n'
        '<script>(function () {})();</script>\n'
        '<!-- /design-sketch:tuner-panel -->\n'
    )
    html = FIXTURE_SKETCH.replace("</body>", panel + "</body>")  # --undeclared-space never in :root
    with tempfile.TemporaryDirectory() as tmp:
        (Path(tmp) / "sketch-demo-tuned.html").write_text(html)
        result = run_bake(
            tmp, "sketch-demo-tuned.html", ["--values", '{"--undeclared-space": "40px"}'], check=False
        )
        assert result.returncode != 0
        assert "--undeclared-space" in result.stderr


def test_tune_and_bake_agree_on_root_declaration_with_trailing_comment():
    """A :root declaration followed by a same-line comment (e.g. `--space-md: 16px; /* note */`)
    doesn't count as "declared" for tune's scaffold-time check or bake's substitution check — both
    now share `isCustomPropDeclaredInRoot`, so they can't disagree on this the way they used to
    (bake's own regex used to be looser than tune's and would have accepted this)."""
    fixture = FIXTURE_SKETCH.replace("--space-md: 16px;", "--space-md: 16px; /* trailing comment */")

    with tempfile.TemporaryDirectory() as tmp:
        (Path(tmp) / "sketch-demo.html").write_text(fixture)
        result = run_tune(
            tmp, "sketch-demo.html",
            ["--type", "css-var", "--target", "--space-md", "--label", "Spacing", "--min", "4", "--max", "64"],
            check=False,
        )
        assert result.returncode != 0
        assert "--space-md" in result.stderr

    panel = (
        '<!-- design-sketch:tuner-panel -->\n'
        '<style>.tuner-panel{}</style>\n\n'
        '<details class="tuner-panel" id="tunerPanel" open>\n'
        '  <summary class="tuner-panel-header">Tuners</summary>\n'
        '  <div class="tuner-panel-body">\n\n'
        '  <label>\n'
        '    Spacing\n'
        '    <input type="range" data-bind="css-var" data-target="--space-md" min="4" max="64" value="16">\n'
        '  </label>\n\n'
        '  </div>\n'
        '</details>\n\n'
        '<script>(function () {})();</script>\n'
        '<!-- /design-sketch:tuner-panel -->\n'
    )
    html = fixture.replace("</body>", panel + "</body>")
    with tempfile.TemporaryDirectory() as tmp:
        (Path(tmp) / "sketch-demo-tuned.html").write_text(html)
        result = run_bake(tmp, "sketch-demo-tuned.html", ["--values", '{"--space-md": "40px"}'], check=False)
        assert result.returncode != 0
        assert "--space-md" in result.stderr


def test_bake_missing_file_errors():
    """`bake` against a file that doesn't exist fails clearly."""
    with tempfile.TemporaryDirectory() as tmp:
        result = run_bake(tmp, "nope.html", [], check=False)
        assert result.returncode != 0
        assert "no such file" in result.stderr


def test_bake_invalid_values_json_errors():
    """`--values` that isn't valid JSON fails clearly instead of throwing an obscure parse error."""
    with tempfile.TemporaryDirectory() as tmp:
        make_bake_ready_tuned_file(tmp)
        result = run_bake(tmp, "sketch-demo-tuned.html", ["--values", "{not json"], check=False)
        assert result.returncode != 0
        assert "--values" in result.stderr


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
