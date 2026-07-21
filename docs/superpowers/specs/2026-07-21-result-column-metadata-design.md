# Result Column Metadata Header Design

## Goal

Show each result column's PostgreSQL data type and whether the source column has a default value without obscuring the column name or making the grid difficult to scan.

## Header layout

Each data-column header uses a three-line stack in this order:

1. Column name, using the existing primary header style.
2. PostgreSQL data type, using a smaller muted monospace style.
3. `Default: Yes` or `Default: No`, using the same smaller muted style.

The metadata font is smaller than the current column-name font. The header grows only enough to fit the three lines without clipping. Row-selector and row-number headers remain visually centered and do not display metadata.

## Metadata behavior

- Direct table columns display the PostgreSQL formatted data type, including relevant modifiers such as `character varying(120)`.
- `Default: Yes` means the source table column has a non-null default expression. The expression itself is not displayed.
- `Default: No` means the source table column has no default expression.
- Query expressions or result fields without source-column metadata still display their PostgreSQL result type and show `Default: No`.
- Aliased source columns retain metadata by result-column position rather than relying only on the displayed name.

## Data flow

The PostgreSQL connection service enriches `QueryColumnMetadata` with a formatted data type and a boolean default flag. The typed query contract carries these fields through preload to the renderer. `ResultPanel` renders the metadata already supplied with the query result and performs no additional metadata request.

## Styling and resizing

The existing sticky header and resize handle remain intact. Long names and types truncate with ellipsis within the current column width. The three lines use compact spacing so the header remains readable at typical result-panel heights.

## Testing

- Service tests verify formatted result types and default detection for source columns and expression columns.
- Component tests verify the three-line order: column name, datatype, then default status.
- Component tests verify both `Default: Yes` and `Default: No` and confirm no clipping-dependent content is hidden from the DOM.
