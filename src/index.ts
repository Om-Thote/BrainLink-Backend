import express from "express";
import { random } from "./utils";
import jwt from "jsonwebtoken";
import { ContentModel, LinkModel, UserModel } from "./db";
import { JWT_PASSWORD } from "./config";
import { userMiddleware } from "./middleware";
import cors from "cors";
import bcrypt from "bcrypt";
import { z } from "zod";

const app = express();
app.use(express.json());

const corsOptions = {
    origin: process.env.FRONTEND_URL || "http://localhost:5173",
    credentials: true,
    optionsSuccessStatus: 200
};

app.use(cors(corsOptions));

// Zod validation schemas
const signupSchema = z.object({
    username: z.string().min(3, "Username must be at least 3 characters").max(50, "Username must be less than 50 characters"),
    password: z.string().min(6, "Password must be at least 6 characters").max(100, "Password must be less than 100 characters")
});

const signinSchema = z.object({
    username: z.string().min(1, "Username is required"),
    password: z.string().min(1, "Password is required")
});

const contentSchema = z.object({
    link: z.string().url("Invalid URL format"),
    type: z.enum(["youtube", "twitter", "blog", "aichat"], {
        message: "Type must be one of: youtube, twitter, blog, aichat"
    }),
    title: z.string().min(1, "Title is required").max(200, "Title must be less than 200 characters")
});

const shareSchema = z.object({
    share: z.boolean()
});

const deleteContentSchema = z.object({
    contentId: z.string().min(1, "Content ID is required")
});

// Error type guard
function isMongoError(error: unknown): error is { code: number } {
    return typeof error === 'object' && error !== null && 'code' in error;
}

app.post("/api/v1/signup", async (req, res) => {
    try {
        // Validate request body
        const { username, password } = signupSchema.parse(req.body);
        
        // Hash the password
        const saltRounds = 10;
        const hashedPassword = await bcrypt.hash(password, saltRounds);

        await UserModel.create({
            username: username,
            password: hashedPassword
        });
        
        res.json({
            message: "User signed up successfully"
        });
    } catch(error: unknown) {
        if (error instanceof z.ZodError) {
            res.status(400).json({
                message: "Validation error",
                errors: error.issues
            });
        } else if (isMongoError(error) && error.code === 11000) {
            res.status(409).json({
                message: "Username already exists"
            });
        } else {
            console.error("Signup error:", error);
            res.status(500).json({
                message: "Internal server error"
            });
        }
    }
});

app.post("/api/v1/signin", async (req, res) => {
    try {
        // Validate request body
        const { username, password } = signinSchema.parse(req.body);

        const existingUser = await UserModel.findOne({
            username
        });

        if (!existingUser) {
            res.status(403).json({
                message: "Invalid credentials"
            });
            return;
        }

        // Compare hashed password
        const isPasswordValid = await bcrypt.compare(password, existingUser.password || "");

        if (isPasswordValid) {
            const token = jwt.sign({
                id: existingUser._id
            }, JWT_PASSWORD);

            res.json({
                token
            });
        } else {
            res.status(403).json({
                message: "Invalid credentials"
            });
        }
    } catch(error: unknown) {
        if (error instanceof z.ZodError) {
            res.status(400).json({
                message: "Validation error",
                errors: error.issues
            });
        } else {
            console.error("Signin error:", error);
            res.status(500).json({
                message: "Internal server error"
            });
        }
    }
});

app.post("/api/v1/content", userMiddleware, async (req, res) => {
    try {
        // Validate request body
        const { link, type, title } = contentSchema.parse(req.body);
        
        await ContentModel.create({
            link,
            type,
            title,
            userId: req.userId,
            tags: []
        });

        res.json({
            message: "Content added successfully"
        });
    } catch(error: unknown) {
        if (error instanceof z.ZodError) {
            res.status(400).json({
                message: "Validation error",
                errors: error.issues
            });
        } else {
            console.error("Error adding content:", error);
            res.status(500).json({
                message: "Failed to add content"
            });
        }
    }
});

app.get("/api/v1/content", userMiddleware, async (req, res) => {
    try {
        const userId = req.userId;
        const content = await ContentModel.find({
            userId: userId
        }).populate("userId", "username");
        
        res.json({
            content
        });
    } catch(error: unknown) {
        console.error("Error fetching content:", error);
        res.status(500).json({
            message: "Failed to fetch content"
        });
    }
});

