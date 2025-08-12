export const COLORS = {
  sources: {
    Airbnb: '#E53935',
    Abritel: '#1976D2',
    'Gites de France': '#FBC02D',
    Direct: '#424242',
    default: '#9E9E9E'
  },
  events: {
    arrival: '#faf3dd',
    depart: '#b8f2e6',
    both: '#ffa69e',
    done: '#aed9e0'
  }
};

export const GITES = [
  { id: 'phonsine', name: 'Gîte de Phonsine' },
  { id: 'liberte', name: 'Gîte Le Liberté' },
  { id: 'gree', name: 'Gîte de la Grée' },
  { id: 'edmond', name: "Gîte de l'oncle Edmond" }
];

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

export const BORDER = {
  widths: {
    arrival: 3,
    depart: 1,
    both: 2
  },
  colors: {
    arrival: COLORS.events.arrival,
    depart: COLORS.events.depart,
    both: COLORS.events.both
  },
  status: {
    done: COLORS.events.done,
    pending: COLORS.events.depart
  }
};

export function borderWidth(type) {
  return BORDER.widths[type] || BORDER.widths.both;
}

export function borderColor(type) {
  return BORDER.colors[type] || BORDER.colors.both;
}

export function statusBorderColor(done) {
  return done ? BORDER.status.done : BORDER.status.pending;
}
