// Real CodeMirror 6 code editor + llama.vim-style FIM ghost-text completion.
// Loaded as an ES module (dynamic ESM imports from a CDN, no build step) so
// the rest of the app can stay a classic script; exposes
// window.createFimEditor for app.js to call.
//
// Talks to the already-existing, already-verified POST /api/completion/fim
// endpoint (server.ts) — no server changes needed here.

let cmModulesPromise = null;

function loadCodeMirror() {
  if (!cmModulesPromise) {
    // The `codemirror` meta-package resolves ambiguously on esm.sh (it can
    // land on the legacy CM5 build instead of the CM6 `basicSetup` bundle),
    // so the basic editor setup is composed by hand here from the
    // unambiguous CM6-only core packages instead of depending on it.
    cmModulesPromise = Promise.all([
      import("https://esm.sh/@codemirror/state@6"),
      import("https://esm.sh/@codemirror/view@6"),
      import("https://esm.sh/@codemirror/commands@6"),
      import("https://esm.sh/@codemirror/language@6"),
      import("https://esm.sh/@codemirror/language-data@6")
    ]).then(([state, view, commands, language, languageData]) => {
      const basicSetup = [
        view.lineNumbers(),
        view.highlightActiveLineGutter(),
        view.highlightActiveLine(),
        view.drawSelection(),
        view.dropCursor(),
        language.indentOnInput(),
        language.bracketMatching(),
        language.syntaxHighlighting(language.defaultHighlightStyle, { fallback: true }),
        commands.history(),
        view.keymap.of([...commands.defaultKeymap, ...commands.historyKeymap])
      ];
      return {
        basicSetup,
        EditorView: view.EditorView,
        Decoration: view.Decoration,
        WidgetType: view.WidgetType,
        keymap: view.keymap,
        EditorState: state.EditorState,
        StateEffect: state.StateEffect,
        StateField: state.StateField,
        Compartment: state.Compartment,
        Prec: state.Prec,
        indentMore: commands.indentMore,
        languages: languageData.languages
      };
    });
  }
  return cmModulesPromise;
}

const FIM_DEBOUNCE_MS = 450;

export async function createFimEditor(mountEl, { getWorkspace } = {}) {
  const cm = await loadCodeMirror();

  const setGhost = cm.StateEffect.define();
  const ghostField = cm.StateField.define({
    create: () => null,
    update(value, tr) {
      for (const effect of tr.effects) {
        if (effect.is(setGhost)) value = effect.value;
      }
      // Any edit invalidates a pending suggestion — it was computed against
      // a prefix/suffix that no longer matches the document.
      if (tr.docChanged && value) value = null;
      return value;
    },
    provide: field => cm.EditorView.decorations.from(field, value => {
      if (!value) return cm.Decoration.none;
      const GhostWidget = class extends cm.WidgetType {
        toDOM() {
          const span = document.createElement("span");
          span.className = "cm-fim-ghost";
          span.textContent = value.text;
          return span;
        }
        eq(other) { return other.text === value.text; }
      };
      return cm.Decoration.set([cm.Decoration.widget({ widget: new GhostWidget(), side: 1 }).range(value.pos)]);
    })
  });

  function acceptGhost(view) {
    const value = view.state.field(ghostField);
    if (!value) return false;
    view.dispatch({
      changes: { from: value.pos, insert: value.text },
      selection: { anchor: value.pos + value.text.length },
      effects: setGhost.of(null)
    });
    return true;
  }

  let debounceTimer = null;
  let requestSeq = 0;
  let currentLanguage = "plaintext";

  async function requestSuggestion(view) {
    const mySeq = ++requestSeq;
    const pos = view.state.selection.main.head;
    const doc = view.state.doc;
    const prefix = doc.sliceString(0, pos);
    const suffix = doc.sliceString(pos);
    try {
      const res = await fetch("/api/completion/fim", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          prefix: prefix.slice(-4000),
          suffix: suffix.slice(0, 1000),
          language: currentLanguage,
          workspace: typeof getWorkspace === "function" ? getWorkspace() : undefined
        })
      });
      if (!res.ok) return;
      const data = await res.json();
      // Stale response (user kept typing / moved cursor since this was
      // fired) or an empty/placeholder completion: don't show it.
      if (mySeq !== requestSeq) return;
      if (!data.completion || !data.completion.trim()) return;
      if (view.state.selection.main.head !== pos) return;
      view.dispatch({ effects: setGhost.of({ pos, text: data.completion }) });
    } catch {
      // Offline engine / network error: no suggestion, same as the
      // server's own heuristic fallback for a missing engine.
    }
  }

  const fimUpdateListener = cm.EditorView.updateListener.of(update => {
    if (!update.docChanged && !update.selectionSet) return;
    if (debounceTimer) clearTimeout(debounceTimer);
    if (update.state.field(ghostField)) {
      update.view.dispatch({ effects: setGhost.of(null) });
    }
    if (update.docChanged && update.state.selection.main.empty) {
      debounceTimer = setTimeout(() => requestSuggestion(update.view), FIM_DEBOUNCE_MS);
    }
  });

  const tabKeymap = cm.Prec.highest(cm.keymap.of([
    { key: "Tab", run: view => acceptGhost(view) || cm.indentMore(view) }
  ]));

  const languageCompartment = new cm.Compartment();

  const view = new cm.EditorView({
    state: cm.EditorState.create({
      doc: "// Clicca su un file nell'albero per visualizzarne il contenuto qui...",
      extensions: [cm.basicSetup, tabKeymap, ghostField, fimUpdateListener, languageCompartment.of([]), cm.EditorView.lineWrapping]
    }),
    parent: mountEl
  });

  function guessLanguageName(filename) {
    const desc = cm.languages.find(l => l.extensions.some(ext => filename.endsWith("." + ext)));
    return desc ? desc.name.toLowerCase() : "plaintext";
  }

  async function setContent(filename, content) {
    currentLanguage = guessLanguageName(filename);
    const desc = cm.languages.find(l => l.extensions.some(ext => filename.endsWith("." + ext)));
    const langExtension = desc ? await desc.load() : [];
    view.dispatch({
      changes: { from: 0, to: view.state.doc.length, insert: content },
      effects: [setGhost.of(null), languageCompartment.reconfigure(langExtension)]
    });
  }

  function getContent() {
    return view.state.doc.toString();
  }

  function destroy() {
    if (debounceTimer) clearTimeout(debounceTimer);
    view.destroy();
  }

  return { setContent, getContent, destroy };
}

window.createFimEditor = createFimEditor;
