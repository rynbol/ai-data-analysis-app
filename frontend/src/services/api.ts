import axios from "axios";

// Flag to enable console logging of API calls
const DEBUG = true;

// API configuration
export const API_BASE_URL =
  import.meta.env.VITE_API_URL || "http://127.0.0.1:5002/api";

// Create axios instance with interceptors for debugging
const api = axios.create({
  baseURL: API_BASE_URL,
  timeout: 10000, // 10 seconds timeout
  headers: {
    "Content-Type": "application/json",
  },
});

// Add request interceptor for debugging
api.interceptors.request.use(
  (config) => {
    if (DEBUG) {
      console.log(
        `🚀 API Request: ${config.method?.toUpperCase()} ${config.url}`,
        config.data || ""
      );
    }
    return config;
  },
  (error) => {
    if (DEBUG) {
      console.error("❌ API Request Error:", error);
    }
    return Promise.reject(error);
  }
);

// Add response interceptor for debugging
api.interceptors.response.use(
  (response) => {
    if (DEBUG) {
      console.log(`✅ API Response (${response.status}):`, response.data);
    }
    return response;
  },
  (error) => {
    if (DEBUG) {
      console.error(
        `❌ API Response Error (${error.response?.status || "Network Error"}):`
      );
      if (error.response) {
        console.error("Response data:", error.response.data);
      } else {
        console.error("Error details:", error.message);
      }
    }
    return Promise.reject(error);
  }
);

export interface AnalyzeRequest {
  prompt: string;
  fileId?: string;
}

export interface AnalyzeResponse {
  result: string;
  prompt: string;
  fileId?: string;
  timestamp: string;
  id: string;
}

export interface FeedbackRequest {
  resultId: string;
  feedbackType: "positive" | "negative";
  comment?: string;
  fileId?: string;
  prompt?: string;
  answer?: string;
}

export const apiService = {
  // Test connection to backend
  testConnection: async () => {
    try {
      console.log("Testing backend connection...");
      const response = await api.get("/test");
      console.log("Backend connection successful!");
      return response.data;
    } catch (error) {
      console.error("Backend connection failed!", error);
      throw error;
    }
  },

  // Upload a file
  uploadFile: async (file: File) => {
    const formData = new FormData();
    formData.append("file", file);

    try {
      const response = await axios.post(`${API_BASE_URL}/upload`, formData, {
        headers: {
          "Content-Type": "multipart/form-data",
        },
      });
      return response.data;
    } catch (error) {
      console.error("File upload failed:", error);
      throw error;
    }
  },

  // Send a prompt for analysis
  analyzeData: async (data: AnalyzeRequest): Promise<AnalyzeResponse> => {
    try {
      const response = await api.post("/analyze", data);
      return response.data;
    } catch (error) {
      console.error("Data analysis failed:", error);
      throw error;
    }
  },

  // Submit feedback on an analysis result
  submitFeedback: async (data: FeedbackRequest) => {
    try {
      const response = await api.post("/feedback", data);
      return response.data;
    } catch (error) {
      console.error("Feedback submission failed:", error);
      throw error;
    }
  },
};

export default apiService;
