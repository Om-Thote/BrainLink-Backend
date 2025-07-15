import dotenv from 'dotenv';

// Load environment variables
dotenv.config();

export const JWT_PASSWORD = process.env.JWT_PASSWORD || "!123123";
export const MONGODB_URI = process.env.MONGODB_URI || "mongodb+srv://omthote24:om123@cluster0.4rk615r.mongodb.net/?retryWrites=true&w=majority&appName=Cluster0";
export const PORT = process.env.PORT || 3000;
export const FRONTEND_URL = process.env.FRONTEND_URL || "https://brainlink-frontend.onrender.com";