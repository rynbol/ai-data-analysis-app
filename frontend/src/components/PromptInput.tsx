import React, { useState } from "react";
import { Form, Button, Spinner, Card, ListGroup } from "react-bootstrap";

interface PromptInputProps {
  value: string;
  onChange: (value: string) => void;
  onSubmit: (prompt: string) => void;
  isLoading: boolean;
}

const PromptInput: React.FC<PromptInputProps> = ({
  value,
  onChange,
  onSubmit,
  isLoading,
}) => {
  const [showSuggestions, setShowSuggestions] = useState<boolean>(false);

  // Template for example suggestions of prompts
  const suggestions = [
    "Summarize the key insights from this dataset",
    "What are the trends in this data?",
    "Find any outliers in the dataset",
    "Calculate the correlation between column A and column B",
    "Create a segment analysis of the data by category",
    "What are the top 5 values in this dataset?",
    "Is there any missing data and how significant is it?",
    "What patterns can you identify in this data?",
  ];

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (value.trim()) {
      onSubmit(value.trim());
      setShowSuggestions(false);
    }
  };

  const handleSuggestionClick = (suggestion: string) => {
    onChange(suggestion);
    setShowSuggestions(false);
  };

  return (
    <>
      <Form onSubmit={handleSubmit}>
        <Form.Group className="mb-3">
          <Form.Control
            as="textarea"
            rows={3}
            value={value}
            onChange={(e) => onChange(e.target.value)}
            placeholder="Ask a question about your data..."
            disabled={isLoading}
            className="chat-input"
            onFocus={() => setShowSuggestions(true)}
          />
          <div className="mt-2 text-end">
            <Button
              variant="link"
              size="sm"
              onClick={() => setShowSuggestions(!showSuggestions)}
              className="text-decoration-none"
            >
              {showSuggestions ? "Hide suggestions" : "Show suggestions"}
            </Button>
          </div>
        </Form.Group>

        {showSuggestions && (
          <Card className="mb-3 suggestion-card">
            <Card.Header className="bg-light">
              <small className="text-muted">
                Example questions you can ask:
              </small>
            </Card.Header>
            <ListGroup variant="flush">
              {suggestions.map((suggestion, index) => (
                <ListGroup.Item
                  key={index}
                  action
                  onClick={() => handleSuggestionClick(suggestion)}
                  className="suggestion-item py-2"
                >
                  <small>{suggestion}</small>
                </ListGroup.Item>
              ))}
            </ListGroup>
          </Card>
        )}

        <div className="d-grid">
          <Button
            variant="primary"
            type="submit"
            disabled={!value.trim() || isLoading}
          >
            {isLoading ? (
              <>
                <Spinner
                  as="span"
                  animation="border"
                  size="sm"
                  role="status"
                  aria-hidden="true"
                  className="me-2"
                />
                Analyzing Data...
              </>
            ) : (
              "Ask AI Assistant"
            )}
          </Button>
        </div>
      </Form>
    </>
  );
};

export default PromptInput;
