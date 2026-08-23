#!/usr/bin/env node
'use strict';

/*
 * Generation-time CLI that mechanizes the boilerplate-injection steps of the design-sketch
 * skill (docs/adr/0007). Never a runtime dependency of the sketches it produces — see ADR-0001.
 */

const fs = require('fs');
const path = require('path');

const TEMPLATES_DIR = path.join(__dirname, '..', 'templates');

const ID_OVERLAY_START = '<!-- design-sketch:id-overlay -->';
const ID_OVERLAY_END = '<!-- /design-sketch:id-overlay -->';

const TUNER_PANEL_START = '<!-- design-sketch:tuner-panel -->';
const TUNER_PANEL_END = '<!-- /design-sketch:tuner-panel -->';

function usage() {
  return [
    'Usage: sketch-tool <subcommand> [options]',
    '',
    'Subcommands:',
    '  create <file> [--type wireframe|styled] [--no-overlay]',
    '      Inject the id-overlay block (default on) and, for --type wireframe, merge',
    '      wireframe-tokens.css custom properties into the file\'s :root.',
    '',
    '  tune <file> --type css-var|class-toggle --target <name-or-selector> --label <text>',
    '       [--options a,b,c] [--min N --max N] [--value V] [--unit STR] [--readout] [--prefix STR]',
    '      Against an exploration sketch (no tuner panel yet): forks to <subject>-tuned.html and',
    '      injects a tuner panel skeleton with this one control. Against a file that already',
    '      carries a panel: appends this control to it in place. --type css-var takes either',
    '      --min/--max (continuous, range input) or --options (swatch buttons). --type class-toggle',
    '      takes --options (variant names for a <select>) and interprets --target as a CSS selector.',
    '',
    '  tune <file> --remove <target>',
    '      Deletes the control bound to <target> from an existing panel. Drops the whole panel',
    '      block if it was the only control.',
    '',
    '  tune <file> --edit <old-target> --type ... --target ... --label ... [...]',
    '      Replaces the control bound to <old-target> with a freshly built one from the given',
    '      flags (same flags as creating a control) — a wholesale swap, not a partial patch.',
    '',
    '  bake <tuned-file> [--values \'<json>\']',
    '      Forks to <subject>-reference.html (anchored to the original subject, never chained onto',
    '      "-tuned"). --values is a sparse override map keyed by each control\'s data-target: css-var',
    '      entries substitute a static value into :root; class-toggle entries hardcode a class onto',
    '      the target element. Any control left out of --values bakes in at its authored default —',
    '      a css-var\'s current :root value, or a class-toggle\'s selected option / checked radio.',
    '      Deletes the tuner-panel and id-overlay blocks (markup, style, and script) entirely.',
  ].join('\n');
}

// -- shared text-block primitives (docs/adr/0007: "find a block by its boundary markers,
// insert/delete/substitute, write out") --------------------------------------------------

// Given `text` and the index of a '{' character, returns the index of its matching '}'.
function matchingBrace(text, openIndex) {
  let depth = 0;
  for (let i = openIndex; i < text.length; i++) {
    if (text[i] === '{') depth++;
    else if (text[i] === '}') {
      depth--;
      if (depth === 0) return i;
    }
  }
  return -1;
}

