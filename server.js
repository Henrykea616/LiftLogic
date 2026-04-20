import express, { json } from "express";
import cors from "cors";
import { config } from "dotenv";
import { MongoClient, ObjectId } from "mongodb";
import bcrypt from "bcrypt";
import jwt from "jsonwebtoken";

config();

const app = express();
const PORT = process.env.PORT || 3000;

app.use(cors());
app.use(json());

const client = new MongoClient(process.env.MONGODB_URI);

let db;
let usersCollection;
let routinesCollection;

// ===== AUTH MIDDLEWARE =====
function authMiddleware(req, res, next) {
    const authHeader = req.headers.authorization;

    if (!authHeader || !authHeader.startsWith("Bearer ")) {
        return res.status(401).json({ error: "Missing token" });
    }

    const token = authHeader.split(" ")[1];

    try {
        const decoded = jwt.verify(token, process.env.JWT_SECRET);
        req.user = decoded;
        next();
    } catch (error) {
        return res.status(401).json({ error: "Invalid token" });
    }
}

// ===== BASIC ROUTE =====
app.get("/", (req, res) => {
    res.json({ message: "LiftLogic API is running" });
});

// ===== AUTH ROUTES =====
app.post("/auth/signup", async (req, res) => {
    try {
        const { email, password } = req.body;

        if (!email || !password) {
            return res.status(400).json({
                error: "Email and password are required"
            });
        }

        if (password.length < 6) {
            return res.status(400).json({
                error: "Password must be at least 6 characters"
            });
        }

        const normalizedEmail = email.trim().toLowerCase();

        const existingUser = await usersCollection.findOne({
            email: normalizedEmail
        });

        if (existingUser) {
            return res.status(409).json({
                error: "User already exists"
            });
        }

        const passwordHash = await bcrypt.hash(password, 10);

        const result = await usersCollection.insertOne({
            email: normalizedEmail,
            passwordHash,
            createdAt: new Date().toISOString()
        });

        return res.status(201).json({
            message: "User created",
            userId: result.insertedId.toString()
        });
    } catch (error) {
        console.error("Signup error:", error);
        return res.status(500).json({ error: "Signup failed" });
    }
});

app.post("/auth/login", async (req, res) => {
    try {
        const { email, password } = req.body;

        if (!email || !password) {
            return res.status(400).json({
                error: "Email and password are required"
            });
        }

        const normalizedEmail = email.trim().toLowerCase();

        const user = await usersCollection.findOne({
            email: normalizedEmail
        });

        if (!user) {
            return res.status(401).json({ error: "Invalid credentials" });
        }

        const matches = await bcrypt.compare(password, user.passwordHash);

        if (!matches) {
            return res.status(401).json({ error: "Invalid credentials" });
        }

        const token = jwt.sign(
            {
                userId: user._id.toString(),
                email: user.email
            },
            process.env.JWT_SECRET,
            { expiresIn: "7d" }
        );

        return res.json({ token });
    } catch (error) {
        console.error("Login error:", error);
        return res.status(500).json({ error: "Login failed" });
    }
});

// ===== ROUTINE ROUTES =====
app.get("/api/routines", authMiddleware, async (req, res) => {
    try {
        const routines = await routinesCollection
            .find({ userId: req.user.userId })
            .toArray();

        return res.json(routines);
    } catch (error) {
        console.error("Load routines error:", error);
        return res.status(500).json({ error: "Failed to load routines" });
    }
});

app.post("/api/routines", authMiddleware, async (req, res) => {
    try {
        const { name } = req.body;

        if (!name || !name.trim()) {
            return res.status(400).json({
                error: "Routine name is required"
            });
        }

        const newRoutine = {
            userId: req.user.userId,
            id: new ObjectId().toString(),
            name: name.trim(),
            weeks: [
                {
                    weekNumber: 1,
                    date: new Date().toLocaleDateString(),
                    completed: false,
                    completedAt: "",
                    exercises: []
                }
            ],
            createdAt: new Date().toISOString()
        };

        await routinesCollection.insertOne(newRoutine);

        return res.status(201).json(newRoutine);
    } catch (error) {
        console.error("Create routine error:", error);
        return res.status(500).json({ error: "Failed to create routine" });
    }
});

app.put("/api/routines/:id", authMiddleware, async (req, res) => {
    try {
        const routineId = req.params.id;
        const { name } = req.body;

        if (!name || !name.trim()) {
            return res.status(400).json({
                error: "Routine name is required"
            });
        }

        const result = await routinesCollection.findOneAndUpdate(
            {
                id: routineId,
                userId: req.user.userId
            },
            {
                $set: {
                    name: name.trim()
                }
            },
            {
                returnDocument: "after"
            }
        );

        if (!result) {
            return res.status(404).json({ error: "Routine not found" });
        }

        return res.json(result);
    } catch (error) {
        console.error("Update routine error:", error);
        return res.status(500).json({ error: "Failed to update routine" });
    }
});

app.delete("/api/routines/:id", authMiddleware, async (req, res) => {
    try {
        const routineId = req.params.id;

        const result = await routinesCollection.deleteOne({
            id: routineId,
            userId: req.user.userId
        });

        if (result.deletedCount === 0) {
            return res.status(404).json({ error: "Routine not found" });
        }

        return res.json({ message: "Routine deleted" });
    } catch (error) {
        console.error("Delete routine error:", error);
        return res.status(500).json({ error: "Failed to delete routine" });
    }
});

// ===== START SERVER =====
async function startServer() {
    try {
        await client.connect();

        db = client.db("liftlogic");
        usersCollection = db.collection("users");
        routinesCollection = db.collection("routines");

        console.log("Connected to MongoDB");

        app.listen(PORT, () => {
            console.log(`Server running on port ${PORT}`);
        });
    } catch (error) {
        console.error("Failed to start server:", error);
    }
}

startServer();