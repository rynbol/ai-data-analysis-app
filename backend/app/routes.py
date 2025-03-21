from flask import jsonify, request
from app import app, db
from app.models import Feedback
import json
from datetime import datetime
import logging
import pandas as pd
import io
import tempfile
import os
import numpy as np
import requests
import hashlib

# Configure logging
logging.basicConfig(level=logging.INFO)
logger = logging.getLogger(__name__)

# Initialize global variables for data storage
app.last_upload_data = {}
app.session_datasets = {}  # Use this to store multiple datasets by file_id

# OpenAI API configuration
OPENAI_API_KEY = os.getenv('OPENAI_API_KEY')
OPENAI_API_URL = "https://api.openai.com/v1/chat/completions"

if not OPENAI_API_KEY:
    logger.warning("OpenAI API key not found in environment variables. Please set OPENAI_API_KEY in your .env file.")

# Add a before_request handler to log all incoming requests
@app.before_request
def log_request_info():
    logger.info(f"Request: {request.method} {request.path}")
    logger.info(f"Headers: {dict(request.headers)}")
    
    if request.is_json:
        logger.info(f"JSON Body: {request.get_json()}")
    elif request.form:
        logger.info(f"Form data: {request.form}")
    elif request.files:
        logger.info(f"Files: {list(request.files.keys())}")

# Add a route to handle the root path
@app.route('/')
def index():
    return jsonify({
        'message': 'API is running',
        'status': 'ok',
        'timestamp': datetime.now().isoformat()
    })

@app.route('/api/test', methods=['GET'])
def test():
    return jsonify({'message': 'Connection successful', 'timestamp': datetime.now().isoformat()})

@app.route('/api/upload', methods=['POST'])
def upload_file():
    """
    Endpoint to handle file uploads.
    Expects a file in the request.
    Returns a JSON response with file details and parsed data.
    """
    logger.info("Upload endpoint called")
    logger.info(f"Headers: {dict(request.headers)}")
    
    if 'file' not in request.files:
        logger.warning("No file part in the request")
        return jsonify({
            'error': 'No file part in the request'
        }), 400
    
    file = request.files['file']
    logger.info(f"Received file: {file.filename}, mimetype: {file.mimetype}")
    
    if file.filename == '':
        logger.warning("No file selected")
        return jsonify({
            'error': 'No file selected'
        }), 400
    
    try:
        # Check if it's an Excel file
        if file.filename.lower().endswith(('.xlsx', '.xls')):
            logger.info("Processing Excel file")
            
            # Save the file to a temporary location
            temp_dir = tempfile.mkdtemp()
            temp_path = os.path.join(temp_dir, file.filename)
            
            # Save the uploaded file
            file.save(temp_path)
            logger.info(f"Excel file saved to temporary location: {temp_path}")
            
            # Now read it with pandas
            if file.filename.lower().endswith('.xlsx'):
                df = pd.read_excel(temp_path, engine='openpyxl')
            else:
                df = pd.read_excel(temp_path, engine='xlrd')
                
            # Clean up
            os.remove(temp_path)
            os.rmdir(temp_dir)
            
        elif file.filename.lower().endswith('.csv'):
            # For CSV files, we can read directly from the buffer
            logger.info("Processing CSV file")
            file_content = file.read()
            file_buffer = io.BytesIO(file_content)
            df = pd.read_csv(file_buffer)
        else:
            logger.warning(f"Unsupported file format: {file.filename}")
            return jsonify({
                'error': 'Unsupported file format. Please upload a CSV or Excel file.'
            }), 400
            
        # Get column headers
        column_headers = df.columns.tolist()
        logger.info(f"Parsed {len(df)} rows and {len(column_headers)} columns")
            
        # Clean data for JSON serialization
        def clean_nan(item):
            if isinstance(item, (np.int64, np.int32, np.int16, np.int8)):
                return int(item)
            if isinstance(item, (np.float64, np.float32, np.float16)):
                return None if np.isnan(item) else float(item)
            if pd.isna(item):
                return None
            return item
                
        # Convert DataFrame to dict for JSON serialization
        parsed_data = []
        for _, row in df.iterrows():
            row_data = {col: clean_nan(row[col]) for col in df.columns}
            parsed_data.append(row_data)
        
        # Generate a unique file ID if not provided
        file_id = request.form.get('fileId', f"file_{datetime.now().strftime('%Y%m%d%H%M%S')}_{abs(hash(file.filename)) % 10000}")
        
        # Store the upload data for later analysis
        result = {
            'message': 'File uploaded successfully',
            'filename': file.filename,
            'fileId': file_id,
            'columnHeaders': column_headers,
            'parsedData': parsed_data,
            'uploaded_at': datetime.now().isoformat()
        }
        
        # Store this data globally for the session using the file_id as key
        if not hasattr(app, 'session_datasets'):
            app.session_datasets = {}
        
        app.session_datasets[file_id] = result
        app.last_upload_data = result  # Keep this for backward compatibility
        
        logger.info(f"Stored upload data for file: {file.filename} with ID: {file_id}")
                
        # Return the parsed data
        return jsonify(result)
            
    except Exception as e:
        logger.exception(f"Error processing file: {str(e)}")
        return jsonify({
            'error': f'Error processing file: {str(e)}'
        }), 500

