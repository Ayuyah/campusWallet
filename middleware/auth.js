// Middleware to protect routes — checks if user is logged in
// Full implementation added in Phase 1

module.exports = (req, res, next) => {
  if (req.session && req.session.userId) {
    return next(); // logged in — continue to the route
  }
  res.status(401).json({ error: 'Not logged in' });
};