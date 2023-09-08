const { wrapHandlers } = require('../utils');
const { Build, BuildTask } = require('../models');

module.exports = wrapHandlers({
  find: async (req, res) => {
    const { params, user } = req;
    const { build_id: buildId, build_task_id: buildTaskId } = params;

    // the build check essentially serves as an authorizer
    const build = await Build.forSiteUser(user).findByPk(buildId);

    if (!build) {
      return res.notFound();
    }

    const task = await BuildTask.findOne({
      where: { buildId, id: buildTaskId },
      attributes: { exclude: ['token', 'deletedAt'] },
    });

    if (!task) {
      return res.notFound();
    }

    return res.json(task);
  },

  list: async (req, res) => {
    const { params, user } = req;
    const { build_id: buildId } = params;

    const build = await Build.forSiteUser(user).findByPk(buildId);

    if (!build) {
      return res.notFound();
    }

    const tasks = await BuildTask.findAll({
      where: { buildId },
      attributes: { exclude: ['token', 'deletedAt'] },
    });

    return res.json(tasks);
  },

  update: async (req, res) => {
    const { params, body } = req;
    const { build_task_id: buildTaskId, token } = params;

    const task = await BuildTask.findByPk(buildTaskId);

    if (!task) {
      return res.notFound();
    }
    if (task.token !== token) {
      return res.forbidden();
    }

    await task.update(body);

    return res.ok();
  },
});