def generate_openai_response(prompt: str, data_description: str = None, dataset_content: str = "") -> str:
    """Generate a response using OpenAI API."""
    try:
        logger.info(f"Sending prompt to OpenAI: {prompt}")
        
        # Create a more comprehensive system message with specific instructions
        if data_description:
            system_message = (
                f"You are a data analysis assistant that helps users understand their datasets. "
                f"You have access to the following dataset: {data_description}\n\n"
                f"When responding to queries:\n"
                f"1. Analyze the data carefully before drawing conclusions\n"
                f"2. Provide numerical evidence to support your claims when possible\n"
                f"3. If you're uncertain about something, acknowledge your limitations\n"
                f"4. Be concise but thorough in your explanations"
            )
        else:
            system_message = (
                "You are a data analysis assistant that helps users understand their datasets. "
                "Provide insights based on the available data and explain your reasoning clearly."
            )
        
        # Create a more structured user message with the dataset context
        user_message = prompt
        if dataset_content:
            user_message = (
                f"Here is information about the dataset:\n\n"
                f"{data_description}\n\n"
                f"And here is a sample of the data (first 20 rows):\n\n"
                f"{dataset_content}\n\n"
                f"Based on this dataset, please answer the following question:\n{prompt}\n\n"
                f"If the question cannot be answered using only this sample data, please mention that "
                f"and explain what additional data might be needed."
            )
        
        # Create the API request payload with slightly higher token limit for more detailed responses
        payload = {
            "model": "gpt-3.5-turbo",
            "messages": [
                {"role": "system", "content": system_message},
                {"role": "user", "content": user_message}
            ],
            "temperature": 0.5,  # Lower temperature for more focused responses
            "max_tokens": 800    # Increased token limit for more detailed analysis
        }
        
        # Set up headers with API key
        headers = {
            "Content-Type": "application/json",
            "Authorization": f"Bearer {OPENAI_API_KEY}"
        }
        
        # Make the API request
        response = requests.post(
            OPENAI_API_URL,
            headers=headers,
            json=payload
        )
        
        # Parse the response
        if response.status_code == 200:
            response_data = response.json()
            logger.info("Successfully received response from OpenAI")
            
            # Extract the assistant's message
            if "choices" in response_data and len(response_data["choices"]) > 0:
                message = response_data["choices"][0]["message"]["content"]
                return message.strip()
            else:
                logger.error(f"Unexpected response format: {response_data}")
                return "I encountered an issue while analyzing your data. Please try again with a more specific question."
        else:
            logger.error(f"OpenAI API error: {response.status_code}, {response.text}")
            return f"Error: Unable to generate a response. API returned status code {response.status_code}."
    
    except Exception as e:
        logger.exception(f"Error calling OpenAI API: {str(e)}")
        return f"Error: {str(e)}"

# Keep the mock response function as a fallback
def generate_mock_response(prompt: str) -> str:
    """Generate a mock response based on the prompt content."""
    prompt_lower = prompt.lower()
    
    if 'summarize' in prompt_lower or 'summary' in prompt_lower:
        return "This dataset contains 500 rows and 10 columns. The main columns are sales, revenue, and customer information. The average sales value is $5,432 with a standard deviation of $1,245."
    
    elif 'correlation' in prompt_lower:
        return "There is a strong positive correlation (r=0.78) between the 'Sales' and 'Marketing Spend' columns. There is a weak negative correlation (r=-0.23) between 'Customer Age' and 'Purchase Amount'."
    
    elif 'highest' in prompt_lower or 'top' in prompt_lower:
        return "The top 5 values in the dataset are: $9,876 (row 42), $8,752 (row 105), $8,123 (row 77), $7,992 (row 131), and $7,645 (row 208)."
    
    elif 'outlier' in prompt_lower:
        return "I detected 3 potential outliers in the data: Row 87 (value: $23,456), Row 209 (value: $19,876), and Row 312 (value: $18,234). These values are more than 3 standard deviations from the mean."
    
    elif 'distribution' in prompt_lower:
        return "The data follows approximately a normal distribution with a slight right skew (skewness=0.42). The majority of values (68%) fall between $3,200 and $7,300."
    
    else:
        return "I analyzed the dataset and found it contains various numerical and categorical data. To get more specific insights, try asking about summaries, correlations, distributions, or outliers."

