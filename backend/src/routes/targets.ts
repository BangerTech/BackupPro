import { Router } from 'express';
import { v4 as uuidv4 } from 'uuid';
import { db } from '../db';

const router = Router();

// Get all targets
router.get('/', async (req, res) => {
  try {
    const result = await db.query(
      'SELECT * FROM targets ORDER BY created_at DESC'
    );
    res.json(result.rows);
  } catch (error) {
    console.error('Error fetching targets:', error);
    res.status(500).json({ error: 'Failed to fetch targets' });
  }
});

// Get a specific target
router.get('/:id', async (req, res) => {
  try {
    const { id } = req.params;
    const result = await db.query('SELECT * FROM targets WHERE id = $1', [id]);
    
    if (result.rows.length === 0) {
      return res.status(404).json({ error: 'Target not found' });
    }
    
    res.json(result.rows[0]);
  } catch (error) {
    console.error('Error fetching target:', error);
    res.status(500).json({ error: 'Failed to fetch target' });
  }
});

// Create a new target
router.post('/', async (req, res) => {
  try {
    const { name, type, config } = req.body;
    
    if (!name || !type) {
      return res.status(400).json({ error: 'Name and type are required' });
    }
    
    const id = uuidv4();
    const result = await db.query(
      'INSERT INTO targets (id, name, type, config, created_at, updated_at) VALUES ($1, $2, $3, $4, NOW(), NOW()) RETURNING *',
      [id, name, type, config || {}]
    );
    
    res.status(201).json(result.rows[0]);
  } catch (error) {
    console.error('Error creating target:', error);
    res.status(500).json({ error: 'Failed to create target' });
  }
});

// Update a target
router.put('/:id', async (req, res) => {
  try {
    const { id } = req.params;
    const { name, type, config } = req.body;
    
    if (!name || !type) {
      return res.status(400).json({ error: 'Name and type are required' });
    }
    
    const result = await db.query(
      'UPDATE targets SET name = $1, type = $2, config = $3, updated_at = NOW() WHERE id = $4 RETURNING *',
      [name, type, config || {}, id]
    );
    
    if (result.rows.length === 0) {
      return res.status(404).json({ error: 'Target not found' });
    }
    
    res.json(result.rows[0]);
  } catch (error) {
    console.error('Error updating target:', error);
    res.status(500).json({ error: 'Failed to update target' });
  }
});

// Delete a target
router.delete('/:id', async (req, res) => {
  try {
    const { id } = req.params;
    const result = await db.query('DELETE FROM targets WHERE id = $1 RETURNING *', [id]);
    
    if (result.rows.length === 0) {
      return res.status(404).json({ error: 'Target not found' });
    }
    
    res.json({ message: 'Target deleted successfully' });
  } catch (error) {
    console.error('Error deleting target:', error);
    res.status(500).json({ error: 'Failed to delete target' });
  }
});

export default router; 