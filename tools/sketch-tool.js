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
// these never vary per control, only the fieldset's contents do.
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
  const fieldset = `<fieldset class="tuner-panel" id="tunerPanel">\n  <legend>Tuners</legend>\n\n${controlHtml}\n</fieldset>`;
  return `${TUNER_PANEL_START}\n${style}\n\n${fieldset}\n\n${script}\n${TUNER_PANEL_END}\n`;
}

function injectTunerPanel(content, controlHtml) {
  const bodyClose = /<\/body>/i.exec(content);
  if (!bodyClose) {
    throw new Error('no </body> tag found to inject tuner panel into');
  }
  const block = buildPanelBlock(controlHtml);
  return content.slice(0, bodyClose.index) + block + content.slice(bodyClose.index);
}

function locatePanelFieldset(content) {
  const startIdx = content.indexOf(TUNER_PANEL_START);
  const endIdx = content.indexOf(TUNER_PANEL_END);
  if (startIdx === -1 || endIdx === -1) {
    throw new Error('no tuner panel found in this file');
  }

  const panelSection = content.slice(startIdx, endIdx);
  const fieldsetOpen = /<fieldset[^>]*>/.exec(panelSection);
  const fieldsetCloseIdx = panelSection.indexOf('</fieldset>');
  if (!fieldsetOpen || fieldsetCloseIdx === -1) {
    throw new Error('no <fieldset> found inside the existing tuner panel block');
  }

  return {
    startIdx,
    endIdx,
    fieldsetAbsStart: startIdx + fieldsetOpen.index,
    fieldsetCloseAbsStart: startIdx + fieldsetCloseIdx, // where '</fieldset>' itself begins
    fieldsetAbsEnd: startIdx + fieldsetCloseIdx + '</fieldset>'.length,
    fieldsetInner: panelSection.slice(fieldsetOpen.index + fieldsetOpen[0].length, fieldsetCloseIdx),
  };
}

function appendControlToPanel(content, controlHtml) {
  const loc = locatePanelFieldset(content);
  return content.slice(0, loc.fieldsetCloseAbsStart) + controlHtml + '\n' + content.slice(loc.fieldsetCloseAbsStart);
}

// Finds each top-level <label>...</label> block within a fieldset's inner HTML. Tuner controls
// never nest labels (references/tuner-conventions.md: one <label> per control), so a non-greedy
// match per block is sufficient.
function findLabelBlocks(fieldsetInner) {
  const blocks = [];
  const re = /<label>[\s\S]*?<\/label>/g;
  let m;
  while ((m = re.exec(fieldsetInner)) !== null) {
    blocks.push({ start: m.index, end: m.index + m[0].length, text: m[0] });
  }
  return blocks;
}

function findControlIndexByTarget(blocks, target) {
  return blocks.findIndex((b) => b.text.includes(`data-target="${target}"`));
}

// Rebuilds the panel's <fieldset> from a fresh list of control blocks. An empty list drops the
// entire marker-wrapped panel block (style, fieldset, script) — an empty panel isn't a valid state
// per references/tuner-conventions.md's "always one <fieldset>" rule.
function spliceFieldset(content, loc, controlTexts) {
  if (controlTexts.length === 0) {
    return content.slice(0, loc.startIdx) + content.slice(loc.endIdx + TUNER_PANEL_END.length);
  }
  const newFieldset = `<fieldset class="tuner-panel" id="tunerPanel">\n  <legend>Tuners</legend>\n\n${controlTexts.join('\n\n')}\n</fieldset>`;
  return content.slice(0, loc.fieldsetAbsStart) + newFieldset + content.slice(loc.fieldsetAbsEnd);
}

function removeControlFromPanel(content, target) {
  const loc = locatePanelFieldset(content);
  const blocks = findLabelBlocks(loc.fieldsetInner);
  const idx = findControlIndexByTarget(blocks, target);
  if (idx === -1) {
    throw new Error(`no control targeting "${target}" found in the existing tuner panel`);
  }
  const texts = blocks.map((b) => b.text).filter((_, i) => i !== idx);
  return spliceFieldset(content, loc, texts);
}

// Replaces the control bound to opts.edit with a freshly built one from opts (a wholesale swap,
// not a merge of old/new attributes — see .scratch/design-sketch-tooling/issues/06). Builds the
// replacement against the panel with the old control already removed, so reusing the same --label
// doesn't trip the new control's own id-collision check against itself.
function editControlInPanel(content, opts) {
  const loc = locatePanelFieldset(content);
  const blocks = findLabelBlocks(loc.fieldsetInner);
  const idx = findControlIndexByTarget(blocks, opts.edit);
  if (idx === -1) {
    throw new Error(`no control targeting "${opts.edit}" found in the existing tuner panel`);
  }

  const texts = blocks.map((b) => b.text);
  const contentWithoutOld = spliceFieldset(content, loc, texts.filter((_, i) => i !== idx));
  const controlHtml = buildControlMarkup(opts, contentWithoutOld);
  texts[idx] = controlHtml;
  return spliceFieldset(content, loc, texts);
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

// -- subcommands -----------------------------------------------------------------------

function runCreate(args) {
  const opts = parseCreateArgs(args);
  const filePath = path.resolve(opts.file);
  if (!fs.existsSync(filePath)) {
    throw new Error(`no such file: ${opts.file}`);
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
};
