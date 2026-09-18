const express = require('express');
const router = express.Router();
const {
  getActiveGoal,
  createGoal,
  updateGoalProgress,
  getFinancialState,
  activeUserState,
  syncGoalMemory
} = require('../services/financialStateStore');
const { logEvent, syncAuditLogToMemory } = require('../services/auditLogger');
const { executeTransaction, isConnected } = require('../db/db');

/**
 * GET /api/goals
 * Returns active goals, progress, and derivable remaining amount.
 * Reads real DB state when connected. READ-ONLY — no mutations.
 */
router.get('/', async (req, res) => {
  try {
    const userId = req.query.user_id || 'meera_001';
    const goal = await getActiveGoal(userId);
    const target = Number(goal.target) || 0;
    const saved = Number(goal.saved) || 0;
    const remaining = Math.max(0, target - saved);
    const progressPercentage = target > 0 ? Math.round((saved / target) * 100) : 0;

    return res.status(200).json({
      user_id: userId,
      goal: {
        name: goal.name,
        target,
        saved
      },
      remaining,
      progress_percentage: progressPercentage
    });
  } catch (err) {
    console.error('[Goals Route] GET Error:', err.message);
    return res.status(500).json({ error: 'Internal server error fetching goals' });
  }
});

/**
 * POST /api/goals
 * Creates or resets a goal.
 * Goal DB write + audit log share ONE transaction — either both commit or both roll back.
 */
router.post('/', async (req, res) => {
  try {
    const { user_id = 'meera_001', name, target_amount, saved_amount = 0 } = req.body;

    if (user_id !== undefined && (typeof user_id !== 'string' || user_id.trim() === '')) {
      return res.status(400).json({ error: 'user_id must be a non-empty string if provided' });
    }

    if (!name || typeof name !== 'string' || name.trim() === '') {
      return res.status(400).json({ error: 'Goal name is required and must be a non-empty string' });
    }

    if (target_amount === undefined || target_amount === null || isNaN(Number(target_amount))) {
      return res.status(400).json({ error: 'target_amount must be a valid number' });
    }

    const target = Number(target_amount);
    if (!isFinite(target) || isNaN(target) || target <= 0) {
      return res.status(400).json({ error: 'target_amount must be a finite number greater than zero' });
    }

    const saved = Number(saved_amount);
    if (!isFinite(saved) || isNaN(saved) || saved < 0) {
      return res.status(400).json({ error: 'saved_amount must be a non-negative finite number' });
    }

    const trimmedUserId = user_id ? user_id.trim() : 'meera_001';
    const trimmedName = name.trim();
    const previousGoal = { ...activeUserState.goal };

    let newGoal = null;
    let auditEntry = null;

    if (isConnected()) {
      await executeTransaction(async (client) => {
        // a. Ensure user exists
        await client.query(
          `INSERT INTO users (id, name) VALUES ($1, $2) ON CONFLICT (id) DO NOTHING`,
          [trimmedUserId, trimmedUserId]
        );

        // b. Deactivate previous goals
        await client.query(
          `UPDATE goals SET is_active = false, updated_at = NOW()
           WHERE user_id = $1 AND is_active = true`,
          [trimmedUserId]
        );

        // c. Insert new active goal
        await client.query(
          `INSERT INTO goals (user_id, name, target_amount, saved_amount, is_active, created_at, updated_at)
           VALUES ($1, $2, $3, $4, true, NOW(), NOW())`,
          [trimmedUserId, trimmedName, target, saved]
        );

        newGoal = { name: trimmedName, target, saved };

        // d. Audit — same transaction
        auditEntry = await logEvent({
          user_id: trimmedUserId,
          action: 'GOAL_CREATED',
          entity_type: 'goal',
          entity_id: trimmedName,
          previous_state: previousGoal,
          new_state: newGoal,
          metadata: { target, saved },
          client
        });
      });

      // Sync memory ONLY after commit
      if (newGoal) syncGoalMemory(newGoal);
      if (auditEntry) syncAuditLogToMemory(auditEntry);
    } else {
      // Offline / mock fallback
      newGoal = await createGoal(trimmedUserId, { name: trimmedName, target, saved });
      await logEvent({
        user_id: trimmedUserId,
        action: 'GOAL_CREATED',
        entity_type: 'goal',
        entity_id: trimmedName,
        previous_state: previousGoal,
        new_state: newGoal,
        metadata: { target, saved }
      });
    }

    const remaining = Math.max(0, target - saved);
    const progressPercentage = target > 0 ? Math.round((saved / target) * 100) : 0;

    return res.status(201).json({
      status: 'success',
      message: 'Goal created successfully',
      goal: newGoal,
      remaining,
      progress_percentage: progressPercentage
    });
  } catch (err) {
    console.error('[Goals Route] Error:', err.message);
    return res.status(500).json({ error: 'Internal server error creating goal' });
  }
});

