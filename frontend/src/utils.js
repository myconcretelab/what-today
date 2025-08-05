import airbnbLogo from './assets/logos/airbnb.svg';
import abritelLogo from './assets/logos/abritel.svg';
import gdfLogo from './assets/logos/gitesdefrance.svg';

export function sourceLogo(type) {
  switch (type) {
    case 'Airbnb':
      return airbnbLogo;
    case 'Abritel':
      return abritelLogo;
    case 'GitesDeFrance':
      return gdfLogo;
    default:
      return null;
  }
}
