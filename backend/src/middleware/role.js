/**
 * Role-Based Access Control (RBAC).
 * Usage: router.get('/admin/stuff', authenticate, requireRole('admin'), handler)
 *
 * Roles, from least to most privileged: member < manager < admin.
 * requireRole accepts one or more roles that are explicitly allowed; it does
 * NOT assume a hierarchy by default, so be explicit (e.g. requireRole('admin','manager')).
 */
const ROLE_RANK = { member: 0, manager: 1, admin: 2 };

function requireRole(...allowedRoles) {
  return (req, res, next) => {
    if (!req.user) {
      return res.status(401).json({ error: 'Authentication required.' });
    }
    if (!allowedRoles.includes(req.user.role)) {
      return res.status(403).json({ error: 'You do not have permission to perform this action.' });
    }
    return next();
  };
}

/** Allows the resource owner OR any role at/above `minRole`. Handlers using
 *  this must first load the resource and set `req.resourceOwnerId`. */
function requireOwnerOrRole(minRole) {
  return (req, res, next) => {
    if (!req.user) return res.status(401).json({ error: 'Authentication required.' });
    const isOwner = req.resourceOwnerId && req.resourceOwnerId === req.user.id;
    const meetsRank = ROLE_RANK[req.user.role] >= ROLE_RANK[minRole];
    if (isOwner || meetsRank) return next();
    return res.status(403).json({ error: 'You do not have permission to perform this action.' });
  };
}

module.exports = { requireRole, requireOwnerOrRole, ROLE_RANK };
