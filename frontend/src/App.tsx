import { useState, useEffect } from "react";
import "bootstrap/dist/css/bootstrap.min.css";
import { Container, Row, Col, Card, Button } from "react-bootstrap";
import FileUpload from "./components/FileUpload";
import DataDisplay from "./components/DataDisplay";
import PromptInput from "./components/PromptInput";
import HistoryList from "./components/HistoryList";
import FeedbackComponent from "./components/FeedbackComponent";
import ApiDiagnostics from "./components/ApiDiagnostics";
import ReactMarkdown from "react-markdown";
import remarkGfm from "remark-gfm";
import "./App.css";
import apiService from "./services/api";

interface UploadedFile {
  id: string;
  name: string;
  content: unknown;
}

interface HistoryItem {
  id: string;
  prompt: string;
  answer: string;
  timestamp: Date;
  fileId: string;
  fileName: string;
  feedback?: "positive" | "negative";
}

function App() {
  // State for uploaded files
  const [uploadedFiles, setUploadedFiles] = useState<UploadedFile[]>([]);

  // State for selected file
  const [selectedFile, setSelectedFile] = useState<UploadedFile | null>(null);

  // State for preview rows count
  const [previewRows, setPreviewRows] = useState<number>(10);

  // State for data preview
  const [dataPreview, setDataPreview] = useState<Record<string, unknown>[]>([]);

  // State for column headers (to preserve order)
  const [columnHeaders, setColumnHeaders] = useState<string[]>([]);

  // State for history items
  const [historyItems, setHistoryItems] = useState<HistoryItem[]>([]);

  // State for current prompt
  const [currentPrompt, setCurrentPrompt] = useState<string>("");

  // State for loading status
  const [isLoading, setIsLoading] = useState<boolean>(false);

  // State for backend connection status
  const [backendStatus, setBackendStatus] = useState<
    "connected" | "disconnected" | "checking"
  >("checking");

  // State for showing diagnostics
  const [showDiagnostics, setShowDiagnostics] = useState<boolean>(false);

  // State for filtered history items
  const [filteredHistoryItems, setFilteredHistoryItems] = useState<
    HistoryItem[]
  >([]);

  // Check backend connection on component mount
  useEffect(() => {
    const checkBackendConnection = async () => {
      try {
        await apiService.testConnection();
        console.log("Backend connection successful");
        setBackendStatus("connected");
      } catch (error) {
        console.error("Backend connection failed:", error);
        setBackendStatus("disconnected");
      }
    };

    checkBackendConnection();
  }, []);

  // Handle file upload
  const handleFileUpload = async (files: UploadedFile[]) => {
    console.log("Files uploaded:", files);

    // Add unique IDs to new files
    const newFiles = files.map((file) => ({
      ...file,
      id: `file-${Date.now()}-${Math.random().toString(36).substr(2, 9)}`,
    }));

    setUploadedFiles((prev) => [...prev, ...newFiles]);

    if (files.length > 0 && !selectedFile) {
      const file = newFiles[0];
      setSelectedFile(file);

      try {
        setIsLoading(true);

        if (
          file.name.toLowerCase().endsWith(".csv") &&
          typeof file.content === "string"
        ) {
          console.log("Parsing CSV content...");

          // Parse the CSV content
          const rows = file.content.split("\n");
          const headers = rows[0].split(",").map((h) => h.trim());

          // Store original headers to preserve column order
          setColumnHeaders(headers);

          const parsedData: Record<string, unknown>[] = [];

          // Process up to 500 rows for preview
          const maxRows = Math.min(rows.length, 500);

          for (let i = 1; i < maxRows; i++) {
            if (rows[i].trim() === "") continue;

            // Split by comma, but handle quoted values that might contain commas
            const values: string[] = [];
            let currentValue = "";
            let insideQuotes = false;
            let escapedQuote = false;

            // Parse the CSV line character by character to handle quoted fields correctly
            const line = rows[i];
            for (let j = 0; j < line.length; j++) {
              const char = line[j];

              if (char === '"') {
                if (escapedQuote) {
                  // Handle escaped quotes (double quotes)
                  currentValue += '"';
                  escapedQuote = false;
                } else if (j + 1 < line.length && line[j + 1] === '"') {
                  // Found a double quote, mark for escaping
                  escapedQuote = true;
                } else {
                  // Regular quote, toggle inside quotes state
                  insideQuotes = !insideQuotes;
                }
              } else if (char === "," && !insideQuotes) {
                values.push(currentValue.trim());
                currentValue = "";
              } else {
                currentValue += char;
              }
            }
            // Add the last value
            values.push(currentValue.trim());

            // Ensure we have the right number of values
            while (values.length < headers.length) {
              values.push("");
            }

            const rowData: Record<string, unknown> = {};

            // Ensure we have a value for each header, even if it's empty
            headers.forEach((header, index) => {
              const value = values[index] || "";
              // Try to parse numbers and dates
              if (value === "") {
                rowData[header] = "";
              } else if (!isNaN(Number(value)) && value !== "") {
                rowData[header] = Number(value);
              } else if (Date.parse(value)) {
                rowData[header] = new Date(value).toISOString().split("T")[0];
              } else {
                // For text values, preserve the exact string
                rowData[header] = value;
              }
            });

            // Add all rows, ensuring they have data for all columns
            parsedData.push(rowData);
          }

          console.log(`Parsed ${parsedData.length} rows from CSV`);
          setDataPreview(parsedData);
        } else if (
          file.name.toLowerCase().endsWith(".xlsx") ||
          file.name.toLowerCase().endsWith(".xls")
        ) {
          console.log(
            "Excel file detected, sending to backend for processing..."
          );

          try {
            const formData = new FormData();

            // Handle file content properly to prevent corruption
            let fileBlob: Blob;
            if (file.content instanceof Blob) {
              // If content is already a Blob, use it directly
              fileBlob = file.content;
            } else if (file.content instanceof File) {
              // If content is a File object, use it directly
              fileBlob = file.content;
            } else {
              throw new Error("Excel files must be uploaded as binary data");
            }

            // Append the file with original name to preserve the file extension
            formData.append("file", fileBlob, file.name);

            console.log("Sending Excel file to backend:", file.name);

            const response = await fetch(
              `${
                import.meta.env.VITE_API_URL || "http://127.0.0.1:5000/api"
              }/upload`,
              {
                method: "POST",
                body: formData,
              }
            );

            if (!response.ok) {
              const errorData = await response.json().catch(() => ({}));
              throw new Error(
                `Server error: ${response.status} - ${
                  errorData.error || response.statusText
                }`
              );
            }

            const data = await response.json();
            console.log("Server processed Excel file:", data);

            if (data.parsedData) {
              setDataPreview(data.parsedData);

              // For Excel files, use the column headers provided by the backend
              if (data.columnHeaders) {
                setColumnHeaders(data.columnHeaders);
              } else if (data.parsedData.length > 0) {
                // Fallback to extracting from first row if columnHeaders not provided
                setColumnHeaders(Object.keys(data.parsedData[0]));
              } else {
                setColumnHeaders([]);
              }
            } else {
              throw new Error("No parsed data received from server");
            }
          } catch (error) {
            console.error("Error processing Excel file:", error);
            alert(
              `Error processing Excel file: ${
                error instanceof Error ? error.message : "Unknown error"
              }`
            );
            setDataPreview([]);
          }
        } else if (file.name.toLowerCase().endsWith(".pdf")) {
          console.warn("PDF files are not supported for data analysis");
          alert(
            "PDF files are not supported for data analysis. Please convert to CSV or Excel format."
          );
          setDataPreview([]);
        } else {
          console.warn("Unsupported file format:", file.name);
          alert("Unsupported file format. Please upload a CSV or Excel file.");
          setDataPreview([]);
        }
      } catch (error) {
        console.error("Error parsing file content:", error);
        alert(
          `Error parsing file: ${
            error instanceof Error ? error.message : "Unknown error"
          }`
        );
        setDataPreview([]);
      } finally {
        setIsLoading(false);
      }
    }
  };

  // Handle file selection
  const handleFileSelect = async (fileId: string) => {
    const file = uploadedFiles.find((f: UploadedFile) => f.id === fileId);
    if (file) {
      setSelectedFile(file);

      try {
        setIsLoading(true);

        if (
          file.name.toLowerCase().endsWith(".csv") &&
          typeof file.content === "string"
        ) {
          console.log("Parsing CSV content...");

          // Parse the CSV content
          const rows = file.content.split("\n");
          const headers = rows[0].split(",").map((h) => h.trim());

          // Store original headers to preserve column order
          setColumnHeaders(headers);

          const parsedData: Record<string, unknown>[] = [];

          // Process up to 500 rows for preview
          const maxRows = Math.min(rows.length, 500);

          for (let i = 1; i < maxRows; i++) {
            if (rows[i].trim() === "") continue;

            // Split by comma, but handle quoted values that might contain commas
            const values: string[] = [];
            let currentValue = "";
            let insideQuotes = false;
            let escapedQuote = false;

            // Parse the CSV line character by character to handle quoted fields correctly
            const line = rows[i];
            for (let j = 0; j < line.length; j++) {
              const char = line[j];

              if (char === '"') {
                if (escapedQuote) {
                  // Handle escaped quotes (double quotes)
                  currentValue += '"';
                  escapedQuote = false;
                } else if (j + 1 < line.length && line[j + 1] === '"') {
                  // Found a double quote, mark for escaping
                  escapedQuote = true;
                } else {
                  // Regular quote, toggle inside quotes state
                  insideQuotes = !insideQuotes;
                }
              } else if (char === "," && !insideQuotes) {
                values.push(currentValue.trim());
                currentValue = "";
              } else {
                currentValue += char;
              }
            }
            // Add the last value
            values.push(currentValue.trim());

            // Ensure we have the right number of values
            while (values.length < headers.length) {
              values.push("");
            }

            const rowData: Record<string, unknown> = {};

            // Ensure we have a value for each header, even if it's empty
            headers.forEach((header, index) => {
              const value = values[index] || "";
              // Try to parse numbers and dates
              if (value === "") {
                rowData[header] = "";
              } else if (!isNaN(Number(value)) && value !== "") {
                rowData[header] = Number(value);
              } else if (Date.parse(value)) {
                rowData[header] = new Date(value).toISOString().split("T")[0];
              } else {
                // For text values, preserve the exact string
                rowData[header] = value;
              }
            });

            // Add all rows, ensuring they have data for all columns
            parsedData.push(rowData);
          }

          console.log(`Parsed ${parsedData.length} rows from CSV`);
          setDataPreview(parsedData);
        } else if (
          file.name.toLowerCase().endsWith(".xlsx") ||
          file.name.toLowerCase().endsWith(".xls")
        ) {
          console.log(
            "Excel file detected, sending to backend for processing..."
          );

          try {
            const formData = new FormData();

            // Handle file content properly to prevent corruption
            let fileBlob: Blob;
            if (file.content instanceof Blob) {
              // If content is already a Blob, use it directly
              fileBlob = file.content;
            } else if (file.content instanceof File) {
              // If content is a File object, use it directly
              fileBlob = file.content;
            } else {
              throw new Error("Excel files must be uploaded as binary data");
            }

            // Append the file with original name to preserve the file extension
            formData.append("file", fileBlob, file.name);

            console.log("Sending Excel file to backend:", file.name);

            const response = await fetch(
              `${
                import.meta.env.VITE_API_URL || "http://127.0.0.1:5000/api"
              }/upload`,
              {
                method: "POST",
                body: formData,
              }
            );

            if (!response.ok) {
              const errorData = await response.json().catch(() => ({}));
              throw new Error(
                `Server error: ${response.status} - ${
                  errorData.error || response.statusText
                }`
              );
            }

            const data = await response.json();
            console.log("Server processed Excel file:", data);

            if (data.parsedData) {
              setDataPreview(data.parsedData);

              // For Excel files, use the column headers provided by the backend
              if (data.columnHeaders) {
                setColumnHeaders(data.columnHeaders);
              } else if (data.parsedData.length > 0) {
                // Fallback to extracting from first row if columnHeaders not provided
                setColumnHeaders(Object.keys(data.parsedData[0]));
              } else {
                setColumnHeaders([]);
              }
            } else {
              throw new Error("No parsed data received from server");
            }
          } catch (error) {
            console.error("Error processing Excel file:", error);
            alert(
              `Error processing Excel file: ${
                error instanceof Error ? error.message : "Unknown error"
              }`
            );
            setDataPreview([]);
          }
        } else if (file.name.toLowerCase().endsWith(".pdf")) {
          console.warn("PDF files are not supported for data analysis");
          alert(
            "PDF files are not supported for data analysis. Please convert to CSV or Excel format."
          );
          setDataPreview([]);
        } else {
          console.warn("Unsupported file format:", file.name);
          alert("Unsupported file format. Please upload a CSV or Excel file.");
          setDataPreview([]);
        }
      } catch (error) {
        console.error("Error parsing file content:", error);
        alert(
          `Error parsing file: ${
            error instanceof Error ? error.message : "Unknown error"
          }`
        );
        setDataPreview([]);
      } finally {
        setIsLoading(false);
      }
    }

    // Filter history for the selected file
    const fileHistory = historyItems.filter((item) => item.fileId === fileId);
    setFilteredHistoryItems(fileHistory);
  };

  // Handle prompt submission
  const handlePromptSubmit = async (prompt: string) => {
    if (!selectedFile) return;

    setIsLoading(true);

    try {
      // Create new history item with temporary ID
      const tempId = `temp-${Date.now().toString()}`;
      const tempHistoryItem: HistoryItem = {
        id: tempId,
        prompt,
        answer: "Processing...",
        timestamp: new Date(),
        fileId: selectedFile.id,
        fileName: selectedFile.name,
      };

      // Add to history
      setHistoryItems((prev: HistoryItem[]) => [tempHistoryItem, ...prev]);

      // Verify backend connectivity before proceeding
      try {
        await apiService.testConnection();
      } catch (error) {
        console.error(
          "Backend connection failed during prompt submission:",
          error
        );
        throw new Error(
          "Backend server unreachable, please check if it's running"
        );
      }

      console.log(
        `Sending prompt to API: "${prompt}" for file: ${selectedFile.name}`
      );

      // Call the API with timeout
      const response = await Promise.race([
        apiService.analyzeData({
          prompt,
          fileId: selectedFile.id,
        }),
        new Promise<never>((_, reject) =>
          setTimeout(
            () => reject(new Error("Request timed out after 10 seconds")),
            10000
          )
        ),
      ]);

      console.log("API response received:", response);

      // Update the result with the response ID or generate one if not provided
      const resultId = response.id || `result-${Date.now().toString()}`;

      // Update history item with permanent ID and response
      setHistoryItems((prev) =>
        prev.map((item) =>
          item.id === tempId
            ? {
                ...item,
                id: resultId,
                answer: response.result || "No result provided from API.",
              }
            : item
        )
      );

      // Update filtered history for the selected file
      if (selectedFile) {
        setFilteredHistoryItems((prev) =>
          prev.map((item) =>
            item.id === tempId
              ? {
                  ...item,
                  id: resultId,
                  answer: response.result || "No result provided from API.",
                }
              : item
          )
        );
      }

      setIsLoading(false);
      setCurrentPrompt("");
    } catch (error) {
      console.error("Error processing prompt:", error);

      // Get detailed error message
      let errorMessage = "Error processing your request. Please try again.";
      if (error instanceof Error) {
        errorMessage = `Error: ${error.message}`;

        // Add more specific error handling
        if (errorMessage.includes("Network Error")) {
          errorMessage =
            "Network Error: Cannot connect to the backend server. Please make sure the Flask server is running.";
        } else if (errorMessage.includes("timeout")) {
          errorMessage =
            "Request timed out. The server took too long to respond.";
        } else if (errorMessage.includes("404")) {
          errorMessage =
            "API endpoint not found. The backend might be misconfigured.";
        } else if (errorMessage.includes("500")) {
          errorMessage =
            "Server error. The backend encountered an internal problem.";
        }
      }

      // Update history item with error
      setHistoryItems((prev) =>
        prev.map((item) =>
          item.answer === "Processing..."
            ? { ...item, answer: errorMessage }
            : item
        )
      );

      setIsLoading(false);
    }
  };

  // Handle history item selection
  const handleHistorySelect = (historyItem: HistoryItem) => {
    setCurrentPrompt(historyItem.prompt);

    // Find and select the file associated with this history item
    const file = uploadedFiles.find((f) => f.id === historyItem.fileId);
    if (file) {
      setSelectedFile(file);

      // Re-process the selected file instead of using mock data
      handleFileUpload([file]);
    }
  };

  // Handle feedback submission
  const handleFeedbackSubmit = async (
    historyId: string,
    feedbackType: "positive" | "negative"
  ) => {
    try {
      console.log(
        `Submitting feedback for history item ${historyId}: ${feedbackType}`
      );

      // Find the history item to get its file ID
      const historyItem = historyItems.find((item) => item.id === historyId);

      if (!historyItem) {
        console.error(`History item with ID ${historyId} not found`);
        return;
      }

      // Submit feedback via API
      await apiService.submitFeedback({
        resultId: historyId,
        feedbackType: feedbackType,
        fileId: historyItem.fileId, // Include the file ID
        prompt: historyItem.prompt, // Include the prompt text
        answer: historyItem.answer, // Include the answer text
      });

      // Update the history item with the feedback
      setHistoryItems((prev) =>
        prev.map((item) =>
          item.id === historyId ? { ...item, feedback: feedbackType } : item
        )
      );

      // Also update filtered history items if applicable
      setFilteredHistoryItems((prev) =>
        prev.map((item) =>
          item.id === historyId ? { ...item, feedback: feedbackType } : item
        )
      );

      console.log("Feedback submitted successfully");
    } catch (error) {
      console.error("Error submitting feedback:", error);
      alert(`Failed to submit feedback: ${error}`);
    }
  };

  // Effect to update filtered history when selected file changes
  useEffect(() => {
    if (selectedFile) {
      const fileHistory = historyItems.filter(
        (item) => item.fileId === selectedFile.id
      );
      setFilteredHistoryItems(fileHistory);
    } else {
      setFilteredHistoryItems([]);
    }
  }, [selectedFile, historyItems]);

  return (
    <Container fluid className="py-4">
      <Row className="mb-4">
        <Col>
          <h1 className="text-center">AI Data Analysis Assistant</h1>
          <p className="text-center text-muted">
            Upload your CSV or Excel files to analyze with AI
          </p>
          {backendStatus === "checking" && (
            <p className="text-center text-warning">
              Checking backend connection...
            </p>
          )}
          {backendStatus === "connected" && (
            <p className="text-center text-success">Backend connected ✓</p>
          )}
          {backendStatus === "disconnected" && (
            <div className="text-center">
              <p className="text-danger">
                Backend disconnected! Please make sure the Flask server is
                running.
              </p>
              <Button
                variant="outline-primary"
                size="sm"
                onClick={() => setShowDiagnostics(true)}
                className="mt-2"
              >
                Run API Diagnostics
              </Button>
            </div>
          )}
        </Col>
      </Row>

      {showDiagnostics && (
        <Row className="mb-4">
          <Col>
            <ApiDiagnostics onClose={() => setShowDiagnostics(false)} />
          </Col>
        </Row>
      )}

      <Row>
        <Col md={4}>
          <Card className="mb-4">
            <Card.Body>
              <Card.Title>Upload Files</Card.Title>
              <FileUpload onFileUpload={handleFileUpload} />

              {uploadedFiles.length > 0 && (
                <div className="mt-3">
                  <h6>Uploaded Files:</h6>
                  <ul className="list-group">
                    {uploadedFiles.map((file) => (
                      <li
                        key={file.id}
                        className={`list-group-item ${
                          selectedFile?.id === file.id ? "active" : ""
                        }`}
                        onClick={() => handleFileSelect(file.id)}
                        style={{ cursor: "pointer" }}
                      >
                        {file.name}
                      </li>
                    ))}
                  </ul>
                </div>
              )}
            </Card.Body>
          </Card>

          <Card>
            <Card.Body>
              <Card.Title>History</Card.Title>
              <HistoryList
                historyItems={filteredHistoryItems}
                onHistorySelect={handleHistorySelect}
                onFeedbackSubmit={handleFeedbackSubmit}
              />
            </Card.Body>
          </Card>
        </Col>

        <Col md={8}>
          {selectedFile && (
            <>
              <Card className="mb-4">
                <Card.Body>
                  <Card.Title>Data Preview: {selectedFile.name}</Card.Title>
                  <DataDisplay
                    data={dataPreview}
                    rowCount={previewRows}
                    onRowCountChange={setPreviewRows}
                    columnHeaders={columnHeaders}
                  />
                </Card.Body>
              </Card>

              <Card>
                <Card.Body>
                  <Card.Title>Ask About Your Data</Card.Title>
                  <PromptInput
                    value={currentPrompt}
                    onChange={setCurrentPrompt}
                    onSubmit={handlePromptSubmit}
                    isLoading={isLoading}
                  />

                  {filteredHistoryItems.length > 0 && (
                    <div className="mt-4">
                      <h5>Chat History for {selectedFile?.name}</h5>
                      <div className="chat-container">
                        {filteredHistoryItems.slice(0, 5).map((item) => (
                          <div key={item.id} className="mb-3">
                            <div className="user-message p-3 rounded mb-2">
                              <strong>You:</strong> {item.prompt}
                            </div>
                            <div className="ai-message p-3 bg-light rounded">
                              <strong>AI Assistant:</strong>{" "}
                              <div className="markdown-content">
                                <ReactMarkdown remarkPlugins={[remarkGfm]}>
                                  {item.answer}
                                </ReactMarkdown>
                              </div>
                              <div className="mt-2">
                                <FeedbackComponent
                                  historyId={item.id}
                                  feedback={item.feedback}
                                  onFeedbackSubmit={handleFeedbackSubmit}
                                />
                              </div>
                            </div>
                          </div>
                        ))}
                      </div>
                      {filteredHistoryItems.length > 5 && (
                        <div className="text-center mt-2">
                          <Button
                            variant="link"
                            size="sm"
                            onClick={() => setSelectedFile(selectedFile)}
                          >
                            View all history
                          </Button>
                        </div>
                      )}
                    </div>
                  )}
                </Card.Body>
              </Card>
            </>
          )}

          {!selectedFile && (
            <Card>
              <Card.Body className="text-center p-5">
                <h4>No File Selected</h4>
                <p>Please upload and select a file to analyze.</p>
              </Card.Body>
            </Card>
          )}
        </Col>
      </Row>
    </Container>
  );
}

export default App;
