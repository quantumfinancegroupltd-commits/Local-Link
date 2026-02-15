// Simple Express async error wrapper.
// Usage: router.get('/x', asyncHandler(async (req,res) => { ... }))
export function asyncHandler(fn) {
  return function wrapped(req, res, next) {
    Promise.resolve(fn(req, res, next)).catch(next)
  }
}


