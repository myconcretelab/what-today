import { useMemo } from 'react';
import dayjs from 'dayjs';
import { GITES } from '../utils';

function overlaps(start, end, res) {
  const resStart = dayjs(res.debut);
  const resEnd = dayjs(res.fin);
  return start.isBefore(resEnd) && end.isAfter(resStart);
}

export default function useAvailability(bookings, arrival, departure, range = 1) {
  return useMemo(() => {
    if (!arrival || !departure) return [];
    const arr = dayjs(arrival).startOf('day');
    const dep = dayjs(departure).startOf('day');
    const rangeStart = arr.subtract(range, 'day');
    const rangeEnd = dep.add(range, 'day');
    const days = [];
    for (let d = rangeStart; !d.isAfter(rangeEnd); d = d.add(1, 'day')) {
      days.push(d);
    }
    return GITES.map(g => {
      const segments = days.map(d => {
        const busy = bookings.some(b => b.giteId === g.id && overlaps(d, d.add(1, 'day'), b));
        return { date: d.format('YYYY-MM-DD'), busy };
      });
      const occupied = bookings.some(b => b.giteId === g.id && overlaps(arr, dep, b));
      return { id: g.id, name: g.name, free: !occupied, segments };
    });
  }, [bookings, arrival, departure, range]);
}
