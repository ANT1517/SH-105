const express = require('express');
const router = express.Router();
const { updateGoalProgress, getFinancialState, activeUserState } = require('../services/financialStateStore');
const { logEvent } = require('../services/auditLogger');

/**
 * GET /api/goals
 * Returns active goals, progress, and derivable remaining amount.
 */
router.get('/', (req, res) => {
  const goal = activeUserState.goal;
  const target = Number(goal.target) || 0;
  const saved = Number(goal.saved) || 0;
  const remaining = Math.max(0, target - saved);
  const progressPercentage = target > 0 ? Math.round((saved / target) * 100) : 0;

  return res.status(200).json({
    user_id: activeUserState.user_id,
    goal: {
      name: goal.name,
      target,
      saved
    },
    remaining,
    progress_percentage: progressPercentage
  });
});

/**
 * POST /api/goals
 * Creates or resets a goal.
 */
router.post('/', async (req, res) => {
  try {
    const { user_id = 'meera_001', name, target_amount, saved_amount = 0 } = req.body;

    if (!name || typeof name !== 'string' || name.trim() === '') {
      return res.status(400).json({ error: 'Goal name is required and must be a non-empty string' });
    }

    if (target_amount === undefined || target_amount === null || isNaN(Number(target_amount))) {
      return res.status(400).json({ error: 'target_amount must be a valid number' });
    }

    const target = Number(target_amount);
    if (target <= 0) {
      return res.status(400).json({ error: 'target_amount must be greater than zero' });
    }

    const saved = Number(saved_amount);
    if (isNaN(saved) || saved < 0) {
      return res.status(400).json({ error: 'saved_amount must be a non-negative number' });
    }

    const previousGoal = { ...activeUserState.goal };
    activeUserState.goal = {
      name: name.trim(),
      target,
      saved
    };

    await logEvent({
      user_id,
      action: 'GOAL_CREATED',
      entity_type: 'goal',
      entity_id: name.trim(),
      previous_state: previousGoal,
      new_state: activeUserState.goal,
      metadata: { target, saved }
    });

    const remaining = Math.max(0, target - saved);
    const progressPercentage = target > 0 ? Math.round((saved / target) * 100) : 0;

    return res.status(201).json({
      status: 'success',
      message: 'Goal created successfully',
      goal: activeUserState.goal,
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
 */
router.post('/progress', async (req, res) => {
  try {
    const { user_id = 'meera_001', saved_delta, target_amount } = req.body;
    
    if (saved_delta === undefined || saved_delta === null || isNaN(Number(saved_delta))) {
      return res.status(400).json({ error: 'saved_delta must be a valid number' });
    }

    if (target_amount !== undefined && (isNaN(Number(target_amount)) || Number(target_amount) <= 0)) {
      return res.status(400).json({ error: 'target_amount must be a positive number if provided' });
    }

    const previousGoal = { ...activeUserState.goal };
    const updatedGoal = await updateGoalProgress(user_id, Number(saved_delta), target_amount);

    await logEvent({
      user_id,
      action: 'GOAL_UPDATED',
      entity_type: 'goal',
      entity_id: updatedGoal.name,
      previous_state: previousGoal,
      new_state: updatedGoal,
      metadata: { saved_delta }
    });

    const state = await getFinancialState(user_id);
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
 */
router.patch('/:id?', async (req, res) => {
  try {
    const { user_id = 'meera_001', name, target_amount, saved_amount } = req.body;

    if (target_amount !== undefined && (isNaN(Number(target_amount)) || Number(target_amount) <= 0)) {
      return res.status(400).json({ error: 'target_amount must be a positive number' });
    }

    if (saved_amount !== undefined && (isNaN(Number(saved_amount)) || Number(saved_amount) < 0)) {
      return res.status(400).json({ error: 'saved_amount must be a non-negative number' });
    }

    if (name !== undefined && (typeof name !== 'string' || name.trim() === '')) {
      return res.status(400).json({ error: 'Goal name must be a non-empty string' });
    }

    const previousGoal = { ...activeUserState.goal };
    if (name) activeUserState.goal.name = name.trim();
    if (target_amount !== undefined) activeUserState.goal.target = Number(target_amount);
    if (saved_amount !== undefined) activeUserState.goal.saved = Number(saved_amount);

    await logEvent({
      user_id,
      action: 'GOAL_UPDATED',
      entity_type: 'goal',
      entity_id: activeUserState.goal.name,
      previous_state: previousGoal,
      new_state: activeUserState.goal
    });

    const remaining = Math.max(0, activeUserState.goal.target - activeUserState.goal.saved);
    const progressPercentage = activeUserState.goal.target > 0 ? Math.round((activeUserState.goal.saved / activeUserState.goal.target) * 100) : 0;

    return res.status(200).json({
      status: 'success',
      message: 'Goal updated successfully',
      goal: activeUserState.goal,
      remaining,
      progress_percentage: progressPercentage
    });
  } catch (err) {
    console.error('[Goals Route] Error:', err.message);
    return res.status(500).json({ error: 'Internal server error updating goal' });
  }
});

module.exports = router;