/**
 * POST /api/goals/progress
 * Adds savings progress delta to the user's goal.
 * DB update + audit share ONE transaction.
 */
router.post('/progress', async (req, res) => {
  try {
    const { user_id = 'meera_001', saved_delta, target_amount } = req.body;

    if (user_id !== undefined && (typeof user_id !== 'string' || user_id.trim() === '')) {
      return res.status(400).json({ error: 'user_id must be a non-empty string if provided' });
    }

    if (saved_delta === undefined || saved_delta === null || isNaN(Number(saved_delta)) || !isFinite(Number(saved_delta))) {
      return res.status(400).json({ error: 'saved_delta must be a finite number' });
    }

    if (target_amount !== undefined && (isNaN(Number(target_amount)) || !isFinite(Number(target_amount)) || Number(target_amount) <= 0)) {
      return res.status(400).json({ error: 'target_amount must be a positive finite number if provided' });
    }

    const trimmedUserId = user_id ? user_id.trim() : 'meera_001';
    const previousGoal = { ...activeUserState.goal };

    let updatedGoal = null;
    let auditEntry = null;

    if (isConnected()) {
      await executeTransaction(async (client) => {
        // a. Ensure user exists
        await client.query(
          `INSERT INTO users (id, name) VALUES ($1, $2) ON CONFLICT (id) DO NOTHING`,
          [trimmedUserId, trimmedUserId]
        );

        // b. Fetch current active goal
        const existing = await client.query(
          `SELECT id, name, target_amount, saved_amount
           FROM goals WHERE user_id = $1 AND is_active = true
           ORDER BY updated_at DESC, id DESC LIMIT 1
           FOR UPDATE`,
          [trimmedUserId]
        );

        let name, newSaved, newTarget;
        if (existing.rows.length > 0) {
          const row = existing.rows[0];
          newSaved = Number(row.saved_amount) + Number(saved_delta);
          newTarget = target_amount !== undefined ? Number(target_amount) : Number(row.target_amount);
          name = row.name;

          await client.query(
            `UPDATE goals SET saved_amount = $1, target_amount = $2, updated_at = NOW() WHERE id = $3`,
            [newSaved, newTarget, row.id]
          );
        } else {
          // No active goal found — create one from in-memory fallback
          newSaved = Number(activeUserState.goal.saved || 0) + Number(saved_delta);
          newTarget = target_amount !== null && target_amount !== undefined
            ? Number(target_amount)
            : Number(activeUserState.goal.target || 0);
          name = activeUserState.goal.name || 'Savings Goal';

          await client.query(
            `INSERT INTO goals (user_id, name, target_amount, saved_amount, is_active, created_at, updated_at)
             VALUES ($1, $2, $3, $4, true, NOW(), NOW())`,
            [trimmedUserId, name, newTarget, newSaved]
          );
        }

        updatedGoal = { name, target: newTarget, saved: newSaved };

        // c. Audit — same transaction
        auditEntry = await logEvent({
          user_id: trimmedUserId,
          action: 'GOAL_UPDATED',
          entity_type: 'goal',
          entity_id: name,
          previous_state: previousGoal,
          new_state: updatedGoal,
          metadata: { saved_delta },
          client
        });
      });

      // Sync memory ONLY after commit
      if (updatedGoal) syncGoalMemory(updatedGoal);
      if (auditEntry) syncAuditLogToMemory(auditEntry);
    } else {
      // Offline / mock fallback
      updatedGoal = await updateGoalProgress(trimmedUserId, Number(saved_delta), target_amount);
      await logEvent({
        user_id: trimmedUserId,
        action: 'GOAL_UPDATED',
        entity_type: 'goal',
        entity_id: updatedGoal.name,
        previous_state: previousGoal,
        new_state: updatedGoal,
        metadata: { saved_delta }
      });
    }

    const state = await getFinancialState(trimmedUserId);
    const target = Number(updatedGoal.target);
    const saved = Number(updatedGoal.saved);
    const remaining = Math.max(0, target - saved);
    const progressPercentage = target > 0 ? Math.round((saved / target) * 100) : 0;

    return res.status(200).json({
      status: 'success',
      message: 'Goal progress updated successfully',
      goal: updatedGoal,
      remaining,
      progress_percentage: progressPercentage,
      updated_financial_state: state
    });
  } catch (err) {
    console.error('[Goals Route] Error:', err.message);
    return res.status(500).json({ error: 'Internal server error updating goal' });
  }
});

