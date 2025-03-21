from app import app, db
import sqlite3
import logging

logging.basicConfig(level=logging.INFO)
logger = logging.getLogger(__name__)

def migrate_database():
    """Add new columns to the feedback table if they don't exist"""
    try:
        logger.info("Starting database migration...")
        
        # SQLite connection
        with app.app_context():
            db_path = app.config['SQLALCHEMY_DATABASE_URI'].replace('sqlite:///', '')
            
            # If using relative path with instance folder
            if not db_path.startswith('/'):
                db_path = 'instance/' + db_path
                
            logger.info(f"Database path: {db_path}")
            
            conn = sqlite3.connect(db_path)
            cursor = conn.cursor()
            
            # Check if prompt column exists
            cursor.execute("PRAGMA table_info(feedback)")
            columns = [info[1] for info in cursor.fetchall()]
            
            # Add columns if they don't exist
            if 'prompt' not in columns:
                logger.info("Adding 'prompt' column to feedback table")
                cursor.execute("ALTER TABLE feedback ADD COLUMN prompt TEXT")
            
            if 'answer' not in columns:
                logger.info("Adding 'answer' column to feedback table")
                cursor.execute("ALTER TABLE feedback ADD COLUMN answer TEXT")
            
            conn.commit()
            conn.close()
            
            logger.info("Database migration completed successfully")
            
    except Exception as e:
        logger.error(f"Error during database migration: {str(e)}")
        raise

if __name__ == "__main__":
    migrate_database() 