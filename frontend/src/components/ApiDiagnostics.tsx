import React, { useState } from "react";
import { Button, Card, Alert } from "react-bootstrap";

interface ApiDiagnosticsProps {
  onClose: () => void;
}

type TestStatus = "success" | "error" | "pending";

interface TestResult {
  endpoint: string;
  status: TestStatus;
  message: string;
}

const ApiDiagnostics: React.FC<ApiDiagnosticsProps> = ({ onClose }) => {
  const [testResults, setTestResults] = useState<TestResult[]>([]);
  const [isTesting, setIsTesting] = useState(false);

  const runTests = async () => {
    setIsTesting(true);
    setTestResults([]);

    // Test connection endpoint (GET)
    try {
      await testEndpoint("/test", "Test endpoint", { method: "GET" });
    } catch (error) {
      console.error("Failed to complete tests:", error);
    }

    // Test upload endpoint with a sample file (POST)
    try {
      // Create a simple CSV file for testing
      const csvContent = "name,age\nJohn,30\nJane,25";
      const blob = new Blob([csvContent], { type: "text/csv" });
      const file = new File([blob], "test.csv", { type: "text/csv" });

      const formData = new FormData();
      formData.append("file", file);

      await testEndpoint("/upload", "Upload endpoint", {
        method: "POST",
        body: formData,
      });
    } catch (error) {
      console.error("Failed to test upload endpoint:", error);
    }

    // Test analyze endpoint with basic prompt (POST)
    try {
      await testEndpoint("/analyze", "Analyze endpoint", {
        method: "POST",
        body: JSON.stringify({ prompt: "Test prompt" }),
        headers: { "Content-Type": "application/json" },
      });
    } catch (error) {
      console.error("Failed to test analyze endpoint:", error);
    }

    setIsTesting(false);
  };

  const testEndpoint = async (
    endpoint: string,
    name: string,
    options: RequestInit = {}
  ) => {
    try {
      setTestResults((prev) => [
        ...prev,
        {
          endpoint,
          status: "pending",
          message: `Testing ${name}...`,
        },
      ]);

      const url = `http://127.0.0.1:5000/api${endpoint}`;
      console.log(`Testing endpoint: ${url}`, options);

      const response = await fetch(url, {
        method: options.method || "GET",
        ...options,
      });

      let resultText = "";
      try {
        const data = await response.json();
        resultText = JSON.stringify(data);
      } catch (err) {
        console.log("Could not parse response as JSON:", err);
        resultText = await response.text();
      }

      setTestResults((prev) =>
        prev.map((result) =>
          result.endpoint === endpoint
            ? {
                endpoint,
                status: "success",
                message: `${name}: ${response.status} ${
                  response.statusText
                } - ${resultText.substring(0, 100)}${
                  resultText.length > 100 ? "..." : ""
                }`,
              }
            : result
        )
      );

      return response;
    } catch (error) {
      let errorMessage = "Unknown error";
      if (error instanceof Error) {
        errorMessage = error.message;
      }

      setTestResults((prev) =>
        prev.map((result) =>
          result.endpoint === endpoint
            ? {
                endpoint,
                status: "error",
                message: `${name}: Failed - ${errorMessage}`,
              }
            : result
        )
      );

      throw error;
    }
  };

  return (
    <Card className="mb-4">
      <Card.Header className="d-flex justify-content-between align-items-center">
        <h5 className="m-0">API Diagnostics</h5>
        <Button variant="outline-secondary" size="sm" onClick={onClose}>
          Close
        </Button>
      </Card.Header>
      <Card.Body>
        <p>Run diagnostics to check API connectivity:</p>

        <Button
          variant="primary"
          onClick={runTests}
          disabled={isTesting}
          className="mb-3"
        >
          {isTesting ? "Testing..." : "Run API Tests"}
        </Button>

        {testResults.map((result, index) => (
          <Alert
            key={index}
            variant={result.status === "success" ? "success" : "danger"}
            className="mb-2 small"
          >
            {result.message}
          </Alert>
        ))}

        <div className="mt-3 small">
          <p className="fw-bold">If tests fail, check:</p>
          <ol className="ps-3">
            <li>
              Is the Flask backend running? <code>python backend/run.py</code>
            </li>
            <li>Is it running on port 5000?</li>
            <li>Are there any CORS issues? Check browser console.</li>
            <li>Is there a firewall blocking the connection?</li>
          </ol>
        </div>
      </Card.Body>
    </Card>
  );
};

export default ApiDiagnostics;
