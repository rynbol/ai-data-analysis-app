from app import app, db
from app.models import Feedback

def create_tables():
    """Create database tables based on models"""
    print("Creating database tables...")
    with app.app_context():
        db.create_all()
    print("Database tables created successfully!")

if __name__ == "__main__":
    create_tables() 