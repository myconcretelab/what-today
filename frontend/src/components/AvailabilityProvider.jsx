import React, { createContext, useContext, useEffect, useState } from 'react';
import dayjs from 'dayjs';
import 'dayjs/locale/fr';
import isSameOrAfter from 'dayjs/plugin/isSameOrAfter';
import useAvailability from '../hooks/useAvailability';
import {
  SAVE_RESERVATION,
  fetchSchoolHolidays,
  fetchPublicHolidays,
  fetchPrices,
  fetchTexts
} from '../services/api';

const GITE_LABELS = {
  phonsine: 'de Tante Phonsine à Néant sur Yvel',
  gree: 'de la Grée à Néant sur Yvel',
  edmond: "de l'Oncle Edmond à Néant sur Yvel",
  liberte: 'du Liberté à Mauron'
};

const GITE_ADDRESSES = {
  liberte: '1 place de la Liberté, 56430 Mauron.',
  phonsine: '5 Tlohan, 56430 Néant sur Yvel.',
  edmond: '9 Tlohan, 56430 Néant sur Yvel.',
  gree: '2 rue de la Grée des Horets'
};

const GITE_LINKS = {
  liberte: 'https://www.airbnb.fr/multicalendar/48504640',
  gree: 'https://www.airbnb.fr/multicalendar/16674752',
  phonsine: 'https://www.airbnb.fr/multicalendar/6668903',
  edmond: 'https://www.airbnb.fr/multicalendar/43504621'
};

const GITE_OCCUPANCY_LIMITS = {
  phonsine: { adults: 4, children: 2 },
  gree: { adults: 4, children: 2 },
  edmond: { adults: 2, children: 0 },
  liberte: { adults: 15, children: 10 }
};

dayjs.extend(isSameOrAfter);
dayjs.locale('fr');

export const AvailabilityContext = createContext(null);

