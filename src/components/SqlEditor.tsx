import { sql as sqlLanguage } from "@codemirror/lang-sql";
import { EditorView, keymap } from "@codemirror/view";
import { githubDark } from "@uiw/codemirror-theme-github";
import CodeMirror from "@uiw/react-codemirror";
import { useCallback, useMemo } from "react";

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
      backgroundColor: "var(--editor-bg)",
      color: "var(--text)",
      fontSize: "13px",
    },

    ".cm-scroller": {
      overflow: "auto",
      fontFamily: '"SF Mono", Menlo, Monaco, Consolas, monospace',
      lineHeight: "22px",
      backgroundColor: "var(--editor-bg)",
    },

    ".cm-content": {
      minHeight: "100%",
      padding: "16px 18px",
      caretColor: "var(--text)",
    },

    ".cm-line": {
      padding: "0",
    },

    ".cm-gutters": {
      backgroundColor: "var(--editor-gutter-bg)",
      color: "var(--text-subtle)",
      borderRight: "1px solid var(--border)",
    },

    ".cm-lineNumbers .cm-gutterElement": {
      minWidth: "42px",
      padding: "0 10px 0 0",
    },

    ".cm-activeLine": {
      backgroundColor: "var(--editor-active-line)",
    },

    ".cm-activeLineGutter": {
      backgroundColor: "var(--editor-active-line)",
      color: "var(--text-muted)",
    },

    ".cm-selectionBackground": {
      backgroundColor: "var(--editor-selection) !important",
    },

    ".cm-cursor": {
      borderLeftColor: "var(--text)",
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
  const runQueryKeymap = useMemo(() => {
    return keymap.of([
      {
        key: "Mod-Enter",
        run: (): boolean => {
          void handleRunQuery();
          return true;
        },
      },
    ]);
  }, [handleRunQuery]);
  const extensions = useMemo(() => {
    return [sqlLanguage(), pgdeskEditorLayout, runQueryKeymap];
  }, [runQueryKeymap]);
  const handleEditorChange = useCallback(
    (value: string): void => {
      setSql(value);
    },
    [setSql],
  );

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
        extensions={extensions}
        onChange={handleEditorChange}
      />
    </section>
  );
};
