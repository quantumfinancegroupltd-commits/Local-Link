export function roleHomePath(role) {
  switch (role) {
    case 'buyer':
      return '/buyer'
    case 'artisan':
      return '/artisan'
    case 'farmer':
      return '/farmer'
    case 'admin':
      return '/admin'
    default:
      return '/'
  }
}


