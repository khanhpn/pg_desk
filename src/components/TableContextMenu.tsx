import type { PgRelationInfo } from "@/types/metadata";

type TableContextMenuProps = {
  relation: PgRelationInfo;
  x: number;
  y: number;
  closeMenu: () => void;
  openTableInspector: (relation: PgRelationInfo) => Promise<void>;
};

export const TableContextMenu = ({
  relation,
  x,
  y,
  closeMenu,
  openTableInspector,
}: TableContextMenuProps): JSX.Element => {
  const menuLeft = Math.min(x, window.innerWidth - 236);
  const menuTop = Math.min(y, window.innerHeight - 72);

  return (
    <div className="context-menu-backdrop" onClick={closeMenu}>
      <div
        className="table-context-menu"
        style={{ left: Math.max(8, menuLeft), top: Math.max(8, menuTop) }}
        onClick={(event) => {
          event.stopPropagation();
        }}
      >
        <button
          className="context-menu-item"
          type="button"
          onClick={() => {
            void openTableInspector(relation);
          }}
        >
          <span className="context-menu-icon">i</span>
          <span>
            <span className="context-menu-title">Table details</span>
            <span className="context-menu-subtitle">
              Columns, keys, indexes
            </span>
          </span>
        </button>
      </div>
    </div>
  );
};
