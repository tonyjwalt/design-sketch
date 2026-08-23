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

function usage() {
  return [
    'Usage: sketch-tool <subcommand> [options]',
    '',
    'Subcommands:',
    '  create <file> [--type wireframe|styled] [--no-overlay]',
    '      Inject the id-overlay block (default on) and, for --type wireframe, merge',
    '      wireframe-tokens.css custom properties into the file\'s :root.',
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

module.exports = { injectIdOverlay, mergeWireframeTokens, findRootBlock, parseCustomProps };