// Locates the first `:root { ... }` block in `text`. Returns null if none exists.
function findRootBlock(text) {
  const m = /:root\s*\{/i.exec(text);
  if (!m) return null;
  const openBrace = m.index + m[0].length - 1;
  const closeBrace = matchingBrace(text, openBrace);
  if (closeBrace === -1) return null;
  return {
    matchStart: m.index,
    openBrace,
    closeBrace,
    inner: text.slice(openBrace + 1, closeBrace),
  };
}

// Extracts `--name: value;` custom property declarations from a :root block's inner text.
function parseCustomProps(innerText) {
  const props = [];
  const re = /^[ \t]*(--[A-Za-z0-9-]+)\s*:\s*[^;]+;[ \t]*$/gm;
  let m;
  while ((m = re.exec(innerText)) !== null) {
    props.push({ name: m[1], line: m[0].trim() });
  }
  return props;
}

// -- id-overlay injection ------------------------------------------------------------------

function injectIdOverlay(content) {
  if (content.includes(ID_OVERLAY_START)) return content; // already injected

  const bodyClose = /<\/body>/i.exec(content);
  if (!bodyClose) {
    throw new Error('no </body> tag found to inject id-overlay into');
  }

  const templatePath = path.join(TEMPLATES_DIR, 'id-overlay.html');
  const template = fs.readFileSync(templatePath, 'utf8').trim();
  const block = `${ID_OVERLAY_START}\n${template}\n${ID_OVERLAY_END}\n`;

  return content.slice(0, bodyClose.index) + block + content.slice(bodyClose.index);
}

// -- wireframe token injection ------------------------------------------------------------

function insertRootBlock(content, rootBlockText) {
  const styleOpen = /<style[^>]*>/i.exec(content);
  if (styleOpen) {
    const insertAt = styleOpen.index + styleOpen[0].length;
    return content.slice(0, insertAt) + '\n' + rootBlockText + '\n' + content.slice(insertAt);
  }

  const headClose = /<\/head>/i.exec(content);
  if (headClose) {
    const block = `<style>\n${rootBlockText}\n</style>\n`;
    return content.slice(0, headClose.index) + block + content.slice(headClose.index);
  }

  throw new Error('no <style> tag or </head> found to inject wireframe tokens into');
}

function mergeWireframeTokens(content) {
  const wfCssPath = path.join(TEMPLATES_DIR, 'wireframe-tokens.css');
  const wfCss = fs.readFileSync(wfCssPath, 'utf8');
  const wfRoot = findRootBlock(wfCss);
  if (!wfRoot) {
    throw new Error(`no :root block found in ${wfCssPath}`);
  }

  const targetRoot = findRootBlock(content);

  if (!targetRoot) {
    // No :root at all yet in the target file — bring the whole wireframe :root over verbatim.
    const rootBlockText = `:root {${wfRoot.inner}}`;
    return insertRootBlock(content, rootBlockText);
  }

  const wfProps = parseCustomProps(wfRoot.inner);
  const existingNames = new Set(parseCustomProps(targetRoot.inner).map((p) => p.name));
  const missing = wfProps.filter((p) => !existingNames.has(p.name));

  if (missing.length === 0) return content; // already merged, nothing to do

  const insertion =
    '\n  /* wireframe tokens (design-sketch) */\n' +
    missing.map((p) => '  ' + p.line).join('\n') +
    '\n';

  const before = content.slice(0, targetRoot.closeBrace).replace(/[ \t]+$/, '');
  return before + insertion + content.slice(targetRoot.closeBrace);
}

// -- tuner-panel injection ---------------------------------------------------------------

function escapeAttr(s) {
  return String(s).replace(/&/g, '&amp;').replace(/"/g, '&quot;').replace(/</g, '&lt;').replace(/>/g, '&gt;');
}

function escapeRegExp(s) {
  return String(s).replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
}

function escapeText(s) {
  return String(s).replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;');
}

function capitalize(s) {
  return s.length ? s[0].toUpperCase() + s.slice(1) : s;
}

// Turns a human label like "Spacing" into a camelCase id fragment ("spacing"), matching the
// convention templates/tuner-panel.html's own examples use (id="spacingRange" for label "Spacing").
function labelToId(label) {
  const words = label.trim().split(/[^A-Za-z0-9]+/).filter(Boolean);
  if (words.length === 0) return 'control';
  return words.map((w, i) => (i === 0 ? w.toLowerCase() : capitalize(w.toLowerCase()))).join('');
}

// Appends a numeric suffix until `id="<base>"` doesn't collide with an id already in `content`.
function uniqueId(base, content) {
  if (!content.includes(`id="${base}"`)) return base;
  let n = 2;
  while (content.includes(`id="${base}${n}"`)) n++;
  return `${base}${n}`;
}

function splitOptions(raw) {
  const values = raw.split(',').map((s) => s.trim()).filter(Boolean);
  if (values.length === 0) throw new Error('--options must include at least one non-empty value');
  return values;
}

function buildContinuousControl(opts, existingContent) {
  const inputId = uniqueId(labelToId(opts.label) + 'Range', existingContent);
  const value = opts.value !== null ? opts.value : opts.min;
  const unitAttr = opts.unit ? ` data-unit="${escapeAttr(opts.unit)}"` : '';

  let readoutAttr = '';
  let outputEl = '';
  if (opts.readout) {
    const outId = uniqueId(labelToId(opts.label) + 'Out', existingContent);
    readoutAttr = ` data-readout="${outId}"`;
    outputEl = `\n    <output id="${outId}" for="${inputId}">${escapeText(value + (opts.unit || 'px'))}</output>`;
  }

  return (
    `  <label>\n` +
    `    ${escapeText(opts.label)}\n` +
    `    <input id="${inputId}" type="range" data-bind="css-var" data-target="${escapeAttr(opts.target)}"` +
    `${readoutAttr} min="${escapeAttr(opts.min)}" max="${escapeAttr(opts.max)}" value="${escapeAttr(value)}"${unitAttr}>` +
    `${outputEl}\n` +
    `  </label>`
  );
}

function buildSwatchControl(opts) {
  const values = splitOptions(opts.options);
  const buttons = values
    .map(
      (v) =>
        `      <button type="button" value="${escapeAttr(v)}" data-bind="css-var" data-target="${escapeAttr(opts.target)}" style="background:${escapeAttr(v)}" aria-label="${escapeAttr(v)}"></button>`
    )
    .join('\n');

  return (
    `  <label>\n` +
    `    ${escapeText(opts.label)}\n` +
    `    <span class="swatch-row" role="group" aria-label="${escapeAttr(opts.label)}">\n${buttons}\n    </span>\n` +
    `  </label>`
  );
}

function buildClassToggleControl(opts) {
  const values = splitOptions(opts.options);
  const selectedValue = opts.value !== null ? opts.value : values[0];
  if (!values.includes(selectedValue)) {
    throw new Error(`--value "${selectedValue}" must be one of --options: ${values.join(', ')}`);
  }

  const optionsHtml = values
    .map(
      (v) =>
        `      <option value="${escapeAttr(v)}"${v === selectedValue ? ' selected' : ''}>${escapeText(capitalize(v))}</option>`
    )
    .join('\n');
  const prefixAttr = opts.prefix ? ` data-prefix="${escapeAttr(opts.prefix)}"` : '';

  return (
    `  <label>\n` +
    `    ${escapeText(opts.label)}\n` +
    `    <select data-bind="class-toggle" data-target="${escapeAttr(opts.target)}"${prefixAttr}>\n${optionsHtml}\n    </select>\n` +
    `  </label>`
  );
}

function buildControlMarkup(opts, existingContent) {
  if (opts.type === 'class-toggle') return buildClassToggleControl(opts);
  return opts.options ? buildSwatchControl(opts) : buildContinuousControl(opts, existingContent);
}

// Pulls the generic .tuner-panel <style> and listener <script> straight out of the template —
// these never vary per control, only the panel body's contents do.
function loadPanelChrome() {
  const templatePath = path.join(TEMPLATES_DIR, 'tuner-panel.html');
  const template = fs.readFileSync(templatePath, 'utf8');
  const styleMatch = /<style>[\s\S]*?<\/style>/.exec(template);
  const scriptMatch = /<script>[\s\S]*?<\/script>/.exec(template);
  if (!styleMatch || !scriptMatch) {
    throw new Error(`could not locate <style>/<script> blocks in ${templatePath}`);
  }
  return { style: styleMatch[0], script: scriptMatch[0] };
}

function buildPanelBlock(controlHtml) {
  const { style, script } = loadPanelChrome();
  const details =
    `<details class="tuner-panel" id="tunerPanel" open>\n  <summary class="tuner-panel-header">Tuners</summary>\n` +
    `  <div class="tuner-panel-body">\n\n${controlHtml}\n\n  </div>\n</details>`;
  return `${TUNER_PANEL_START}\n${style}\n\n${details}\n\n${script}\n${TUNER_PANEL_END}\n`;
}

function injectTunerPanel(content, controlHtml) {
  const bodyClose = /<\/body>/i.exec(content);
  if (!bodyClose) {
    throw new Error('no </body> tag found to inject tuner panel into');
  }
  const block = buildPanelBlock(controlHtml);
  return content.slice(0, bodyClose.index) + block + content.slice(bodyClose.index);
}

function locatePanelBody(content) {
  const startIdx = content.indexOf(TUNER_PANEL_START);
  const endIdx = content.indexOf(TUNER_PANEL_END);
  if (startIdx === -1 || endIdx === -1) {
    throw new Error('no tuner panel found in this file');
  }

  const panelSection = content.slice(startIdx, endIdx);
  const bodyOpen = /<div class="tuner-panel-body">/.exec(panelSection);
  const bodyCloseIdx = panelSection.indexOf('</div>');
  if (!bodyOpen || bodyCloseIdx === -1) {
    throw new Error('no <div class="tuner-panel-body"> found inside the existing tuner panel block');
  }

  return {
    startIdx,
    endIdx,
    bodyAbsStart: startIdx + bodyOpen.index,
    bodyCloseAbsStart: startIdx + bodyCloseIdx, // where '</div>' itself begins
    bodyAbsEnd: startIdx + bodyCloseIdx + '</div>'.length,
    bodyInner: panelSection.slice(bodyOpen.index + bodyOpen[0].length, bodyCloseIdx),
  };
}

function appendControlToPanel(content, controlHtml) {
  const loc = locatePanelBody(content);
  return content.slice(0, loc.bodyCloseAbsStart) + controlHtml + '\n' + content.slice(loc.bodyCloseAbsStart);
}

// Finds each top-level <label>...</label> block within the panel body's inner HTML. Tuner
// controls never nest labels (references/tuner-conventions.md: one <label> per control), so a
// non-greedy match per block is sufficient.
function findLabelBlocks(bodyInner) {
  const blocks = [];
  const re = /<label>[\s\S]*?<\/label>/g;
  let m;
  while ((m = re.exec(bodyInner)) !== null) {
    blocks.push({ start: m.index, end: m.index + m[0].length, text: m[0] });
  }
  return blocks;
}

function findControlIndexByTarget(blocks, target) {
  return blocks.findIndex((b) => b.text.includes(`data-target="${target}"`));
}

// Rebuilds the panel's <div class="tuner-panel-body"> from a fresh list of control blocks. An
// empty list drops the entire marker-wrapped panel block (style, details, script) — an empty
// panel isn't a valid state per references/tuner-conventions.md's "always one <details>" rule.
function spliceBody(content, loc, controlTexts) {
  if (controlTexts.length === 0) {
    return content.slice(0, loc.startIdx) + content.slice(loc.endIdx + TUNER_PANEL_END.length);
  }
  const newBody = `<div class="tuner-panel-body">\n\n${controlTexts.join('\n\n')}\n\n  </div>`;
  return content.slice(0, loc.bodyAbsStart) + newBody + content.slice(loc.bodyAbsEnd);
}

function removeControlFromPanel(content, target) {
  const loc = locatePanelBody(content);
  const blocks = findLabelBlocks(loc.bodyInner);
  const idx = findControlIndexByTarget(blocks, target);
  if (idx === -1) {
    throw new Error(`no control targeting "${target}" found in the existing tuner panel`);
  }
  const texts = blocks.map((b) => b.text).filter((_, i) => i !== idx);
  return spliceBody(content, loc, texts);
}

// Replaces the control bound to opts.edit with a freshly built one from opts (a wholesale swap,
// not a merge of old/new attributes — see .scratch/design-sketch-tooling/issues/06). Builds the
// replacement against the panel with the old control already removed, so reusing the same --label
// doesn't trip the new control's own id-collision check against itself.
function editControlInPanel(content, opts) {
  const loc = locatePanelBody(content);
  const blocks = findLabelBlocks(loc.bodyInner);
  const idx = findControlIndexByTarget(blocks, opts.edit);
  if (idx === -1) {
    throw new Error(`no control targeting "${opts.edit}" found in the existing tuner panel`);
  }

  const texts = blocks.map((b) => b.text);
  const contentWithoutOld = spliceBody(content, loc, texts.filter((_, i) => i !== idx));
  const controlHtml = buildControlMarkup(opts, contentWithoutOld);
  texts[idx] = controlHtml;
  return spliceBody(content, loc, texts);
}

// `sketch-foo.html` -> `sketch-foo-tuned.html`; already-tuned names pass through unchanged so a
// stray fork call against a tuned file (that happens to have no panel) doesn't chain -tuned-tuned.
function deriveTunedPath(filePath) {
  const dir = path.dirname(filePath);
  const ext = path.extname(filePath);
  const base = path.basename(filePath, ext);
  const tunedBase = base.endsWith('-tuned') ? base : `${base}-tuned`;
  return path.join(dir, `${tunedBase}${ext}`);
}

// `sketch-foo-tuned.html` -> `sketch-foo-reference.html` — anchored to the original subject, never
// chained onto the tuned filename (`-tuned-reference` reads worse and gets longer every bake).
function deriveReferencePath(filePath) {
  const dir = path.dirname(filePath);
  const ext = path.extname(filePath);
  const base = path.basename(filePath, ext);
  const subject = base.endsWith('-tuned') ? base.slice(0, -'-tuned'.length) : base;
  return path.join(dir, `${subject}-reference${ext}`);
}

// A reference sketch is a frozen handoff artifact (docs/adr/0002, docs/adr/0006) — `create` writes
// in place, so running it against one would silently resurrect dev-only blocks bake already
// stripped. `tune`/`bake` already fork rather than mutate, so they don't need this check.
function isReferenceFile(filePath) {
  const ext = path.extname(filePath);
  const base = path.basename(filePath, ext);
  return base.endsWith('-reference');
}

// -- bake: substitute tuner values, then strip both dev-only blocks entirely ------------

// Deletes a marker-wrapped block (start marker through end marker, inclusive). A no-op if the
// start marker isn't present — bake is valid against a file that never had this block.
function stripBlock(content, startMarker, endMarker) {
  const startIdx = content.indexOf(startMarker);
  if (startIdx === -1) return content;
  const endIdx = content.indexOf(endMarker);
  if (endIdx === -1) throw new Error(`found ${startMarker} without a matching ${endMarker}`);
  return content.slice(0, startIdx) + content.slice(endIdx + endMarker.length);
}

function extractAttr(tagText, attrName) {
  const m = new RegExp(attrName + '="([^"]*)"').exec(tagText);
  return m ? m[1] : null;
}

// Finds the first tag inside a control's <label> block that carries data-bind — the element whose
// data-target/data-bind/data-prefix define the control (a swatch row has several buttons bound to
// the same target, so "first" is sufficient; they agree by construction).
function findBoundTag(labelText) {
  const m = /<[a-zA-Z][^>]*\bdata-bind="(css-var|class-toggle)"[^>]*>/.exec(labelText);
  return m ? m[0] : null;
}

// Reads a class-toggle control's currently-authored default straight from its markup: the
// selected <option> (or its first option, absent an explicit `selected`), the checked radio in a
// group, or a checkbox's checked state. Returns null only for an unchecked checkbox — "no class"
// is itself a valid authored default there.
function classToggleDefault(labelText, target) {
  if (/<select\b/.test(labelText)) {
    let firstValue = null;
    const optRe = /<option\b[^>]*>/g;
    let m;
    while ((m = optRe.exec(labelText)) !== null) {
      const value = extractAttr(m[0], 'value');
      if (firstValue === null) firstValue = value;
      if (/\bselected\b/.test(m[0])) return value;
    }
    if (firstValue === null) {
      throw new Error(`class-toggle control targeting "${target}" has a <select> with no <option>`);
    }
    return firstValue;
  }

  if (/\btype="radio"/.test(labelText)) {
    const radioRe = /<input\b[^>]*\btype="radio"[^>]*>/g;
    let m;
    while ((m = radioRe.exec(labelText)) !== null) {
      if (/\bchecked\b/.test(m[0])) return extractAttr(m[0], 'value');
    }
    throw new Error(
      `class-toggle control targeting "${target}" is a radio group with none marked "checked"`
    );
  }

  const checkboxMatch = /<input\b[^>]*\btype="checkbox"[^>]*>/.exec(labelText);
  if (checkboxMatch) {
    if (!/\bchecked\b/.test(checkboxMatch[0])) return null;
    return extractAttr(checkboxMatch[0], 'value') || '';
  }

  throw new Error(
    `class-toggle control targeting "${target}" has no recognized markup (expected <select>, a radio group, or a checkbox)`
  );
}

// Reads every control out of an existing tuner panel. Returns [] if the file never had one — bake
// against a file with no panel is valid (nothing to substitute, blocks are still stripped).
function parsePanelControls(content) {
  if (!content.includes(TUNER_PANEL_START)) return [];

  const loc = locatePanelBody(content);
  const blocks = findLabelBlocks(loc.bodyInner);

  return blocks.map((block) => {
    const boundTag = findBoundTag(block.text);
    if (!boundTag) throw new Error('a tuner control has no element carrying data-bind — malformed panel markup');

    const bind = extractAttr(boundTag, 'data-bind');
    const target = extractAttr(boundTag, 'data-target');
    if (!target) throw new Error('a tuner control is missing data-target — malformed panel markup');

    const control = { bind, target };
    if (bind === 'class-toggle') {
      control.prefix = extractAttr(boundTag, 'data-prefix') || '';
      control.defaultValue = classToggleDefault(block.text, target);
    }
    return control;
  });
}

// Substitutes a css-var control's `:root` declaration with a plain static value.
function substituteRootProp(content, propName, rawValue) {
  const root = findRootBlock(content);
  if (!root) throw new Error(`no :root block found to bake "${propName}" into`);

  const declRe = new RegExp('([ \\t]*' + escapeRegExp(propName) + '\\s*:\\s*)[^;]+(;)');
  if (!declRe.test(root.inner)) {
    throw new Error(`custom property "${propName}" is not declared in :root — nothing to bake it into`);
  }
  const newInner = root.inner.replace(declRe, `$1${rawValue}$2`);
  return content.slice(0, root.openBrace + 1) + newInner + content.slice(root.closeBrace);
}

// Finds the opening tag of the element a class-toggle control's `data-target` selector names.
// Bake only needs to resolve the simple selector shapes the conventions doc actually recommends
// (references/tuner-conventions.md: "often body, or an id/class the sketch already has").
function locateOpeningTag(content, selector) {
  let re;
  if (selector === 'body') {
    re = /<body\b[^>]*>/i;
  } else if (selector.startsWith('#')) {
    re = new RegExp('<[a-zA-Z][^>]*\\bid="' + escapeRegExp(selector.slice(1)) + '"[^>]*>');
  } else if (selector.startsWith('.')) {
    re = new RegExp('<[a-zA-Z][^>]*\\bclass="[^"]*\\b' + escapeRegExp(selector.slice(1)) + '\\b[^"]*"[^>]*>');
  } else if (/^[a-zA-Z][a-zA-Z0-9]*$/.test(selector)) {
    re = new RegExp('<' + selector + '\\b[^>]*>', 'i');
  } else {
    throw new Error(
      `bake only supports simple class-toggle selectors (a tag name, #id, or .class) — got "${selector}"`
    );
  }

  const m = re.exec(content);
  if (!m) throw new Error(`no element matching selector "${selector}" found to bake a class onto`);
  return { start: m.index, end: m.index + m[0].length, text: m[0] };
}

function addClassToTag(tagText, className) {
  const classAttrRe = /\sclass="([^"]*)"/;
  const m = classAttrRe.exec(tagText);
  if (m) {
    const existing = m[1].split(/\s+/).filter(Boolean);
    if (existing.includes(className)) return tagText;
    const updated = existing.concat(className).join(' ');
    return tagText.slice(0, m.index) + ` class="${updated}"` + tagText.slice(m.index + m[0].length);
  }

  const tagNameMatch = /^<[a-zA-Z0-9]+/.exec(tagText);
  const insertAt = tagNameMatch[0].length;
  return tagText.slice(0, insertAt) + ` class="${className}"` + tagText.slice(insertAt);
}

