export function roleHomePath(role) {
  switch (role) {
    case 'buyer':
      return '/buyer'
    case 'artisan':
      return '/artisan'
    case 'farmer':
      return '/farmer'
    case 'driver':
      return '/driver'
    case 'company':
      return '/company'
    case 'admin':
      return '/admin'
    default:
      return '/'
  }
}


