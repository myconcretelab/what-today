export function sourceColor(type) {
  switch (type) {
    case 'Airbnb':
      return '#E53935';
    case 'Abritel':
      return '#1976D2';
    case 'Gites de France':
      return '#FBC02D';
    case 'Direct':
      return '#424242';
    default:
      return '#9E9E9E';
  }
}

export function giteInitial(id) {
  switch (id) {
    case 'phonsine':
      return 'P';
    case 'edmond':
      return 'E';
    case 'liberte':
      return 'L';
    case 'gree':
      return 'G';
    default:
      return '?';
  }
}