function bakeCssVarControls(content, controls, values) {
  controls
    .filter((c) => c.bind === 'css-var')
    .forEach((c) => {
      if (Object.prototype.hasOwnProperty.call(values, c.target)) {
        content = substituteRootProp(content, c.target, values[c.target]);
      }
      // else: already the authored default sitting in :root, nothing to change.
    });
  return content;
}

function bakeClassToggleControls(content, controls, values) {
  controls
    .filter((c) => c.bind === 'class-toggle')
    .forEach((c) => {
      const rawValue = Object.prototype.hasOwnProperty.call(values, c.target) ? values[c.target] : c.defaultValue;
      if (rawValue === null || rawValue === undefined) return; // unchecked checkbox: no class to bake

      const className = c.prefix + String(rawValue);
      const tagLoc = locateOpeningTag(content, c.target);
      const newTag = addClassToTag(tagLoc.text, className);
      content = content.slice(0, tagLoc.start) + newTag + content.slice(tagLoc.end);
    });
  return content;
}

// -- arg parsing -----------------------------------------------------------------------

function parseCreateArgs(args) {
  const opts = { file: null, type: 'styled', noOverlay: false };
  for (let i = 0; i < args.length; i++) {
    const arg = args[i];
    if (arg === '--no-overlay') {
      opts.noOverlay = true;
    } else if (arg === '--type') {
      opts.type = args[++i];
    } else if (arg.startsWith('--type=')) {
      opts.type = arg.slice('--type='.length);
    } else if (arg.startsWith('--')) {
      throw new Error(`unknown option: ${arg}`);
    } else if (opts.file === null) {
      opts.file = arg;
    } else {
      throw new Error(`unexpected argument: ${arg}`);
    }
  }

  if (!opts.file) throw new Error('missing required <file> argument');
  if (opts.type !== 'wireframe' && opts.type !== 'styled') {
    throw new Error(`--type must be "wireframe" or "styled", got "${opts.type}"`);
  }

  return opts;
}

