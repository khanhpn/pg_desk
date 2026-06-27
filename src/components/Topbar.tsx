type TopbarProps = {
  ipcMessage: string;
  handlePing: () => Promise<void>;
};

export const Topbar = ({
  ipcMessage,
  handlePing,
}: TopbarProps): JSX.Element => {
  return (
    <header className="topbar">
      <div className="tabs">
        <div className="tab active">Query 1</div>
        <div className="tab">users</div>

        <button className="new-tab" type="button">
          +
        </button>
      </div>

      <button
        className="connection-info connection-info-button"
        type="button"
        onClick={handlePing}
      >
        <span className="dot" />
        {ipcMessage}
      </button>
    </header>
  );
};
