import EmptyState from './EmptyState';
import LoadingSpinner from './LoadingSpinner';

export default function Table({
  columns,
  data = [],
  rowKey = '_id',
  loading = false,
  emptyTitle = 'No records found',
  emptyDescription = '',
  onRowClick = null,
}) {
  if (loading) {
    return <LoadingSpinner label="Loading records..." />;
  }

  if (!data || data.length === 0) {
    return <EmptyState title={emptyTitle} description={emptyDescription} />;
  }

  return (
    <div className="table-wrap">
      <table className="data-table">
        <thead>
          <tr>
            {columns.map((col) => (
              <th key={col.key} style={col.headerStyle}>
                {col.header}
              </th>
            ))}
          </tr>
        </thead>
        <tbody>
          {data.map((row, idx) => {
            const key = typeof rowKey === 'function' ? rowKey(row) : row[rowKey] ?? idx;
            return (
              <tr
                key={key}
                onClick={onRowClick ? () => onRowClick(row) : undefined}
                style={onRowClick ? { cursor: 'pointer' } : undefined}
              >
                {columns.map((col) => (
                  <td key={col.key} style={col.cellStyle}>
                    {col.render ? col.render(row) : row[col.key]}
                  </td>
                ))}
              </tr>
            );
          })}
        </tbody>
      </table>
    </div>
  );
}

