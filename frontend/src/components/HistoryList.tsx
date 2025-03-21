import React from "react";
import { ListGroup, Badge, Button } from "react-bootstrap";
import FeedbackComponent from "./FeedbackComponent";

interface HistoryItem {
  id: string;
  prompt: string;
  answer: string;
  timestamp: Date;
  fileId: string;
  fileName: string;
  feedback?: "positive" | "negative";
}

interface HistoryListProps {
  historyItems: HistoryItem[];
  onHistorySelect: (historyItem: HistoryItem) => void;
  onFeedbackSubmit: (
    historyId: string,
    feedbackType: "positive" | "negative"
  ) => void;
}

const HistoryList: React.FC<HistoryListProps> = ({
  historyItems,
  onHistorySelect,
  onFeedbackSubmit,
}) => {
  // If no history, show empty state
  if (historyItems.length === 0) {
    return (
      <div className="text-center p-3">
        <p className="text-muted">No history yet</p>
        <p className="text-muted small">
          Your questions and answers will appear here
        </p>
      </div>
    );
  }

  // Format timestamp for display
  const formatTime = (date: Date): string => {
    return new Intl.DateTimeFormat("en-US", {
      hour: "2-digit",
      minute: "2-digit",
      hour12: true,
    }).format(date);
  };

  // Strip markdown formatting for preview text
  const stripMarkdown = (text: string): string => {
    return text
      .replace(/\*\*(.*?)\*\*/g, "$1") // Bold text
      .replace(/\*(.*?)\*/g, "$1") // Italic text
      .replace(/\[(.*?)\]\(.*?\)/g, "$1") // Links
      .replace(/#{1,6}\s+/g, "") // Headers
      .replace(/`{1,3}(.*?)`{1,3}/g, "$1") // Code blocks
      .replace(/^\s*[-*+]\s+/gm, "") // List items
      .replace(/^\s*\d+\.\s+/gm, "") // Numbered list items
      .replace(/>\s+/g, "") // Blockquotes
      .replace(/\n/g, " "); // Replace newlines with spaces
  };

  return (
    <ListGroup className="history-list">
      {historyItems.map((item) => (
        <ListGroup.Item key={item.id} className="mb-2 border rounded">
          <div className="d-flex justify-content-between align-items-start mb-1">
            <div className="text-truncate pe-2">
              <strong>
                {item.prompt.length > 40
                  ? `${item.prompt.substring(0, 40)}...`
                  : item.prompt}
              </strong>
            </div>
            <Badge bg="secondary" pill className="ms-1">
              {formatTime(item.timestamp)}
            </Badge>
          </div>

          <div className="small text-muted mb-2">File: {item.fileName}</div>

          <div className="small text-truncate mb-2">
            {stripMarkdown(item.answer).length > 60
              ? `${stripMarkdown(item.answer).substring(0, 60)}...`
              : stripMarkdown(item.answer)}
          </div>

          <div className="d-flex justify-content-between">
            <Button
              variant="outline-primary"
              size="sm"
              onClick={() => onHistorySelect(item)}
            >
              Reuse
            </Button>

            <FeedbackComponent
              historyId={item.id}
              feedback={item.feedback}
              onFeedbackSubmit={onFeedbackSubmit}
              size="sm"
            />
          </div>
        </ListGroup.Item>
      ))}
    </ListGroup>
  );
};

export default HistoryList;
