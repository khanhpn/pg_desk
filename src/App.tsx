import "@/App.css";
import { FakeEditor } from "@/components/FakeEditor";
import { QueryToolbar } from "@/components/QueryToolbar";
import { ResultPanel } from "@/components/ResultPanel";
import { Sidebar } from "@/components/Sidebar";
import { Topbar } from "@/components/Topbar";
import { useConnectionTest } from "@/hooks/useConnectionTest";
import { useIpcPing } from "@/hooks/useIpcPing";

const App = () => {
  const {
    connectionForm,
    connectionMessage,
    isTestingConnection,
    updateConnectionField,
    handleTestConnection,
  } = useConnectionTest();

  const { ipcMessage, handlePing } = useIpcPing();

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
        <QueryToolbar />
        <FakeEditor />
        <ResultPanel />
      </main>
    </div>
  );
};

export default App;
