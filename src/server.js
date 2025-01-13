import express from 'express';
import Keyv from 'keyv';
import { v4 as uuidv4 } from 'uuid';
import swaggerJsdoc from 'swagger-jsdoc';
import swaggerUi from 'swagger-ui-express';
import cors from 'cors';

const app = express();
const port = process.env.PORT || 3000;

// Initialize Keyv with SQLite
const memories = new Keyv('sqlite://memoryvault.sqlite', { namespace: 'memories' });
memories.on('error', err => console.error('Keyv connection error:', err));

// Middleware
app.use(cors());
app.use(express.json());

// Memory index for quick lookups
const memoryIndex = new Map();

// OpenAPI specification
const swaggerOptions = {
  definition: {
    openapi: '3.0.0',
    info: {
      title: 'Memory Vault API',
      version: '1.0.0',
      description: 'API for managing memories with ethical insights'
    },
    servers: [
      {
        url: `http://localhost:${port}`,
        description: 'Development server'
      }
    ]
  },
  apis: ['./src/server.js']
};

const swaggerSpec = swaggerJsdoc(swaggerOptions);
app.use('/api-docs', swaggerUi.serve, swaggerUi.setup(swaggerSpec));

/**
 * @swagger
 * /memories:
 *   post:
 *     summary: Create a new memory
 *     requestBody:
 *       required: true
 *       content:
 *         application/json:
 *           schema:
 *             type: object
 *             required:
 *               - content
 *             properties:
 *               content:
 *                 type: string
 *               tags:
 *                 type: array
 *                 items:
 *                   type: string
 *               sentiment:
 *                 type: string
 */
app.post('/memories', async (req, res) => {
  try {
    const { content, tags = [], sentiment = 'neutral' } = req.body;
    
    if (!content) {
      return res.status(400).json({ error: 'Content is required' });
    }

    const memory = {
      memoryId: uuidv4(),
      content,
      tags,
      sentiment,
      createdAt: new Date().toISOString()
    };

    await memories.set(memory.memoryId, memory);
    memoryIndex.set(memory.memoryId, memory);

    res.status(201).json(memory);
  } catch (error) {
    console.error('Error creating memory:', error);
    res.status(500).json({ error: 'Failed to create memory' });
  }
});

/**
 * @swagger
 * /memories:
 *   get:
 *     summary: List all memories
 */
app.get('/memories', async (req, res) => {
  try {
    const allMemories = Array.from(memoryIndex.values());
    res.json(allMemories);
  } catch (error) {
    res.status(500).json({ error: 'Failed to retrieve memories' });
  }
});

/**
 * @swagger
 * /memories/{memoryId}:
 *   get:
 *     summary: Get a specific memory
 *     parameters:
 *       - in: path
 *         name: memoryId
 *         required: true
 *         schema:
 *           type: string
 */
app.get('/memories/:memoryId', async (req, res) => {
  try {
    const memory = await memories.get(req.params.memoryId);
    if (!memory) {
      return res.status(404).json({ error: 'Memory not found' });
    }
    res.json(memory);
  } catch (error) {
    res.status(500).json({ error: 'Failed to retrieve memory' });
  }
});

/**
 * @swagger
 * /memories/{memoryId}:
 *   delete:
 *     summary: Delete a memory
 *     parameters:
 *       - in: path
 *         name: memoryId
 *         required: true
 *         schema:
 *           type: string
 */
app.delete('/memories/:memoryId', async (req, res) => {
  try {
    const exists = await memories.has(req.params.memoryId);
    if (!exists) {
      return res.status(404).json({ error: 'Memory not found' });
    }

    await memories.delete(req.params.memoryId);
    memoryIndex.delete(req.params.memoryId);
    
    res.status(204).send();
  } catch (error) {
    res.status(500).json({ error: 'Failed to delete memory' });
  }
});

/**
 * @swagger
 * /insights/ethical-core:
 *   post:
 *     summary: Generate ethical insights from memories
 *     requestBody:
 *       required: true
 *       content:
 *         application/json:
 *           schema:
 *             type: object
 *             properties:
 *               memoryIds:
 *                 type: array
 *                 items:
 *                   type: string
 */
app.post('/insights/ethical-core', async (req, res) => {
  try {
    const { memoryIds = [] } = req.body;
    
    // Fetch requested memories
    const selectedMemories = await Promise.all(
      memoryIds.map(id => memories.get(id))
    );

    // Simple ethical analysis based on content and sentiment
    const insights = {
      timestamp: new Date().toISOString(),
      analysis: {
        memoriesAnalyzed: selectedMemories.length,
        sentimentDistribution: selectedMemories.reduce((acc, memory) => {
          if (memory) {
            acc[memory.sentiment] = (acc[memory.sentiment] || 0) + 1;
          }
          return acc;
        }, {}),
        commonTags: [...new Set(
          selectedMemories
            .filter(m => m)
            .flatMap(m => m.tags)
        )],
        ethicalConsiderations: 'Generated ethical insights based on memory content'
      }
    };

    res.json(insights);
  } catch (error) {
    res.status(500).json({ error: 'Failed to generate insights' });
  }
});

// Initialize server
app.listen(port, () => {
  console.log(`Memory server running on port ${port}`);
  console.log(`API documentation available at http://localhost:${port}/api-docs`);
});