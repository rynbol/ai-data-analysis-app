import React from "react";
import { Table, Form } from "react-bootstrap";

interface DataDisplayProps {
  data: Record<string, unknown>[];
  rowCount: number;
  onRowCountChange: (count: number) => void;
  columnHeaders?: string[]; // Optional array of column headers in original order
}

const DataDisplay: React.FC<DataDisplayProps> = ({
  data,
  rowCount,
  onRowCountChange,
  columnHeaders,
}) => {
  // If no data is available, show placeholder message
  if (!data || data.length === 0) {
    return (
      <div className="text-center p-4">
        <p className="text-muted">No data available to display.</p>
        <p className="text-muted small">
          Upload a file and select it to view data.
        </p>
      </div>
    );
  }

  // Get column headers, use provided headers if available if not we extract from data
  const columns = columnHeaders?.length
    ? columnHeaders
    : Object.keys(data[0] || {});

  // Handle row count change
  const handleRowCountChange = (e: React.ChangeEvent<HTMLSelectElement>) => {
    const newCount = parseInt(e.target.value, 10);
    onRowCountChange(newCount);
  };

  // Process the data to ensure all values are properly formatted
  const processedData = data.slice(0, rowCount).map((row) => {
    const processedRow: Record<string, unknown> = {};
    columns.forEach((column) => {
      processedRow[column] = column in row ? row[column] : "";
    });
    return processedRow;
  });

  return (
    <div className="data-display">
      <div className="d-flex justify-content-between align-items-center mb-3">
        <h6 className="m-0">
          Preview ({Math.min(rowCount, data.length)} rows)
        </h6>
        <Form.Group className="d-flex align-items-center">
          <Form.Label className="me-2 mb-0">Rows:</Form.Label>
          <Form.Select
            size="sm"
            style={{ width: "80px" }}
            value={rowCount}
            onChange={handleRowCountChange}
          >
            <option value="5">5</option>
            <option value="10">10</option>
            <option value="20">20</option>
            <option value="50">50</option>
            <option value="100">100</option>
          </Form.Select>
        </Form.Group>
      </div>

      <div className="table-responsive">
        <Table striped bordered hover size="sm">
          <thead>
            <tr>
              {columns.map((column, index) => (
                <th key={index}>{column}</th>
              ))}
            </tr>
          </thead>
          <tbody>
            {processedData.map((row, rowIndex) => (
              <tr key={`row-${rowIndex}`}>
                {columns.map((column) => (
                  <td key={`cell-${rowIndex}-${column}`}>
                    {formatCellValue(row[column])}
                  </td>
                ))}
              </tr>
            ))}
          </tbody>
        </Table>
      </div>
    </div>
  );
};

// formatCellValue = (value: unknown): string => {

//   if (typeof value === "object") {
//     return JSON.stringify(value);
//   }

//   return String(value);
// };

// Format for data display
const formatCellValue = (value: unknown): string => {
  if (value === null || value === undefined) {
    return "";
  }

  if (typeof value === "object") {
    return JSON.stringify(value);
  }

  return String(value);
};

export default DataDisplay;
