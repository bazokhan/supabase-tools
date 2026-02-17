import { renderRawDocument } from "../components/document.js";

const importMap = `{"imports":{"@codemirror/view":"/lib/@codemirror/view/dist/index.js","@codemirror/state":"/lib/@codemirror/state/dist/index.js","@codemirror/commands":"/lib/@codemirror/commands/dist/index.js","@codemirror/lang-sql":"/lib/@codemirror/lang-sql/dist/index.js","@codemirror/theme-one-dark":"/lib/@codemirror/theme-one-dark/dist/index.js","@codemirror/language":"/lib/@codemirror/language/dist/index.js","@codemirror/autocomplete":"/lib/@codemirror/autocomplete/dist/index.js","@codemirror/lint":"/lib/@codemirror/lint/dist/index.js","@lezer/highlight":"/lib/@lezer/highlight/dist/index.js","@lezer/lr":"/lib/@lezer/lr/dist/index.js","@lezer/common":"/lib/@lezer/common/dist/index.js","style-mod":"/lib/style-mod/src/style-mod.js","w3c-keyname":"/lib/w3c-keyname/index.js","crelt":"/lib/crelt/index.js","@marijn/find-cluster-break":"/lib/@marijn/find-cluster-break/src/index.js"}}`;

export function renderMigrationStudioPage(opts: { migrationsDir: string; styles: string }): string {
  const bodyHtml = `
<script type="importmap">${importMap}</script>
<h1>Migration Studio</h1>
<p class="sub">Create and apply migrations. SQL-first workflow. Apply uses <code>sbt migrate</code>.</p>

<div class="toolbar">
  <button type="button" id="btn-analyze">Analyze SQL</button>
  <button type="button" id="btn-dry-run">Dry run</button>
  <button type="button" id="btn-wrap-tx">Wrap in transaction</button>
  <button type="button" class="primary" id="btn-save">Save as migration</button>
  <button type="button" id="btn-save-new">Save as new</button>
  <button type="button" class="danger" id="btn-apply">Apply migrations</button>
  <span id="schema-status" class="schema-status"></span>
</div>

<div class="template-bar" id="template-bar"></div>

<div id="message"></div>

<div class="main-layout">
<div class="editor-column">
<div class="panel">
  <h3>SQL editor <span class="hint">- Ctrl+Space for completion</span></h3>
  <div id="editor-wrap"></div>
</div>

<div class="panel" id="analysis-panel">
  <h3>Analysis</h3>
  <div id="analysis-content">Type SQL to see live analysis.</div>
</div>
</div>
<div class="context-sidebar">
  <div class="panel">
    <h3>Context</h3>
    <div class="context-tabs">
      <button class="context-tab active" data-tab="migrations">Migrations</button>
      <button class="context-tab" data-tab="schema">Schema</button>
    </div>
    <div id="context-migrations" class="context-list"></div>
    <div id="context-schema" class="context-list" style="display:none"></div>
  </div>
</div>
</div>`;

  const script = `
const MIGRATIONS_DIR = ${JSON.stringify(opts.migrationsDir)};

async function initEditor() {
  const view = await import('/lib/@codemirror/view/dist/index.js');
  const state = await import('/lib/@codemirror/state/dist/index.js');
  const commands = await import('/lib/@codemirror/commands/dist/index.js');
  const autocomplete = await import('/lib/@codemirror/autocomplete/dist/index.js');
  const sqlPkg = await import('/lib/@codemirror/lang-sql/dist/index.js');
  const { sql, PostgreSQL, schemaCompletionSource, keywordCompletionSource } = sqlPkg;
  const { oneDark } = await import('/lib/@codemirror/theme-one-dark/dist/index.js');

  let schemaRes = await fetch('/api/schema').then(r => r.json()).catch(() => ({}));
  const setSchemaStatus = () => {
    const schemaSource = schemaRes.source || 'none';
    document.getElementById('schema-status').textContent = schemaSource === 'database' ? 'Schema: Database' : schemaSource === 'atlas-data' ? 'Schema: Cached atlas' : schemaSource === 'artifact' ? 'Schema: Table names only' : 'Schema: None';
  };
  setSchemaStatus();

  function toNestedSchema(tables) {
    const nested = {};
    for (const [key, cols] of Object.entries(tables)) {
      const parts = key.includes('.') ? key.split('.') : ['public', key];
      let node = nested;
      for (let i = 0; i < parts.length - 1; i++) {
        const p = parts[i];
        if (!node[p]) node[p] = {};
        node = node[p];
      }
      node[parts[parts.length - 1]] = cols;
    }
    return nested;
  }

  const startDoc = "-- Write your migration SQL here\\nCREATE TABLE IF NOT EXISTS public.example (\\n  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),\\n  created_at timestamptz DEFAULT now()\\n);";

  const sqlConfig = { dialect: PostgreSQL };
  if (schemaRes.tables && Object.keys(schemaRes.tables).length > 0) {
    sqlConfig.schema = toNestedSchema(schemaRes.tables);
    if ((schemaRes.schemas || []).includes('public')) sqlConfig.defaultSchema = 'public';
    if (schemaRes.schemas && schemaRes.schemas.length > 0) sqlConfig.schemas = schemaRes.schemas.map(s => ({ label: s, type: 'schema' }));
  }

  let analysisTimer = null;
  const scheduleAnalysis = () => {
    if (analysisTimer) clearTimeout(analysisTimer);
    analysisTimer = setTimeout(() => {
      analysisTimer = null;
      analyze().catch(() => {});
    }, 300);
  };

  function schemaHoverTooltip(view, pos) {
    const { from, to } = view.state.doc.lineAt(pos);
    const line = view.state.sliceDoc(from, to);
    const before = pos - from;
    const start = (line.slice(0, before).match(/([\\w."]+)$/) || [])[1];
    const after = (line.slice(before).match(/^([\\w."]*)/) || [])[1];
    const word = (start || '') + (after || '');
    if (!word || !/^[a-zA-Z_][\\w.]*$/.test(word)) return null;
    const tables = schemaRes.tables || {};
    const functions = schemaRes.functions || [];
    const types = schemaRes.types || [];
    const enums = schemaRes.enums || {};
    const views = schemaRes.views || [];
    const getTableKey = (w) => { const p = w.split('.'); return p.length === 2 && p[0] === 'public' ? p[1] : w; };
    const tblKey = getTableKey(word);
    const cols = tables[tblKey] || tables[word];
    let info = null;
    if (cols && cols.length) info = { title: 'Table ' + word, body: cols.join(', ') };
    else if (!word.includes('.') && views.includes(word)) info = { title: 'View', body: word };
    else if (!word.includes('.') && functions.includes(word)) info = { title: 'Function', body: word + '()' };
    else if (!word.includes('.') && types.includes(word)) info = { title: 'Type', body: word };
    else if (!word.includes('.') && enums[word]) info = { title: 'Enum ' + word, body: enums[word].join(', ') };
    if (!info) return null;
    const fromPos = pos - (start || '').length;
    const toPos = fromPos + word.length;
    return { pos: fromPos, end: toPos, above: true, create: () => {
      const el = document.createElement('div');
      el.className = 'cm-schema-tooltip';
      el.style.cssText = 'padding:8px 12px;font-size:0.85rem;max-width:320px;';
      el.innerHTML = '<strong>' + info.title + '</strong><div style="margin-top:4px;color:#94a3b8;">' + (info.body || '').replace(/</g, '&lt;') + '</div>';
      return { dom: el };
    }};
  }

  function dbObjectsCompletionSource(context) {
    const word = context.matchBefore(/[\\w.]*$/);
    if (!word) return null;
    const prefix = (word.text || '').toLowerCase();
    const functions = (schemaRes.functions || []).filter(f => f.toLowerCase().startsWith(prefix));
    const types = (schemaRes.types || []).filter(t => t.toLowerCase().startsWith(prefix));
    if (functions.length === 0 && types.length === 0) return null;
    const options = [
      ...functions.map(f => ({ label: f, type: 'function', detail: '()' })),
      ...types.map(t => ({ label: t, type: 'type' }))
    ];
    return { from: word.from, options, validFor: /^[\\w.]*$/ };
  }

  const completionSources = [keywordCompletionSource(PostgreSQL), schemaCompletionSource(sqlConfig), dbObjectsCompletionSource];
  const lintPkg = await import('/lib/@codemirror/lint/dist/index.js');
  const sqlLinter = (view) => {
    const sql = view.state.doc.toString();
    if (!sql.trim()) return [];
    return fetch('/api/validate', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ sql }) })
      .then(r => r.json())
      .then(v => {
        if (v.valid !== false || !v.dbConnected) return [];
        const lineNum = Math.max(1, v.line || 1);
        const doc = view.state.doc;
        if (lineNum > doc.lines) return [{ from: 0, to: 1, severity: 'error', message: v.error || 'Syntax error', source: 'PostgreSQL' }];
        const ln = doc.line(lineNum);
        return [{ from: ln.from, to: Math.min(ln.to, ln.from + 80), severity: 'error', message: v.error || 'Syntax error', source: 'PostgreSQL' }];
      })
      .catch(() => []);
  };

  const extensions = [
    view.lineNumbers(),
    commands.history(),
    sql(sqlConfig),
    oneDark,
    autocomplete.autocompletion({ override: completionSources }),
    lintPkg.linter(sqlLinter, { delay: 400 }),
    view.keymap.of([...commands.defaultKeymap, ...commands.historyKeymap, ...autocomplete.completionKeymap]),
    view.hoverTooltip(schemaHoverTooltip),
    view.EditorView.updateListener.of((up) => { if (up.docChanged) scheduleAnalysis(); }),
  ];

  const editorState = state.EditorState.create({ doc: startDoc, extensions });
  const editorView = new view.EditorView({ state: editorState, parent: document.getElementById('editor-wrap') });
  editorView.focus();

  window.__getEditorSql = () => editorView.state.doc.toString();
  window.__clearEditor = () => editorView.dispatch({ changes: { from: 0, to: editorView.state.doc.length, insert: '' } });
  window.__wrapInTransaction = () => {
    const { from, to } = editorView.state.selection.main;
    const doc = editorView.state.doc;
    const start = from === to ? 0 : from;
    const end = from === to ? doc.length : to;
    const text = doc.sliceDoc(start, end);
    if (!text.trim()) return;
    const wrapped = 'BEGIN;\\n' + text + '\\nCOMMIT;';
    editorView.dispatch({ changes: { from: start, to: end, insert: wrapped } });
  };

  const templatesRes = await fetch('/api/templates').then(r => r.json()).catch(() => ({ templates: [] }));
  const bar = document.getElementById('template-bar');
  for (const t of templatesRes.templates || []) {
    const chip = document.createElement('button');
    chip.className = 'template-chip';
    chip.textContent = t.name;
    chip.title = t.description || '';
    chip.onclick = () => {
      const sql = (t.sql || '') + '\\n\\n';
      const len = editorView.state.doc.length;
      editorView.dispatch({ changes: { from: len, to: len, insert: sql } });
      editorView.focus();
    };
    bar.appendChild(chip);
  }

  window.__currentMigrationFilename = null;
  window.__currentMigrationStatus = null;
  window.__updateSaveButton = () => {
    const btn = document.getElementById('btn-save');
    const saveNew = document.getElementById('btn-save-new');
    if (window.__currentMigrationFilename && window.__currentMigrationStatus === 'pending') {
      btn.textContent = 'Update migration';
      saveNew.style.display = 'inline-block';
    } else {
      btn.textContent = 'Save as migration';
      saveNew.style.display = window.__currentMigrationFilename ? 'inline-block' : 'none';
    }
  };

  const migEl = document.getElementById('context-migrations');
  const schemaEl = document.getElementById('context-schema');

  const renderMigrations = async () => {
    const migRes = await fetch('/api/migrations').then(r => r.json()).catch(() => ({ migrations: [] }));
    migEl.innerHTML = '';
    for (const m of migRes.migrations || []) {
      const div = document.createElement('div');
      div.className = 'context-item';
      div.innerHTML = '<code>' + (m.filename || '').replace(/</g,'&lt;') + '</code> <span class="badge-' + (m.status || 'pending') + '" style="font-size:0.7rem;margin-left:4px">' + (m.status || '') + '</span>';
      div.onclick = async () => {
        const r = await fetch('/api/migration/' + encodeURIComponent(m.filename || '')).then(x => x.json()).catch(() => ({}));
        if (r.sql) {
          const full = editorView.state.doc.toString();
          editorView.dispatch({ changes: { from: 0, to: full.length, insert: r.sql } });
          window.__currentMigrationFilename = m.filename || null;
          window.__currentMigrationStatus = m.status || 'pending';
          window.__updateSaveButton();
        }
      };
      migEl.appendChild(div);
    }
  };

  const renderSchema = () => {
    schemaEl.innerHTML = '';
    if (schemaRes.tables && Object.keys(schemaRes.tables).length > 0) {
      for (const [tbl, cols] of Object.entries(schemaRes.tables)) {
        const div = document.createElement('div');
        div.className = 'context-item';
        div.innerHTML = '<code>' + tbl.replace(/</g,'&lt;') + '</code>' + (cols && cols.length ? ' (' + cols.slice(0,3).join(', ') + (cols.length > 3 ? '...' : '') + ')' : '');
        div.onclick = () => {
          const len = editorView.state.doc.length;
          editorView.dispatch({ changes: { from: len, to: len, insert: tbl } });
          editorView.focus();
        };
        schemaEl.appendChild(div);
      }
    }
  };

  await renderMigrations();
  window.__updateSaveButton();
  renderSchema();

  try {
    const events = new EventSource('/api/events');
    events.onmessage = async () => {
      schemaRes = await fetch('/api/schema').then(r => r.json()).catch(() => schemaRes || {});
      setSchemaStatus();
      renderSchema();
      await renderMigrations();
    };
  } catch {}

  document.querySelectorAll('.context-tab').forEach(tab => {
    tab.addEventListener('click', () => {
      document.querySelectorAll('.context-tab').forEach(t => t.classList.remove('active'));
      tab.classList.add('active');
      document.getElementById('context-migrations').style.display = tab.dataset.tab === 'migrations' ? 'block' : 'none';
      document.getElementById('context-schema').style.display = tab.dataset.tab === 'schema' ? 'block' : 'none';
    });
  });
}

function showMsg(text, kind) {
  const el = document.getElementById('message');
  el.className = 'msg ' + (kind || '');
  el.textContent = text;
  el.style.display = 'block';
}

async function analyze() {
  const sql = window.__getEditorSql ? window.__getEditorSql() : '';
  const content = document.getElementById('analysis-content');
  try {
    const [analyzeRes, validateRes] = await Promise.all([
      fetch('/api/analyze', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ sql }) }).then(r => r.json()),
      fetch('/api/validate', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ sql }) }).then(r => r.json()),
    ]);
    let html = '';
    if (validateRes.valid === false && validateRes.dbConnected) {
      html += '<p class="validation-error"><strong>Syntax error:</strong> ' + (validateRes.error || '').replace(/</g, '&lt;') + (validateRes.line ? ' (line ' + validateRes.line + ')' : '') + '</p>';
    }
    if (analyzeRes.operations && analyzeRes.operations.length > 0) {
      html += '<p>Operations: ' + analyzeRes.operations.map(o => '<span class="chip">' + o.kind + '</span>').join(' ') + '</p>';
    } else if (!html) {
      html = '<p>No DDL operations detected.</p>';
    }
    content.innerHTML = html;
  } catch (e) {
    content.innerHTML = '<p class="validation-warn">Analysis failed: ' + (e.message || '') + '</p>';
  }
}

async function saveMigration(forceNew) {
  const sql = window.__getEditorSql ? window.__getEditorSql().trim() : '';
  if (!sql) { showMsg('Enter SQL first.', 'error'); return; }
  const payload = { sql };
  if (forceNew || !window.__currentMigrationFilename || window.__currentMigrationStatus !== 'pending') {
    const description = prompt('Migration description (e.g. add_user_profiles):') || '';
    payload.description = description.trim();
  } else {
    payload.filename = window.__currentMigrationFilename;
  }
  try {
    const res = await fetch('/api/save', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(payload) });
    const data = await res.json();
    if (data.filename) {
      showMsg('Saved to ' + data.filename, 'success');
      if (!payload.filename && window.__clearEditor) window.__clearEditor();
    } else {
      showMsg((data.error || 'Save failed') + (data.line ? ' (line ' + data.line + ')' : ''), 'error');
    }
  } catch (e) {
    showMsg('Save failed: ' + e.message, 'error');
  }
}

async function dryRun() {
  const sql = window.__getEditorSql ? window.__getEditorSql().trim() : '';
  if (!sql) { showMsg('Enter SQL first.', 'error'); return; }
  try {
    const res = await fetch('/api/validate', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ sql }) });
    const data = await res.json();
    if (data.valid) showMsg('Dry run: would succeed.', 'success');
    else showMsg('Dry run failed: ' + (data.error || ''), 'error');
  } catch (e) {
    showMsg('Dry run failed: ' + e.message, 'error');
  }
}

async function applyMigrations() {
  if (!confirm('Apply pending migrations via sbt migrate?')) return;
  try {
    const res = await fetch('/api/apply', { method: 'POST' });
    const data = await res.json();
    if (data.success) showMsg('Apply completed.', 'success');
    else showMsg('Apply failed: ' + (data.error || 'Unknown error'), 'error');
  } catch (e) {
    showMsg('Apply failed: ' + e.message, 'error');
  }
}

initEditor().then(() => {
  document.getElementById('btn-analyze').addEventListener('click', analyze);
  document.getElementById('btn-dry-run').addEventListener('click', dryRun);
  document.getElementById('btn-wrap-tx').addEventListener('click', () => window.__wrapInTransaction && window.__wrapInTransaction());
  document.getElementById('btn-save').addEventListener('click', () => saveMigration(false));
  document.getElementById('btn-save-new').addEventListener('click', () => saveMigration(true));
  document.getElementById('btn-apply').addEventListener('click', applyMigrations);
}).catch(e => {
  const msg = document.getElementById('message');
  msg.textContent = 'Editor failed to load: ' + e.message;
  msg.className = 'msg error';
  msg.style.display = 'block';
});`;

  return renderRawDocument({
    title: "Migration Studio",
    styles: opts.styles,
    bodyHtml,
    scriptJs: script,
    scriptType: "module",
  });
}
