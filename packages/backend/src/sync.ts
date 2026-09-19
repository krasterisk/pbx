// Historical entry point intentionally disabled. It previously targeted a
// fixed database and called sync({ alter: true }), bypassing migration history.
// Use the explicit, reviewed versioned runner for either supported engine.
throw new Error('Legacy schema sync is disabled; use npm run db:migrate:status and npm run db:migrate');
