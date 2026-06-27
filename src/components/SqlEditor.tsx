type SqlEditorProps = {
  sql: string;
  setSql: (sql: string) => void;
  handleRunQuery: () => Promise<void>;
};

export const SqlEditor = ({
  sql,
  setSql,
  handleRunQuery,
}: SqlEditorProps): JSX.Element => {
  const lineCount = Math.max(sql.split("\n").length, 1);
  const lineNumbers = Array.from(
    { length: lineCount },
    (_, index) => index + 1,
  );

  const handleKeyDown = (
    event: React.KeyboardEvent<HTMLTextAreaElement>,
  ): void => {
    if ((event.metaKey || event.ctrlKey) && event.key === "Enter") {
      event.preventDefault();
      void handleRunQuery();
    }
  };

  return (
    <section className="editor-panel">
      <div className="line-numbers">
        {lineNumbers.map((lineNumber) => (
          <div key={lineNumber}>{lineNumber}</div>
        ))}
      </div>

      <textarea
        className="sql-editor"
        value={sql}
        spellCheck={false}
        onChange={(event) => setSql(event.target.value)}
        onKeyDown={handleKeyDown}
      />
    </section>
  );
};
