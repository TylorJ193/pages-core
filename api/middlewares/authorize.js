function authorize(roles) {
  return (req, res, next) => {
    if (!roles.includes(req.session.role)) {
      return res.forbidden();
    }
    return next();
  };
}

module.exports = authorize;
