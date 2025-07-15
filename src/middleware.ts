import { NextFunction, Request, Response } from "express";
import jwt, { JwtPayload } from "jsonwebtoken";
import { JWT_PASSWORD } from "./config";

// Extend Express Request interface to include userId
declare global {
    namespace Express {
        interface Request {
            userId?: string;
        }
    }
}

export const userMiddleware = (req: Request, res: Response, next: NextFunction) => {
    try {
        const header = req.headers["authorization"];
        
        if (!header) {
            res.status(401).json({
                message: "Authorization header is required"
            });
            return;
        }

        // Handle both "Bearer token" and direct token formats
        let token = header;
        if (header.startsWith("Bearer ")) {
            token = header.substring(7); // Remove "Bearer " prefix
        }

        // Verify the token
        const decoded = jwt.verify(token, JWT_PASSWORD);
        
        if (decoded) {
            if (typeof decoded === "string") {
                res.status(403).json({
                    message: "Invalid token format"
                });
                return;
            }
            
            // Set userId from decoded token
            req.userId = (decoded as JwtPayload).id;
            next();
        } else {
            res.status(403).json({
                message: "You are not logged in"
            });
        }
    } catch (error) {
        console.error("JWT verification error:", error);
        res.status(401).json({
            message: "Invalid or expired token"
        });
    }
};