const TUNE_VALUE_FLAGS = {
  '--type': 'type',
  '--target': 'target',
  '--label': 'label',
  '--options': 'options',
  '--min': 'min',
  '--max': 'max',
  '--value': 'value',
  '--unit': 'unit',
  '--prefix': 'prefix',
  '--remove': 'remove',
  '--edit': 'edit',
};

function parseTuneArgs(args) {
  const opts = {
    file: null,
    type: null,
    target: null,
    label: null,
    options: null,
    min: null,
    max: null,
    value: null,
    unit: null,
    readout: false,
    prefix: null,
    remove: null,
    edit: null,
  };

  for (let i = 0; i < args.length; i++) {
    const arg = args[i];
    if (arg === '--readout') {
      opts.readout = true;
      continue;
    }
    const eq = arg.indexOf('=');
    const flag = eq === -1 ? arg : arg.slice(0, eq);
    const key = TUNE_VALUE_FLAGS[flag];
    if (key) {
      opts[key] = eq === -1 ? args[++i] : arg.slice(eq + 1);
      continue;
    }
    if (arg.startsWith('--')) throw new Error(`unknown option: ${arg}`);
    if (opts.file === null) {
      opts.file = arg;
      continue;
    }
    throw new Error(`unexpected argument: ${arg}`);
  }

  validateTuneOpts(opts);
  return opts;
}

