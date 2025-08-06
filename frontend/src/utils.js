export const COLORS = {
  sources: {
    Airbnb: '#E53935',
    Abritel: '#1976D2',
    'Gites de France': '#FBC02D',
    Direct: '#424242',
    default: '#9E9E9E'
  },
  events: {
    arrival: '#2e7d32',
    depart: '#d32f2f',
    both: '#e1bee7'
  }
};

export function sourceColor(type) {
  return COLORS.sources[type] || COLORS.sources.default;
}

export function eventColor(type) {
  return COLORS.events[type] || COLORS.events.both;
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
