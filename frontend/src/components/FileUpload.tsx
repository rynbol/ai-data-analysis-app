import React, { useState } from "react";
import { Form, Alert } from "react-bootstrap";

interface FileUploadProps {
  onFileUpload: (
    files: Array<{ id: string; name: string; content: unknown }>
  ) => void;
}

// File upload component
const FileUpload: React.FC<FileUploadProps> = ({ onFileUpload }) => {
  const [dragActive, setDragActive] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const handleDrag = (e: React.DragEvent<HTMLDivElement>) => {
    e.preventDefault();
    e.stopPropagation();
    if (e.type === "dragenter" || e.type === "dragover") {
      setDragActive(true);
    } else if (e.type === "dragleave") {
      setDragActive(false);
    }
  };

  const handleFileChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    processFiles(e.target.files);
  };

  // Process uploaded files
  const processFiles = async (selectedFiles: FileList | null) => {
    if (!selectedFiles || selectedFiles.length === 0) return;

    setError(null);
    const uploadedFiles = [];

    for (let i = 0; i < selectedFiles.length; i++) {
      const file = selectedFiles[i];

      // Validate file type
      const fileName = file.name.toLowerCase();
      if (
        !fileName.endsWith(".csv") &&
        !fileName.endsWith(".xlsx") &&
        !fileName.endsWith(".xls")
      ) {
        setError("Only CSV and Excel files are supported.");
        return;
      }

      if (fileName.endsWith(".csv")) {
        try {
          const content = await file.text();
          uploadedFiles.push({
            id: `file-${Date.now()}-${i}`,
            name: file.name,
            content,
          });
        } catch (error) {
          console.error("Error reading file:", error);
          setError("Error reading file. Please try again.");
          return;
        }
      } else {
        // For Excel files, keep the original file object
        uploadedFiles.push({
          id: `file-${Date.now()}-${i}`,
          name: file.name,
          content: file, // Keep the original File object for Excel files
        });
      }
    }

    onFileUpload(uploadedFiles);
  };

  return (
    <div className="file-upload mb-3">
      {error && <Alert variant="danger">{error}</Alert>}

      <div
        className={`file-upload-area p-4 border rounded text-center ${
          dragActive ? "border-primary bg-light" : ""
        }`}
        onDragEnter={handleDrag}
        onDragOver={handleDrag}
        onDragLeave={handleDrag}
        onClick={() => document.getElementById("file-upload")?.click()}
        style={{ cursor: "pointer" }}
      >
        <p className="mb-0">Drag and drop files here, or click to select</p>
      </div>
      <Form.Control
        id="file-upload"
        type="file"
        multiple
        accept=".csv,.xlsx,.xls"
        onChange={handleFileChange}
        style={{ display: "none" }}
      />
      <small className="text-muted d-block mt-2">
        Supported file types: CSV, XLS, XLSX
      </small>
    </div>
  );
};

export default FileUpload;
