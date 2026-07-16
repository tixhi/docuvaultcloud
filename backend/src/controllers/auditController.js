const auditModel = require('../models/auditModel');
const { asyncHandler } = require('../middleware/errorHandler');

/** Admins/managers see the full system-wide log; everyone else sees only
 *  their own activity. */
const list = asyncHandler(async (req, res) => {
  const { limit, offset, action, from, to, userId } = req.query;
  const canSeeAll = ['admin', 'manager'].includes(req.user.role);

  const logs = await auditModel.list({
    limit: limit ? Number(limit) : 100,
    offset: offset ? Number(offset) : 0,
    actorId: canSeeAll ? userId : req.user.id,
    action,
    from,
    to,
  });

  res.json({ logs });
});

const myActivity = asyncHandler(async (req, res) => {
  const logs = await auditModel.forUser(req.user.id, 50);
  res.json({ logs });
});

module.exports = { list, myActivity };
