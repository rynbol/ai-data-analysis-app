from app import db
from datetime import datetime

class Feedback(db.Model):
    """Model for storing user feedback on analysis results"""
    id = db.Column(db.Integer, primary_key=True)
    history_id = db.Column(db.String(255), nullable=False)
    feedback_type = db.Column(db.String(50), nullable=False)  # positive or negative
    file_id = db.Column(db.String(255), nullable=True)
    prompt_id = db.Column(db.String(255), nullable=True)
    prompt = db.Column(db.Text, nullable=True)  # Actual prompt text
    answer = db.Column(db.Text, nullable=True)  # Actual answer text
    timestamp = db.Column(db.DateTime, default=datetime.utcnow)
    comment = db.Column(db.Text, nullable=True)
    
    def __repr__(self):
        return f'<Feedback {self.id} for history_id {self.history_id}>'
    
    def to_dict(self):
        return {
            'id': self.id,
            'history_id': self.history_id,
            'feedback_type': self.feedback_type,
            'file_id': self.file_id,
            'prompt_id': self.prompt_id,
            'prompt': self.prompt,
            'answer': self.answer,
            'timestamp': self.timestamp.isoformat(),
            'comment': self.comment
        } 