// Every value-flag key except the two mode selectors (remove/edit identify a control, they don't
// define one) — derived from TUNE_VALUE_FLAGS so a new flag added there can't drift out of sync.
const CONTROL_DEFINITION_FLAGS = Object.values(TUNE_VALUE_FLAGS).filter((k) => k !== 'remove' && k !== 'edit');

function validateTuneOpts(opts) {
  if (!opts.file) throw new Error('missing required <file> argument');

  if (opts.remove !== null && opts.edit !== null) {
    throw new Error('--remove and --edit are mutually exclusive');
  }

  if (opts.remove !== null) {
    const hasOther = opts.readout || CONTROL_DEFINITION_FLAGS.some((k) => opts[k] !== null);
    if (hasOther) {
      throw new Error('--remove takes no other flags besides <file> and --remove <target>');
    }
    return;
  }

  // --edit and plain add-mode both define a control with the same flags; --edit additionally
  // needs the old target (opts.edit) identifying which control to replace.
  if (opts.type !== 'css-var' && opts.type !== 'class-toggle') {
    throw new Error(`--type must be "css-var" or "class-toggle", got "${opts.type}"`);
  }
  if (!opts.target) throw new Error('--target is required');
  if (!opts.label) throw new Error('--label is required');

  if (opts.type === 'class-toggle') {
    if (opts.min !== null || opts.max !== null || opts.unit !== null || opts.readout) {
      throw new Error('--min/--max/--unit/--readout only apply to --type css-var');
    }
    if (!opts.options) {
      throw new Error('--type class-toggle requires --options (comma-separated variant names)');
    }
    return;
  }

  if (opts.prefix !== null) throw new Error('--prefix only applies to --type class-toggle');
  const hasRange = opts.min !== null || opts.max !== null;
  const hasOptions = !!opts.options;
  if (hasRange && hasOptions) {
    throw new Error('--type css-var takes either --min/--max (continuous) or --options (swatch), not both');
  }
  if (!hasRange && !hasOptions) {
    throw new Error('--type css-var requires either --min/--max (continuous) or --options (swatch)');
  }
  if (hasRange && (opts.min === null || opts.max === null)) {
    throw new Error('a continuous css-var control requires both --min and --max');
  }
  if (hasOptions && opts.readout) {
    throw new Error('--readout only applies to a continuous css-var control (needs --min/--max)');
  }
}

