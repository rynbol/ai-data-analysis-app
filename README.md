# AI-Powered Data Analysis Application

This is a full-stack data analysis application that leverages AI to answer questions about uploaded data files. Users can upload CSV/XLS files, view data previews, and ask natural language questions about the data.

## Project Features

- Upload and manage multiple CSV and Excel files
- Display preview of uploaded data (configurable number of rows)
- Ask natural language questions about your data
- AI-powered analysis using OpenAI's language models
- Maintain history of queries for easy reference and reuse
- Collect user feedback on AI responses for continuous improvement

## Architecture and Technology Stack

### Frontend

- **React**: Modern component-based UI framework
- **TypeScript**: Type-safe JavaScript for improved developer experience
- **Bootstrap**: Responsive design framework for clean UI components
- **Axios**: HTTP client for API requests
- **React-Markdown**: For rendering formatted AI responses

### Backend

- **Flask**: Lightweight Python web framework
- **SQLite**: Simple file-based database for feedback storage
- **Pandas**: Data manipulation and analysis
- **OpenAI API**: AI language model for analyzing data and generating responses
- **Flask-CORS**: Cross-origin resource sharing management

## Thought Process Behind Building the App

### Design Philosophy

The application was designed with several key principles in mind:

1. **User-Centric Experience**: The interface prioritizes simplicity and clarity, allowing users to focus on their data and questions.

2. **Separation of Concerns**: The application is structured with clear separation between the data layer, business logic, and presentation layer. This makes the code more maintainable and easier to extend.

3. **Progressive Enhancement**: Core functionality works without JavaScript, but the experience is enhanced when JavaScript is enabled.

4. **Responsive Design**: The interface adapts to different screen sizes, ensuring usability across desktop and mobile devices.

### Development Approach

The development process followed these steps:

1. **Problem Definition**: Clearly defining what the app should do and the pain points it addresses.

2. **Technology Selection**: Choosing the right tools for the job based on requirements, team expertise, and scalability needs.

3. **Iterative Development**: Building core functionality first, then enhancing with additional features.

4. **Testing and Refinement**: Regular testing with diverse datasets to ensure accuracy and performance.

5. **Feedback Integration**: The app collects user feedback to continuously improve the AI responses and user experience.

### Challenges and Solutions

1. **Data Parsing**: Handling various CSV and Excel formats with different delimiters, encodings, and structures.

   - Solution: Used Pandas' flexible readers with error handling and format detection.

2. **Context Management**: Ensuring the AI has the right context about the data.

   - Solution: Preprocessed data to extract schema and sample rows for context.

3. **Query Interpretation**: Translating natural language questions to data operations.

   - Solution: Leveraged OpenAI's language models with carefully crafted prompts.

4. **Performance with Large Datasets**: Ensuring the application remains responsive with large files.
   - Solution: Implemented pagination and lazy loading of data.

## Security Considerations

The application implements several security measures:

1. **Environment Variables**: API keys and sensitive configuration are stored in environment variables, not hardcoded in the application.

2. **Input Validation**: All user inputs are validated on both client and server side to prevent injection attacks.

3. **CORS Protection**: The API implements proper CORS policies to control which domains can access resources.

4. **Rate Limiting**: Restrictions on API requests to prevent abuse and control API usage costs.

5. **Data Sanitization**: User-uploaded files are properly sanitized and validated before processing.

6. **Content Security Policy**: Implemented to prevent XSS attacks and unauthorized access to resources.

7. **Error Handling**: Custom error handling that doesn't expose sensitive information to users.

8. **Minimal Dependencies**: Careful selection of dependencies to minimize potential vulnerabilities.

9. **Secure Feedback Storage**: User feedback is stored securely in a SQLite database with proper data validation.

10. **No Data Persistence**: User data is only kept in memory during the session and not persisted to disk (except for feedback), enhancing privacy.

## Setup Instructions

### Prerequisites

- Node.js and npm
- Python 3.x
- OpenAI API key

### Frontend Setup

1. Navigate to the frontend directory:
   ```bash
   cd frontend
   ```
2. Install dependencies:
   ```bash
   npm install
   ```
3. Start the development server:
   ```bash
   npm run dev
   ```
   The frontend will be available at http://localhost:5173

### Backend Setup

1. Navigate to the backend directory:
   ```bash
   cd backend
   ```
2. Create and activate virtual environment:
   ```bash
   python3 -m venv venv
   source venv/bin/activate  # On Windows: venv\Scripts\activate
   ```
3. Install dependencies:
   ```bash
   pip install -r requirements.txt
   ```
4. Set up environment variables:
   - Create a `.env` file in the backend directory
   - Add your OpenAI API key: `OPENAI_API_KEY=your_api_key_here`

### Database Setup

The application uses SQLite which doesn't require separate installation. The database file is created automatically when the application runs for the first time.

## Running the Application

You can start both frontend and backend with a single command:

```bash
./start.sh
```

Or start them separately:

1. Start the backend server:

   ```bash
   cd backend
   source venv/bin/activate  # On Windows: venv\Scripts\activate
   python run.py
   ```

2. Start the frontend development server:
   ```bash
   cd frontend
   npm run dev
   ```

## API Endpoints

- `POST /api/upload`: Upload CSV/Excel files
- `GET /api/files`: Get list of uploaded files
- `GET /api/data/<file_id>`: Get data from a specific file
- `POST /api/analyze`: Analyze data using AI
- `POST /api/feedback`: Submit feedback on AI responses

## Future Enhancements

- Support for more file formats (JSON, Parquet, etc.)
- Data visualization capabilities
- Advanced filtering and sorting in the data preview
- User authentication and personalized history
- Exporting analysis results
- Fine-tuning the AI model based on collected feedback
