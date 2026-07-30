import Table from '../atoms/Table';
import Spinner from '../atoms/Spinner';
import styles from './DataTable.module.css';

export default function DataTable({
  data = [],
  columns = [],
  loading = false,
  emptyMessage = 'Sin datos',
  rowKey = (row, index) => index,
  renderRow,
  className = '',
  ...props
}) {
  if (loading) {
    return (
      <div className={styles.state}>
        <Spinner label="Cargando datos..." />
      </div>
    );
  }

  if (!data.length) {
    return (
      <div className={styles.state}>
        <p className={styles.empty}>{emptyMessage}</p>
      </div>
    );
  }

  return (
    <div className={`${styles.wrapper} ${className}`} {...props}>
      <Table>
        <Table.Head>
          <Table.Row>
            {columns.map((col) => (
              <Table.Cell key={col.key} header style={{ width: col.width }}>
                {col.label}
              </Table.Cell>
            ))}
          </Table.Row>
        </Table.Head>
        <Table.Body>
          {data.map((row, index) => (
            <Table.Row key={rowKey(row, index)}>
              {columns.map((col) => (
                <Table.Cell key={col.key}>
                  {col.render ? col.render(row[col.key], row, index) : row[col.key]}
                </Table.Cell>
              ))}
            </Table.Row>
          ))}
        </Table.Body>
      </Table>
    </div>
  );
}