function parseValuesJson(raw) {
  let parsed;
  try {
    parsed = JSON.parse(raw);
  } catch (err) {
    throw new Error(`--values must be valid JSON: ${err.message}`);
  }
  if (parsed === null || typeof parsed !== 'object' || Array.isArray(parsed)) {
    throw new Error('--values must be a JSON object mapping each control\'s data-target to an override value');
  }
  return parsed;
}

function parseBakeArgs(args) {
  const opts = { file: null, values: {} };
  for (let i = 0; i < args.length; i++) {
    const arg = args[i];
    if (arg === '--values') {
      opts.values = parseValuesJson(args[++i]);
    } else if (arg.startsWith('--values=')) {
      opts.values = parseValuesJson(arg.slice('--values='.length));
    } else if (arg.startsWith('--')) {
      throw new Error(`unknown option: ${arg}`);
    } else if (opts.file === null) {
      opts.file = arg;
    } else {
      throw new Error(`unexpected argument: ${arg}`);
    }
  }

  if (!opts.file) throw new Error('missing required <tuned-file> argument');
  return opts;
}

// -- subcommands -----------------------------------------------------------------------

function runCreate(args) {
  const opts = parseCreateArgs(args);
  const filePath = path.resolve(opts.file);
  if (!fs.existsSync(filePath)) {
    throw new Error(`no such file: ${opts.file}`);
  }
  if (isReferenceFile(filePath)) {
    throw new Error(
      `${opts.file} is a reference sketch — frozen at bake, not reopened. Fork a new exploration ` +
        `sketch instead (SKILL.md Step 7, docs/adr/0006).`
    );
  }

  let content = fs.readFileSync(filePath, 'utf8');
  const notes = [];

  if (opts.type === 'wireframe') {
    const before = content;
    content = mergeWireframeTokens(content);
    notes.push(content === before ? 'wireframe tokens already present' : 'wireframe tokens merged into :root');
  }

  if (opts.noOverlay) {
    notes.push('id overlay skipped (--no-overlay)');
  } else {
    const before = content;
    content = injectIdOverlay(content);
    notes.push(content === before ? 'id overlay already present' : 'id overlay injected');
  }

  fs.writeFileSync(filePath, content, 'utf8');
  notes.forEach((note) => console.log(`sketch-tool: ${note}`));
}

