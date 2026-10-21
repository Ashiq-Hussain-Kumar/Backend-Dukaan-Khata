export const asyncHandler = (fn) => {
  return function (req, res, next) {
    return Promise.resolve()
      .then(() => fn(req, res, next))
      .catch(next);
  };
};
