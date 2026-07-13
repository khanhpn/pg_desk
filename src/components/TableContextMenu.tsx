import type { PgRelationInfo } from "@/types/metadata";

type TableContextMenuProps = {
  relation: PgRelationInfo;
  x: number;
  y: number;
  closeMenu: () => void;
  openTableInspector: (relation: PgRelationInfo) => Promise<void>;
};

/**
 * Renders contextual actions for a relation selected in the database explorer.
 *
 * @param props - Menu position, selected relation, and close/inspect callbacks.
 * @returns A positioned context menu, or `null` when no menu is active.
 */
export const TableContextMenu = ({
  relation,
  x,
  y,
  closeMenu,
  openTableInspector,
}: TableContextMenuProps): JSX.Element => {
  const menuLeft = Math.min(x, window.innerWidth - 292);
  const menuTop = Math.min(y, window.innerHeight - 132);

  return (
    <div className="context-menu-backdrop" onClick={closeMenu}>
      <div
        className="table-context-menu"
        role="menu"
        aria-label={`${relation.name} table actions`}
        style={{ left: Math.max(8, menuLeft), top: Math.max(8, menuTop) }}
        onClick={(event) => {
          event.stopPropagation();
        }}
      >
        <div className="context-menu-header">
          <span className="context-menu-kicker">{relation.schema}</span>
          <span className="context-menu-heading">{relation.name}</span>
        </div>

        <button
          className="context-menu-item"
          role="menuitem"
          type="button"
          onClick={() => {
            void openTableInspector(relation);
          }}
        >
          <span className="context-menu-icon" aria-hidden="true">
            <span />
            <span />
            <span />
          </span>
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