function runTune(args) {
  const opts = parseTuneArgs(args);
  const filePath = path.resolve(opts.file);
  if (!fs.existsSync(filePath)) {
    throw new Error(`no such file: ${opts.file}`);
  }

  const content = fs.readFileSync(filePath, 'utf8');

  if (opts.remove !== null) {
    const updated = removeControlFromPanel(content, opts.remove);
    fs.writeFileSync(filePath, updated, 'utf8');
    console.log(`sketch-tool: removed control targeting "${opts.remove}" from ${opts.file}`);
    return;
  }

  if (opts.edit !== null) {
    const updated = editControlInPanel(content, opts);
    fs.writeFileSync(filePath, updated, 'utf8');
    console.log(
      `sketch-tool: replaced control targeting "${opts.edit}" with an updated ${opts.type} control in ${opts.file}`
    );
    return;
  }

  if (content.includes(TUNER_PANEL_START)) {
    const controlHtml = buildControlMarkup(opts, content);
    const updated = appendControlToPanel(content, controlHtml);
    fs.writeFileSync(filePath, updated, 'utf8');
    console.log(`sketch-tool: appended ${opts.type} control to existing tuner panel in ${opts.file}`);
    return;
  }

  const targetPath = deriveTunedPath(filePath);
  if (fs.existsSync(targetPath)) {
    throw new Error(
      `${path.relative(process.cwd(), targetPath)} already exists — run tune against it directly ` +
        `to append another control, or remove it first`
    );
  }

  const controlHtml = buildControlMarkup(opts, content);
  const injected = injectTunerPanel(content, controlHtml);
  fs.writeFileSync(targetPath, injected, 'utf8');
  console.log(
    `sketch-tool: forked ${opts.file} -> ${path.relative(process.cwd(), targetPath)} and injected tuner panel with ${opts.type} control`
  );
}

