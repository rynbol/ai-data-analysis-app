import React from "react";
import { ButtonGroup, Button } from "react-bootstrap";
import { HandThumbsUp, HandThumbsDown } from "react-bootstrap-icons";

interface FeedbackComponentProps {
  historyId: string;
  feedback?: "positive" | "negative";
  onFeedbackSubmit: (
    historyId: string,
    feedbackType: "positive" | "negative"
  ) => void;
  size?: "sm" | "lg";
}

// Feedback component for the data display
const FeedbackComponent: React.FC<FeedbackComponentProps> = ({
  historyId,
  feedback,
  onFeedbackSubmit,
  size = "sm",
}) => {
  return (
    <div className="feedback-component">
      <ButtonGroup size={size}>
        <Button
          variant={feedback === "positive" ? "success" : "outline-success"}
          onClick={() => onFeedbackSubmit(historyId, "positive")}
          aria-label="Helpful"
          title="Helpful"
        >
          <HandThumbsUp />
        </Button>
        <Button
          variant={feedback === "negative" ? "danger" : "outline-danger"}
          onClick={() => onFeedbackSubmit(historyId, "negative")}
          aria-label="Not helpful"
          title="Not helpful"
        >
          <HandThumbsDown />
        </Button>
      </ButtonGroup>
    </div>
  );
};

export default FeedbackComponent;