app.delete("/api/v1/content/:contentId", userMiddleware, async (req, res) => {
    try {
        const contentId = req.params.contentId;
        
        // Basic validation for MongoDB ObjectId format
        if (!contentId.match(/^[0-9a-fA-F]{24}$/)) {
            res.status(400).json({
                message: "Invalid content ID format"
            });
            return;
        }
        
        const result = await ContentModel.deleteOne({
            _id: contentId, 
            userId: req.userId 
        });
        
        if (result.deletedCount === 0) {
            res.status(404).json({
                message: "Content not found or not authorized to delete"
            });
            return;
        }
        
        res.json({
            message: "Content deleted successfully"
        });
    } catch (error: unknown) {
        console.error("Delete error:", error);
        res.status(500).json({
            message: "Failed to delete content"
        });
    }
});

app.delete("/api/v1/content", userMiddleware, async (req, res) => {
    try {
        // Validate request body
        const { contentId } = deleteContentSchema.parse(req.body);
        
        // Basic validation for MongoDB ObjectId format
        if (!contentId.match(/^[0-9a-fA-F]{24}$/)) {
            res.status(400).json({
                message: "Invalid content ID format"
            });
            return;
        }
        
        const result = await ContentModel.deleteOne({
            _id: contentId, 
            userId: req.userId
        });
        
        if (result.deletedCount === 0) {
            res.status(404).json({
                message: "Content not found or not authorized to delete"
            });
            return;
        }
        
        res.json({
            message: "Content deleted successfully"
        });
    } catch (error: unknown) {
        if (error instanceof z.ZodError) {
            res.status(400).json({
                message: "Validation error",
                errors: error.issues
            });
        } else {
            console.error("Delete error:", error);
            res.status(500).json({
                message: "Failed to delete content"
            });
        }
    }
});

app.post("/api/v1/brain/share", userMiddleware, async (req, res) => {
    try {
        // Validate request body
        const { share } = shareSchema.parse(req.body);
        
        if (share) {
            const existingLink = await LinkModel.findOne({
                userId: req.userId
            });

            if (existingLink) {
                res.json({
                    hash: existingLink.hash
                });
                return;
            }
            
            const hash = random(10);
            await LinkModel.create({
                userId: req.userId,
                hash: hash
            });

            res.json({
                hash
            });
        } else {
            await LinkModel.deleteOne({
                userId: req.userId
            });

            res.json({
                message: "Removed link"
            });
        }
    } catch(error: unknown) {
        if (error instanceof z.ZodError) {
            res.status(400).json({
                message: "Validation error",
                errors: error.issues
            });
        } else {
            console.error("Error sharing/unsharing brain:", error);
            res.status(500).json({
                message: "Failed to process share request"
            });
        }
    }
});

app.get("/api/v1/brain/:shareLink", async (req, res) => {
    try {
        const hash = req.params.shareLink;

        // Basic validation for hash parameter
        if (!hash || hash.length !== 10) {
            res.status(400).json({
                message: "Invalid share link format"
            });
            return;
        }

        const link = await LinkModel.findOne({
            hash
        });

        if (!link) {
            res.status(404).json({
                message: "Share link not found"
            });
            return;
        }
        
        // Get content for the user
        const content = await ContentModel.find({
            userId: link.userId
        });

        const user = await UserModel.findOne({
            _id: link.userId
        });

        if (!user) {
            res.status(404).json({
                message: "User not found"
            });
            return;
        }

        res.json({
            username: user.username,
            content: content
        });
    } catch(error: unknown) {
        console.error("Error fetching shared brain:", error);
        res.status(500).json({
            message: "Failed to fetch shared brain"
        });
    }
});

app.get("/health", (req, res) => {
    res.json({ status: "OK", timestamp: new Date().toISOString() });
});

const PORT = process.env.PORT || 3000;
app.listen(PORT, () => {
    console.log(`Server is running on port ${PORT}`);
});