function runBake(args) {
  const opts = parseBakeArgs(args);
  const filePath = path.resolve(opts.file);
  if (!fs.existsSync(filePath)) {
    throw new Error(`no such file: ${opts.file}`);
  }

  let content = fs.readFileSync(filePath, 'utf8');

  const controls = parsePanelControls(content);
  const validTargets = new Set(controls.map((c) => c.target));
  Object.keys(opts.values).forEach((key) => {
    if (!validTargets.has(key)) {
      throw new Error(`--values names "${key}" but no tuner control in ${opts.file} targets it`);
    }
  });

  content = bakeCssVarControls(content, controls, opts.values);
  content = bakeClassToggleControls(content, controls, opts.values);
  content = stripBlock(content, TUNER_PANEL_START, TUNER_PANEL_END);
  content = stripBlock(content, ID_OVERLAY_START, ID_OVERLAY_END);

  const targetPath = deriveReferencePath(filePath);
  fs.writeFileSync(targetPath, content, 'utf8');
  console.log(`sketch-tool: baked ${opts.file} -> ${path.relative(process.cwd(), targetPath)}`);
}

function main(argv) {
  const [subcommand, ...rest] = argv;

  if (!subcommand || subcommand === '--help' || subcommand === '-h') {
    console.log(usage());
    process.exit(subcommand ? 0 : 1);
  }

  if (subcommand === 'create') {
    runCreate(rest);
    return;
  }

  if (subcommand === 'tune') {
    runTune(rest);
    return;
  }

  if (subcommand === 'bake') {
    runBake(rest);
    return;
  }

  console.error(`sketch-tool: unknown subcommand "${subcommand}"\n`);
  console.error(usage());
  process.exit(1);
}

if (require.main === module) {
  try {
    main(process.argv.slice(2));
  } catch (err) {
    console.error(`sketch-tool: ${err.message}`);
    process.exit(1);
  }
}

module.exports = {
  injectIdOverlay,
  mergeWireframeTokens,
  findRootBlock,
  parseCustomProps,
  buildControlMarkup,
  injectTunerPanel,
  appendControlToPanel,
  removeControlFromPanel,
  editControlInPanel,
  deriveTunedPath,
  deriveReferencePath,
  isReferenceFile,
  parsePanelControls,
  substituteRootProp,
  locateOpeningTag,
  addClassToTag,
  stripBlock,
};