@app.route('/api/analyze', methods=['POST'])
def analyze_data():
    """
    Endpoint to analyze data with a given prompt.
    Expects a JSON payload with:
    - prompt: The user's prompt
    - fileId: Optional file ID to associate with this analysis
    Returns a JSON response with the analysis result.
    """
    logger.info("Analyze endpoint called")
    
    data = request.get_json()
    
    if not data or 'prompt' not in data:
        logger.warning("No prompt provided")
        return jsonify({
            'error': 'No prompt provided'
        }), 400
    
    prompt = data['prompt']
    file_id = data.get('fileId')
    
    logger.info(f"Received prompt: {prompt}")
    logger.info(f"File ID: {file_id}")
    
    # Get the dataset description based on the file ID
    if file_id and hasattr(app, 'session_datasets') and file_id in app.session_datasets:
        logger.info(f"Using data for file_id: {file_id}")
        dataset_info = app.session_datasets[file_id]
    elif hasattr(app, 'last_upload_data') and app.last_upload_data:
        logger.info("Using last uploaded data for analysis (fallback)")
        dataset_info = app.last_upload_data
    else:
        logger.warning("No uploaded data found")
        dataset_info = None
    
    # Create a data description for the AI
    if dataset_info:
        # Get column headers and a sample of the data
        column_headers = dataset_info.get('columnHeaders', [])
        parsed_data = dataset_info.get('parsedData', [])
        filename = dataset_info.get('filename', 'unknown file')
        
        data_description = f"File: {filename}\n"
        data_description += f"Columns: {', '.join(column_headers)}\n"
        data_description += f"Number of rows: {len(parsed_data)}\n\n"
        
        # Add a sample of the data (first 5 rows)
        sample_rows = min(5, len(parsed_data))
        if sample_rows > 0:
            data_description += "Sample data:\n"
            for i in range(sample_rows):
                row_str = ", ".join([f"{k}: {v}" for k, v in parsed_data[i].items()])
                data_description += f"Row {i+1}: {row_str}\n"
    else:
        logger.warning("No dataset information available")
        data_description = None
    
    try:
        # Generate response from OpenAI
        if OPENAI_API_KEY:
            logger.info("Generating OpenAI response")
            result = generate_openai_response(prompt, data_description)
        else:
            logger.info("Using mock response (no API key)")
            result = generate_mock_response(prompt)
        
        # Generate a unique ID for this result
        result_id = f"result_{datetime.now().strftime('%Y%m%d%H%M%S')}_{abs(hash(prompt)) % 10000}"
        
        # Create a history item
        history_item = {
            'id': result_id,
            'prompt': prompt,
            'answer': result,
            'timestamp': datetime.now(),
            'fileId': file_id,
            'fileName': filename if file_id and hasattr(app, 'last_upload_data') else "No file"
        }
        
        # Store in history
        if not hasattr(app, 'history_items'):
            app.history_items = []
        
        app.history_items.append(history_item)
        logger.info(f"Added history item with ID: {result_id}")
        
        # Return the result
        return jsonify({
            'result': result,
            'prompt': prompt,
            'timestamp': datetime.now().isoformat(),
            'id': result_id,
            'fileId': file_id
        })
        
    except Exception as e:
        logger.exception("Error generating response")
        return jsonify({
            'error': f'Failed to generate response: {str(e)}'
        }), 500

@app.route('/api/feedback', methods=['POST'])
def submit_feedback():
    """
    Endpoint to submit feedback for a specific analysis result.
    Expects a JSON payload with resultId and feedbackType.
    Stores the feedback in the database.
    """
    try:
        data = request.json
        
        if not data or 'resultId' not in data or 'feedbackType' not in data:
            return jsonify({
                'error': 'Invalid request. Please provide resultId and feedbackType.'
            }), 400
            
        result_id = data['resultId']
        feedback_type = data['feedbackType']
        comment = data.get('comment')
        file_id = data.get('fileId')
        prompt = data.get('prompt')  # Get prompt text if available
        answer = data.get('answer')  # Get answer text if available
        
        # Validate feedbackType
        if feedback_type not in ['positive', 'negative']:
            return jsonify({
                'error': 'Invalid feedbackType. Must be "positive" or "negative".'
            }), 400
            
        # Create new feedback record in the database
        new_feedback = Feedback(
            history_id=result_id,
            feedback_type=feedback_type,
            file_id=file_id,
            prompt=prompt,      # Store the prompt text
            answer=answer,      # Store the answer text
            comment=comment,
            timestamp=datetime.utcnow()
        )
        
        # Add to database
        db.session.add(new_feedback)
        db.session.commit()
        
        logger.info(f"Feedback saved for result {result_id}: {feedback_type}")
        
        return jsonify({
            'message': 'Feedback submitted successfully',
            'resultId': result_id,
            'feedbackType': feedback_type,
            'feedbackId': new_feedback.id
        })
        
    except Exception as e:
        logger.exception("Error submitting feedback")
        return jsonify({
            'error': f'Failed to submit feedback: {str(e)}'
        }), 500

@app.route('/api/history/<file_id>', methods=['GET'])
def get_file_history(file_id):
    """
    Endpoint to retrieve history items for a specific file.
    Returns a list of history items for the given file_id.
    """
    try:
        # You'd typically query your database here
        # For now, filter the global history in memory
        if not hasattr(app, 'history_items'):
            app.history_items = []
            
        file_history = [item for item in app.history_items if item.get('fileId') == file_id]
        
        return jsonify({
            'history': file_history
        })
        
    except Exception as e:
        logger.exception(f"Error retrieving history for file {file_id}")
        return jsonify({
            'error': f'Failed to retrieve history: {str(e)}'
        }), 500 