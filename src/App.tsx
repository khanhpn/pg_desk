import "@/App.css";

// imports components
import { QueryToolbar } from "@/components/QueryToolbar";
import { ResultPanel } from "@/components/ResultPanel";
import { Sidebar } from "@/components/Sidebar";
import { SqlEditor } from "@/components/SqlEditor";
import { Topbar } from "@/components/Topbar";

// imports hooks
import { useConnectionTest } from "@/hooks/useConnectionTest";
import { useIpcPing } from "@/hooks/useIpcPing";
import { useSqlQuery } from "@/hooks/useSqlQuery";

const App = () => {
  const {
    connectionForm,
    connectionMessage,
    isTestingConnection,
    updateConnectionField,
    handleTestConnection,
  } = useConnectionTest();

  const { ipcMessage, handlePing } = useIpcPing();

  const {
    sql,
    setSql,
    queryResult,
    queryMessage,
    isRunningQuery,
    handleRunQuery,
  } = useSqlQuery();

  return (
    <div className="app-shell">
      <Sidebar
        connectionForm={connectionForm}
        connectionMessage={connectionMessage}
        isTestingConnection={isTestingConnection}
        updateConnectionField={updateConnectionField}
        handleTestConnection={handleTestConnection}
      />

      <main className="workspace">
        <Topbar ipcMessage={ipcMessage} handlePing={handlePing} />

        <QueryToolbar
          isRunningQuery={isRunningQuery}
          queryMessage={queryMessage}
          handleRunQuery={handleRunQuery}
        />

        <SqlEditor sql={sql} setSql={setSql} handleRunQuery={handleRunQuery} />

        <ResultPanel queryResult={queryResult} queryMessage={queryMessage} />
      </main>
    </div>
  );
};

export default App;
