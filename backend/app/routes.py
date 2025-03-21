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
        
        # Verify API key is valid
        api_key = os.getenv('OPENAI_API_KEY')
        if not api_key or len(api_key) < 20:
            logger.error("Invalid OpenAI API key")
            raise Exception("Invalid API key configuration")
            
        # Create a more comprehensive system message with specific instructions
        if data_description:
            system_message = (
                f"You are a data analysis assistant that helps users understand their datasets. "
                f"You have been provided with comprehensive dataset information and sample data. "
                f"The sample data provided is just a subset of the actual dataset, do not directly mention sample data in your response. Only make use of it to generate accurate and relevant responses. "
                f"The data includes column types, basic statistics for numerical columns, and a sample of rows in tabular format. "
                f"When responding to queries:\n"
                f"1. Use the provided statistical summaries and data sample to draw informed conclusions\n"
                f"2. Provide numerical evidence and reference specific data points when possible\n"
                f"3. If you're uncertain about something, acknowledge your limitations\n"
                f"4. Be concise but thorough in your explanations\n"
                f"5. Always try to answer the user's question as completely as possible with the data provided\n"
                f"6. When performing calculations, clearly show your work"
            )
        else:
            system_message = (
                "You are a data analysis assistant that helps users understand their datasets. "
                "Provide insights based on the available data and explain your reasoning clearly."
            )
        
        # Create a more structured user message with the dataset context
        if dataset_content:
            user_message = (
                f"# DATASET INFORMATION\n"
                f"{data_description}\n\n"
                f"# SAMPLE DATA\n"
                f"{dataset_content}\n\n"
                f"# USER QUESTION\n"
                f"{prompt}\n\n"
                f"# ANALYSIS INSTRUCTIONS\n"
                f"1. Analyze the provided dataset information and sample data carefully\n"
                f"2. Pay special attention to the numerical summaries provided for each column\n"
                f"3. When referring to data, cite specific rows or values from the sample\n"
                f"4. If the question cannot be answered completely using this sample data, provide partial insights\n"
                f"   and explain what additional data would be needed\n"
                f"5. For numerical questions, use the statistics provided in the dataset information\n"
            )
        else:
            user_message = prompt
        
        # Create the API request payload with slightly higher token limit for more detailed responses
        payload = {
            "model": "gpt-3.5-turbo",
            "messages": [
                {"role": "system", "content": system_message},
                {"role": "user", "content": user_message}
            ],
            "temperature": 0.5,  # Lower temperature for more focused responses
            "max_tokens": 1000   # Increased token limit for more detailed analysis
        }
        
        # Set up headers with API key
        headers = {
            "Content-Type": "application/json",
            "Authorization": f"Bearer {api_key}"
        }
        
        # Log how much data we're sending
        user_message_length = len(user_message)
        system_message_length = len(system_message)
        logger.info(f"Sending data to OpenAI - System message: {system_message_length} chars, User message: {user_message_length} chars")
        
        # Make the API request
        response = requests.post(
            OPENAI_API_URL,
            headers=headers,
            json=payload,
            timeout=10  # Add a timeout to prevent hanging
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
            error_data = response.json() if response.text else {"error": "Unknown error"}
            error_message = error_data.get("error", {}).get("message", f"API returned status code {response.status_code}")
            
            if "exceeded your current quota" in str(error_message).lower():
                return "The API key has exceeded its quota. Please try again later or contact support for assistance."
            elif "invalid api key" in str(error_message).lower():
                return "There is an issue with the API key configuration. Please contact support for assistance."
            else:
                return f"Error: Unable to generate a response. API error: {error_message}"
    
    except requests.exceptions.Timeout:
        logger.exception("Timeout error calling OpenAI API")
        return "The request to the AI service timed out. Please try again later."
    except requests.exceptions.RequestException as e:
        logger.exception(f"Network error calling OpenAI API: {str(e)}")
        return f"Network error: {str(e)}"
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
    elif not file_id and hasattr(app, 'last_upload_data') and app.last_upload_data:
        # Only fall back to last_upload_data if no specific file_id was provided
        logger.info("No file_id provided. Using last uploaded data for analysis (fallback)")
        dataset_info = app.last_upload_data
    else:
        if file_id:
            logger.warning(f"File ID {file_id} not found in session datasets")
            return jsonify({
                'error': f'Dataset with ID {file_id} not found'
            }), 404
        else:
            logger.warning("No uploaded data found")
            dataset_info = None
    
    # Create a data description for the AI
    if dataset_info:
        # Get column headers and a sample of the data
        column_headers = dataset_info.get('columnHeaders', [])
        parsed_data = dataset_info.get('parsedData', [])
        filename = dataset_info.get('filename', 'unknown file')
        
        # Log the dataset being used for analysis
        logger.info(f"Analyzing data from file: {filename}, File ID: {file_id}, Rows: {len(parsed_data)}, Columns: {len(column_headers)}")
        
        # Create a more comprehensive data description
        data_description = f"File: {filename}\n"
        data_description += f"Columns: {', '.join(column_headers)}\n"
        data_description += f"Number of rows: {len(parsed_data)}\n\n"
        
        # Create dataset content with more rows (up to 20) for better context
        dataset_content = ""
        sample_rows = min(20, len(parsed_data))
        
        # Create a summary of data types and basic statistics for numerical columns
        data_types = {}
        numerical_summaries = {}
        
        # Detect data types and calculate basic statistics for numerical columns
        if sample_rows > 0:
            for col in column_headers:
                # Collect non-null values for this column
                col_values = []
                for i in range(min(100, len(parsed_data))):  # Check up to 100 rows for type detection
                    if i < len(parsed_data) and col in parsed_data[i] and parsed_data[i][col] is not None:
                        col_values.append(parsed_data[i][col])
                
                if not col_values:
                    data_types[col] = "unknown"
                    continue
                    
                # Detect type based on first non-null value
                first_val = col_values[0]
                if isinstance(first_val, int):
                    data_types[col] = "integer"
                    # Calculate basic statistics for integers
                    valid_nums = [v for v in col_values if isinstance(v, (int, float)) and not pd.isna(v)]
                    if valid_nums:
                        try:
                            numerical_summaries[col] = {
                                "min": min(valid_nums),
                                "max": max(valid_nums),
                                "avg": sum(valid_nums) / len(valid_nums),
                                "count": len(valid_nums)
                            }
                        except Exception as e:
                            logger.warning(f"Error calculating statistics for column {col}: {str(e)}")
                elif isinstance(first_val, float):
                    data_types[col] = "float"
                    # Calculate basic statistics for floats
                    valid_nums = [v for v in col_values if isinstance(v, (int, float)) and not pd.isna(v)]
                    if valid_nums:
                        try:
                            numerical_summaries[col] = {
                                "min": min(valid_nums),
                                "max": max(valid_nums),
                                "avg": sum(valid_nums) / len(valid_nums),
                                "count": len(valid_nums)
                            }
                        except Exception as e:
                            logger.warning(f"Error calculating statistics for column {col}: {str(e)}")
                else:
                    data_types[col] = "string/categorical"
        
        # Add data type information to the data description
        data_description += "Column Data Types:\n"
        for col, dtype in data_types.items():
            data_description += f"- {col}: {dtype}"
            if col in numerical_summaries:
                stats = numerical_summaries[col]
                data_description += f" (min: {stats['min']}, max: {stats['max']}, avg: {stats['avg']:.2f}, count: {stats['count']})"
            data_description += "\n"
        
        # Format dataset content in a structured, tabular format
        if sample_rows > 0:
            # Create a header with column names
            dataset_content += "DATA SAMPLE (TABULAR FORMAT):\n"
            
            # Format a header row
            header_row = " | ".join(column_headers)
            dataset_content += header_row + "\n"
            dataset_content += "-" * len(header_row) + "\n"
            
            # Format data rows with proper value representation
            for i in range(sample_rows):
                if i >= len(parsed_data):
                    break
                    
                row_values = []
                for col in column_headers:
                    if col in parsed_data[i]:
                        value = parsed_data[i][col]
                        # Format different value types appropriately
                        if value is None:
                            value_str = ""
                        elif isinstance(value, (int, float)):
                            # Format numbers consistently
                            if isinstance(value, int):
                                value_str = str(value)
                            else:
                                value_str = f"{value:.4f}".rstrip('0').rstrip('.') if '.' in f"{value:.4f}" else str(value)
                        else:
                            # For strings, ensure proper representation
                            value_str = str(value)
                            # Truncate very long strings
                            if len(value_str) > 50:
                                value_str = value_str[:47] + "..."
                        row_values.append(value_str)
                    else:
                        row_values.append("")
                dataset_content += " | ".join(row_values) + "\n"
    else:
        logger.warning("No dataset information available")
        data_description = None
        dataset_content = None
    
    try:
        # Check if OpenAI API key exists and is not empty or malformed
        api_key = os.getenv('OPENAI_API_KEY')
        if api_key and len(api_key) > 20 and not '\n' in api_key:
            logger.info("Generating OpenAI response")
            try:
                result = generate_openai_response(prompt, data_description, dataset_content)
            except Exception as e:
                logger.exception(f"Error calling OpenAI API: {str(e)}")
                logger.info("Falling back to mock response due to API error")
                result = generate_mock_response(prompt)
        else:
            logger.warning("Invalid or missing OpenAI API key, using mock response")
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
            'fileName': filename if file_id and dataset_info else "No file"
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