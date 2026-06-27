import { sql as sqlLanguage } from "@codemirror/lang-sql";
import { EditorView, keymap } from "@codemirror/view";
import { githubDark } from "@uiw/codemirror-theme-github";
import CodeMirror from "@uiw/react-codemirror";

type SqlEditorProps = {
  sql: string;
  setSql: (sql: string) => void;
  handleRunQuery: () => Promise<void>;
};

const pgdeskEditorLayout = EditorView.theme(
  {
    "&": {
      width: "100%",
      height: "100%",
      backgroundColor: "#0d1117",
      color: "#c9d1d9",
      fontSize: "13px",
    },

    ".cm-scroller": {
      overflow: "auto",
      fontFamily: '"SF Mono", Menlo, Monaco, Consolas, monospace',
      lineHeight: "22px",
      backgroundColor: "#0d1117",
    },

    ".cm-content": {
      minHeight: "100%",
      padding: "16px 18px",
      caretColor: "#ffffff",
    },

    ".cm-line": {
      padding: "0",
    },

    ".cm-gutters": {
      backgroundColor: "#0d1117",
      color: "#6e7681",
      borderRight: "1px solid #30363d",
    },

    ".cm-lineNumbers .cm-gutterElement": {
      minWidth: "42px",
      padding: "0 10px 0 0",
    },

    ".cm-activeLine": {
      backgroundColor: "#161b22",
    },

    ".cm-activeLineGutter": {
      backgroundColor: "#161b22",
      color: "#8b949e",
    },

    ".cm-selectionBackground": {
      backgroundColor: "#264f78 !important",
    },

    ".cm-cursor": {
      borderLeftColor: "#c9d1d9",
    },

    "&.cm-focused": {
      outline: "none",
    },
  },
  {
    dark: true,
  },
);

export const SqlEditor = ({
  sql,
  setSql,
  handleRunQuery,
}: SqlEditorProps): JSX.Element => {
  const runQueryKeymap = keymap.of([
    {
      key: "Mod-Enter",
      run: (): boolean => {
        void handleRunQuery();
        return true;
      },
    },
  ]);

  return (
    <section className="editor-panel">
      <CodeMirror
        value={sql}
        height="100%"
        width="100%"
        theme={githubDark}
        basicSetup={{
          lineNumbers: true,
          foldGutter: false,
          highlightActiveLine: true,
          highlightActiveLineGutter: true,
          autocompletion: false,
          bracketMatching: true,
          closeBrackets: true,
        }}
        extensions={[sqlLanguage(), pgdeskEditorLayout, runQueryKeymap]}
        onChange={(value) => setSql(value)}
      />
    </section>
  );
};