/*import express from "express";
import { random } from "./utils";
import jwt from "jsonwebtoken";
import { ContentModel, LinkModel, UserModel } from "./db";
import { JWT_PASSWORD } from "./config";
import { userMiddleware } from "./middleware";
import cors from "cors";

const app = express();
app.use(express.json());
app.use(cors());

app.post("/api/v1/signup", async (req, res) => {
    // TODO: zod validation , hash the password
    const username = req.body.username;
    const password = req.body.password;

    try {
        await UserModel.create({
            username: username,
            password: password
        })
        
        res.json({
            message: "User signed up"
        })
    } catch(e) {
        res.status(411).json({
            message: "User already exists"
        })
    }
})

app.post("/api/v1/signin", async (req, res) => {
    const username = req.body.username;
    const password = req.body.password;

    const existingUser = await UserModel.findOne({
        username,
        password
    })
    if (existingUser) {
        const token = jwt.sign({
            id: existingUser._id
        }, JWT_PASSWORD)

        res.json({
            token
        })
    } else {
        res.status(403).json({
            message: "Incorrrect credentials"
        })
    }
})

app.post("/api/v1/content", userMiddleware, async (req, res) => {
    const link = req.body.link;
    const type = req.body.type;
    
    try {
        await ContentModel.create({
            link,
            type,
            title: req.body.title,
            userId: req.userId,
            tags: []
        })

        res.json({
            message: "Content added"
        })
    } catch(error) {
        console.error("Error adding content:", error);
        res.status(500).json({
            message: "Failed to add content"
        })
    }
})

app.get("/api/v1/content", userMiddleware, async (req, res) => {
    try {
        const userId = req.userId;
        const content = await ContentModel.find({
            userId: userId
        }).populate("userId", "username")
        
        res.json({
            content
        })
    } catch(error) {
        console.error("Error fetching content:", error);
        res.status(500).json({
            message: "Failed to fetch content"
        })
    }
})

app.delete("/api/v1/content/:contentId", userMiddleware, async (req, res) => {
    const contentId = req.params.contentId;
    
    try {
        const result = await ContentModel.deleteOne({
            _id: contentId, 
            userId: req.userId 
        });
        
        if (result.deletedCount === 0) {
            res.status(404).json({
                message: "Content not found or not authorized to delete"
            });
            return;
        }
        
        res.json({
            message: "Content deleted successfully"
        });
    } catch (error) {
        console.error("Delete error:", error);
        res.status(500).json({
            message: "Failed to delete content"
        });
    }
});

app.delete("/api/v1/content", userMiddleware, async (req, res) => {
    const contentId = req.body.contentId;
    
    try {
        const result = await ContentModel.deleteOne({
            _id: contentId, 
            userId: req.userId
        });
        
        if (result.deletedCount === 0) {
            res.status(404).json({
                message: "Content not found or not authorized to delete"
            });
            return;
        }
        
        res.json({
            message: "Content deleted successfully"
        });
    } catch (error) {
        console.error("Delete error:", error);
        res.status(500).json({
            message: "Failed to delete content"
        });
    }
})

app.post("/api/v1/brain/share", userMiddleware, async (req, res) => {
    const share = req.body.share;
    
    try {
        if (share) {
            const existingLink = await LinkModel.findOne({
                userId: req.userId
            });

            if (existingLink) {
                res.json({
                    hash: existingLink.hash
                })
                return;
            }
            
            const hash = random(10);
            await LinkModel.create({
                userId: req.userId,
                hash: hash
            })

            res.json({
                hash
            })
        } else {
            await LinkModel.deleteOne({
                userId: req.userId
            });

            res.json({
                message: "Removed link"
            })
        }
    } catch(error) {
        console.error("Error sharing/unsharing brain:", error);
        res.status(500).json({
            message: "Failed to process share request"
        })
    }
})

app.get("/api/v1/brain/:shareLink", async (req, res) => {
    const hash = req.params.shareLink;

    try {
        const link = await LinkModel.findOne({
            hash
        });

        if (!link) {
            res.status(404).json({
                message: "Share link not found"
            })
            return;
        }
        
        // Get content for the user
        const content = await ContentModel.find({
            userId: link.userId
        })

        console.log(link);
        const user = await UserModel.findOne({
            _id: link.userId
        })

        if (!user) {
            res.status(404).json({
                message: "User not found"
            })
            return;
        }

        res.json({
            username: user.username,
            content: content
        })
    } catch(error) {
        console.error("Error fetching shared brain:", error);
        res.status(500).json({
            message: "Failed to fetch shared brain"
        })
    }
})

app.listen(3000, () => {
    console.log("Server is running on port 3000");
}); */