export function AvailabilityProvider({ bookings, children }) {
  const [arrival, setArrival] = useState(dayjs());
  const [departure, setDeparture] = useState(dayjs().add(1, 'day'));
  const [selectedGite, setSelectedGite] = useState(null);
  const [info, setInfo] = useState('');
  const [name, setName] = useState('');
  const [phone, setPhone] = useState('');
  const [singleBeds, setSingleBeds] = useState(0);
  const [doubleBeds, setDoubleBeds] = useState(0);
  const [adultCount, setAdultCount] = useState(0);
  const [childCount, setChildCount] = useState(0);
  const [includeBedding, setIncludeBedding] = useState(false);
  const [anchorEl, setAnchorEl] = useState(null);
  const availability = useAvailability(bookings, arrival, departure, 1);
  const [holidayDates, setHolidayDates] = useState(new Set());
  const [publicHolidayDates, setPublicHolidayDates] = useState(new Set());
  const [saving, setSaving] = useState(false);
  const [saveError, setSaveError] = useState(false);
  const [airbnbUrl, setAirbnbUrl] = useState(null);
  const [savedForRange, setSavedForRange] = useState(false);
  const [prices, setPrices] = useState([]);
  const [selectedPrice, setSelectedPrice] = useState('');
  const [texts, setTexts] = useState([]);
  const [selectedTexts, setSelectedTexts] = useState([]);

  useEffect(() => {
    const parts = [];
    if (name) parts.push(`N: ${name}`);
    if (phone) parts.push(`T: ${phone}`);
    if (adultCount > 0) parts.push(`Adultes: ${adultCount}`);
    if (childCount > 0) parts.push(`Enfants: ${childCount}`);
    if (includeBedding && singleBeds > 0) parts.push(`Lits simples: ${singleBeds}`);
    if (includeBedding && doubleBeds > 0) parts.push(`Lits doubles: ${doubleBeds}`);
    setInfo(parts.join('\n'));
  }, [name, phone, singleBeds, doubleBeds, adultCount, childCount, includeBedding]);

  useEffect(() => {
    fetchSchoolHolidays()
      .then(data => {
        const dates = new Set();
        data.forEach(h => {
          let d = dayjs(h.start);
          const end = dayjs(h.end);
          for (; !d.isAfter(end, 'day'); d = d.add(1, 'day')) {
            dates.add(d.format('YYYY-MM-DD'));
          }
        });
        setHolidayDates(dates);
      })
      .catch(() => {});
  }, []);

  useEffect(() => {
    fetchPublicHolidays()
      .then(data => {
        setPublicHolidayDates(new Set(Object.keys(data)));
      })
      .catch(() => {});
  }, []);

  useEffect(() => {
    fetchPrices()
      .then(data => setPrices(data))
      .catch(() => {});
  }, []);

  useEffect(() => {
    fetchTexts()
      .then(data => setTexts(data))
      .catch(() => {});
  }, []);

  useEffect(() => {
    if (selectedGite) {
      const opts = prices.filter(p => p.gites.includes(selectedGite.id));
      setSelectedPrice(opts.length ? String(opts[0].amount) : 'other');
    } else {
      setSelectedPrice('');
    }
  }, [selectedGite, prices]);

  useEffect(() => {
    if (!selectedGite) return;
    const limits = GITE_OCCUPANCY_LIMITS[selectedGite.id];
    if (!limits) return;
    setAdultCount(prev => Math.min(prev, limits.adults));
    setChildCount(prev => Math.min(prev, limits.children));
  }, [selectedGite]);

  const handlePhoneChange = e => {
    const digits = e.target.value.replace(/\D/g, '').slice(0, 10);
    const formatted = digits.replace(/(\d{2})(?=\d)/g, '$1 ').trim();
    setPhone(formatted);
  };

  const handleOpenPicker = event => {
    setAnchorEl(event.currentTarget);
  };

  const handleClosePicker = () => {
    setAnchorEl(null);
  };

  const handleRangeChange = newRange => {
    if (!newRange.startDate || !newRange.endDate) return;
    setArrival(dayjs(newRange.startDate));
    setDeparture(dayjs(newRange.endDate));
    setAirbnbUrl(null);
    setSaveError(false);
    setSaving(false);
    setSavedForRange(false);
  };

  const handleReserve = (g, onGoto) => {
    setSelectedGite(g);
    setAirbnbUrl(null);
    setSaveError(false);
    setSaving(false);
    setSavedForRange(false);
    if (onGoto) onGoto();
  };

  const handleSave = () => {
    if (!selectedGite) return;
    setSaving(true);
    setSaveError(false);
    setAirbnbUrl(null);

    navigator.clipboard?.writeText(info).catch(() => {});

    (async () => {
      const payload = {
        giteId: selectedGite.id,
        name,
        start: arrival.format('DD/MM/YYYY'),
        end: departure.format('DD/MM/YYYY'),
        summary: info.replace(/\n/g, ' '),
        phone
      };
      const priceNum = selectedPrice && selectedPrice !== 'other' ? Number(selectedPrice) : null;
      if (priceNum != null) payload.price = priceNum;

      try {
        const res = await fetch(SAVE_RESERVATION, {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify(payload)
        });
        if (!res.ok) throw new Error('save failed');

        const start = arrival.format('YYYY-MM-DD');
        const end = departure.subtract(1, 'day').format('YYYY-MM-DD');
        const link = GITE_LINKS[selectedGite.id];
        const url = link ? `${link}/edit-selected-dates/${start}/${end}` : null;
        setAirbnbUrl(url);
        setSavedForRange(true);
      } catch (e) {
        setSaveError(true);
      } finally {
        setSaving(false);
      }
    })();
  };

  const renderDayContent = date => {
    const formatted = dayjs(date).format('YYYY-MM-DD');
    const isVacation = holidayDates.has(formatted);
    const isPublicHoliday = publicHolidayDates.has(formatted);
    const d = dayjs(date);
    const isSelected = !d.isBefore(arrival, 'day') && !d.isAfter(departure, 'day');

    let backgroundColor;
    if (isSelected && isPublicHoliday) {
      backgroundColor = '#8a73fbff';
    } else if (isPublicHoliday) {
      backgroundColor = '#ffe1a5ff';
    } else if (isSelected && isVacation) {
      backgroundColor = '#8a73fbff';
    } else if (isVacation) {
      backgroundColor = '#ffe1a5ff';
    }

    return (
      <div
        style={{
          width: '100%',
          height: '100%',
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'center',
          backgroundColor,
          color: isSelected ? '#fff' : '#555',
          borderRadius: '5%'
        }}
      >
        {d.date()}
      </div>
    );
  };

  const nightCount = departure.diff(arrival, 'day');
  const priceNum = selectedPrice && selectedPrice !== 'other' ? Number(selectedPrice) : null;
  const priceLine =
    priceNum != null
      ? `\nLe tarif est de ${priceNum}€/nuit, soit ${priceNum * nightCount}€.`
      : '';

  const baseText = selectedGite
    ? `Bonjour,\nJe vous confirme votre réservation pour le gîte ${GITE_LABELS[selectedGite.id]} du ${arrival
        .locale('fr')
        .format('D MMMM YYYY')} à partir de 17h au ${departure
        .locale('fr')
        .format('D MMMM YYYY')} midi (${nightCount} nuit${nightCount > 1 ? 's' : ''}).${priceLine}\n L'adresse est ${GITE_ADDRESSES[selectedGite.id]}`
    : '';

  const signature = '\nMerci Beaucoup,\nSoazig Molinier';
  const extras = selectedTexts
    .map(i => {
      const t = texts[i];
      if (!t) return '';
      return `\n${t.text}`
        .replace('{dateDebut}', arrival.locale('fr').format('D MMMM YYYY'))
        .replace('{dateFin}', departure.locale('fr').format('D MMMM YYYY'))
        .replace('{nom}', name)
        .replace('{nbNuits}', String(nightCount));
    })
    .join('');

  const reservationText = baseText + extras + signature;

  return (
    <AvailabilityContext.Provider
      value={{
        arrival,
        departure,
        handleOpenPicker,
        anchorEl,
        handleClosePicker,
        handleRangeChange,
        availability,
        handleReserve,
        selectedGite,
        name,
        setName,
        phone,
        setPhone,
        singleBeds,
        setSingleBeds,
        doubleBeds,
        setDoubleBeds,
        adultCount,
        setAdultCount,
        childCount,
        setChildCount,
        includeBedding,
        setIncludeBedding,
        info,
        handlePhoneChange,
        handleSave,
        saving,
        saveError,
        airbnbUrl,
        reservationText,
        renderDayContent,
        selectedPrice,
        setSelectedPrice,
        prices,
        texts,
        selectedTexts,
        setSelectedTexts,
        savedForRange,
        nightCount,
        occupancyLimits: GITE_OCCUPANCY_LIMITS
      }}
    >
      {children}
    </AvailabilityContext.Provider>
  );
}

export function useAvailabilityContext() {
  const context = useContext(AvailabilityContext);
  if (!context) {
    throw new Error('useAvailabilityContext must be used within an AvailabilityProvider');
  }

  return context;
}