/**
 * PATCH /api/goals/:id or /api/goals
 * Updates goal properties.
 * DB update + audit share ONE transaction.
 */
router.patch('/:id?', async (req, res) => {
  try {
    const { user_id = 'meera_001', name, target_amount, saved_amount } = req.body;

    if (user_id !== undefined && (typeof user_id !== 'string' || user_id.trim() === '')) {
      return res.status(400).json({ error: 'user_id must be a non-empty string if provided' });
    }

    if (target_amount !== undefined && (isNaN(Number(target_amount)) || !isFinite(Number(target_amount)) || Number(target_amount) <= 0)) {
      return res.status(400).json({ error: 'target_amount must be a positive finite number' });
    }

    if (saved_amount !== undefined && (isNaN(Number(saved_amount)) || !isFinite(Number(saved_amount)) || Number(saved_amount) < 0)) {
      return res.status(400).json({ error: 'saved_amount must be a non-negative finite number' });
    }

    if (name !== undefined && (typeof name !== 'string' || name.trim() === '')) {
      return res.status(400).json({ error: 'Goal name must be a non-empty string' });
    }

    const trimmedUserId = user_id ? user_id.trim() : 'meera_001';
    const currentGoal = await getActiveGoal(trimmedUserId);
    const newName = name !== undefined ? name.trim() : currentGoal.name;
    const newTarget = target_amount !== undefined ? Number(target_amount) : currentGoal.target;
    const newSaved = saved_amount !== undefined ? Number(saved_amount) : currentGoal.saved;

    let updatedGoal = null;
    let auditEntry = null;

    if (isConnected()) {
      await executeTransaction(async (client) => {
        await client.query(
          `INSERT INTO users (id, name) VALUES ($1, $2) ON CONFLICT (id) DO NOTHING`,
          [trimmedUserId, trimmedUserId]
        );

        await client.query(
          `UPDATE goals SET is_active = false, updated_at = NOW()
           WHERE user_id = $1 AND is_active = true`,
          [trimmedUserId]
        );

        await client.query(
          `INSERT INTO goals (user_id, name, target_amount, saved_amount, is_active, created_at, updated_at)
           VALUES ($1, $2, $3, $4, true, NOW(), NOW())`,
          [trimmedUserId, newName, newTarget, newSaved]
        );

        updatedGoal = { name: newName, target: newTarget, saved: newSaved };

        auditEntry = await logEvent({
          user_id: trimmedUserId,
          action: 'GOAL_UPDATED',
          entity_type: 'goal',
          entity_id: newName,
          previous_state: currentGoal,
          new_state: updatedGoal,
          client
        });
      });

      if (updatedGoal) syncGoalMemory(updatedGoal);
      if (auditEntry) syncAuditLogToMemory(auditEntry);
    } else {
      updatedGoal = await createGoal(trimmedUserId, { name: newName, target: newTarget, saved: newSaved });
      await logEvent({
        user_id: trimmedUserId,
        action: 'GOAL_UPDATED',
        entity_type: 'goal',
        entity_id: updatedGoal.name,
        previous_state: currentGoal,
        new_state: updatedGoal
      });
    }

    const remaining = Math.max(0, updatedGoal.target - updatedGoal.saved);
    const progressPercentage = updatedGoal.target > 0 ? Math.round((updatedGoal.saved / updatedGoal.target) * 100) : 0;

    return res.status(200).json({
      status: 'success',
      message: 'Goal updated successfully',
      goal: updatedGoal,
      remaining,
      progress_percentage: progressPercentage
    });
  } catch (err) {
    console.error('[Goals Route] Error:', err.message);
    return res.status(500).json({ error: 'Internal server error updating goal' });
  }
});

module.exports = router;
