import React, { useState } from 'react';
import { Globe } from 'lucide-react';

/**
 * Complete canonical country-to-ISO-3166-1-alpha-2 mapping extracted from
 * https://arcana.warera.wiki/js/data.js (COUNTRY_ISO) + common War Era aliases.
 */
export const WARERA_COUNTRY_ISO: Record<string, string> = {
  Afghanistan: 'AF',
  Albania: 'AL',
  Algeria: 'DZ',
  Andorra: 'AD',
  Angola: 'AO',
  Argentina: 'AR',
  Armenia: 'AM',
  Australia: 'AU',
  Austria: 'AT',
  Azerbaijan: 'AZ',
  Bahamas: 'BS',
  Bahrain: 'BH',
  Bangladesh: 'BD',
  Belarus: 'BY',
  Belgium: 'BE',
  Belize: 'BZ',
  Benin: 'BJ',
  Bhutan: 'BT',
  Bolivia: 'BO',
  Bosnia: 'BA',
  'Bosnia and Herzegovina': 'BA',
  Botswana: 'BW',
  Brazil: 'BR',
  Brunei: 'BN',
  Bulgaria: 'BG',
  'Burkina Faso': 'BF',
  Burundi: 'BI',
  Cambodia: 'KH',
  Cameroon: 'CM',
  Canada: 'CA',
  'Cape Verde': 'CV',
  'Central Africa': 'CF',
  'Central African Republic': 'CF',
  Chad: 'TD',
  Chile: 'CL',
  China: 'CN',
  Colombia: 'CO',
  Comoros: 'KM',
  Congo: 'CG',
  'Costa Rica': 'CR',
  Croatia: 'HR',
  Cuba: 'CU',
  Cyprus: 'CY',
  'Czech Republic': 'CZ',
  Czechia: 'CZ',
  "Côte d'Ivoire": 'CI',
  'Ivory Coast': 'CI',
  'Democratic Republic of the Congo': 'CD',
  'DR Congo': 'CD',
  Denmark: 'DK',
  Djibouti: 'DJ',
  'Dominican Republic': 'DO',
  'East Timor': 'TL',
  'Timor-Leste': 'TL',
  Ecuador: 'EC',
  Egypt: 'EG',
  'El Salvador': 'SV',
  'Equatorial Guinea': 'GQ',
  Eritrea: 'ER',
  Estonia: 'EE',
  Eswatini: 'SZ',
  Ethiopia: 'ET',
  Fiji: 'FJ',
  Finland: 'FI',
  France: 'FR',
  Gabon: 'GA',
  Gambia: 'GM',
  Georgia: 'GE',
  Germany: 'DE',
  Ghana: 'GH',
  Greece: 'GR',
  Greenland: 'GL',
  Guatemala: 'GT',
  Guinea: 'GN',
  'Guinea-Bissau': 'GW',
  Guyana: 'GY',
  Haiti: 'HT',
  Honduras: 'HN',
  Hungary: 'HU',
  Iceland: 'IS',
  India: 'IN',
  Indonesia: 'ID',
  Iran: 'IR',
  Iraq: 'IQ',
  Ireland: 'IE',
  Israel: 'IL',
  Italy: 'IT',
  Jamaica: 'JM',
  Japan: 'JP',
  Jordan: 'JO',
  Kazakhstan: 'KZ',
  Kenya: 'KE',
  Kosovo: 'XK',
  Kuwait: 'KW',
  Kyrgyzstan: 'KG',
  Laos: 'LA',
  Latvia: 'LV',
  Lebanon: 'LB',
  Lesotho: 'LS',
  Liberia: 'LR',
  Libya: 'LY',
  Liechtenstein: 'LI',
  Lithuania: 'LT',
  Luxembourg: 'LU',
  Madagascar: 'MG',
  Malawi: 'MW',
  Malaysia: 'MY',
  Maldives: 'MV',
  Mali: 'ML',
  Malta: 'MT',
  Mauritania: 'MR',
  Mauritius: 'MU',
  Mexico: 'MX',
  Moldova: 'MD',
  Mongolia: 'MN',
  Montenegro: 'ME',
  Morocco: 'MA',
  Mozambique: 'MZ',
  Myanmar: 'MM',
  Namibia: 'NA',
  Nepal: 'NP',
  Netherlands: 'NL',
  'New Zealand': 'NZ',
  Nicaragua: 'NI',
  Niger: 'NE',
  Nigeria: 'NG',
  'North Korea': 'KP',
  'North Macedonia': 'MK',
  Norway: 'NO',
  Oman: 'OM',
  Pakistan: 'PK',
  Palestine: 'PS',
  Panama: 'PA',
  'Papua New Guinea': 'PG',
  Paraguay: 'PY',
  Peru: 'PE',
  Philippines: 'PH',
  Poland: 'PL',
  Portugal: 'PT',
  'Puerto Rico': 'PR',
  Qatar: 'QA',
  Romania: 'RO',
  Russia: 'RU',
  Rwanda: 'RW',
  'Saudi Arabia': 'SA',
  Senegal: 'SN',
  Serbia: 'RS',
  'Sierra Leone': 'SL',
  Singapore: 'SG',
  Slovakia: 'SK',
  Slovenia: 'SI',
  'Solomon Islands': 'SB',
  Somalia: 'SO',
  'South Africa': 'ZA',
  'South Korea': 'KR',
  'South Sudan': 'SS',
  Spain: 'ES',
  'Sri Lanka': 'LK',
  Sudan: 'SD',
  Suriname: 'SR',
  Sweden: 'SE',
  Switzerland: 'CH',
  Syria: 'SY',
  'São Tomé and Príncipe': 'ST',
  Taiwan: 'TW',
  Tajikistan: 'TJ',
  Tanzania: 'TZ',
  Thailand: 'TH',
  Togo: 'TG',
  'Trinidad and Tobago': 'TT',
  Tunisia: 'TN',
  Turkey: 'TR',
  Turkiye: 'TR',
  Türkiye: 'TR',
  Turkmenistan: 'TM',
  Uganda: 'UG',
  Ukraine: 'UA',
  'United Arab Emirates': 'AE',
  'United Kingdom': 'GB',
  'United Korea': 'KP',
  'United States': 'US',
  'United States of America': 'US',
  USA: 'US',
  UK: 'GB',
  Uruguay: 'UY',
  Uzbekistan: 'UZ',
  Vanuatu: 'VU',
  Vatican: 'VA',
  'Vatican City': 'VA',
  Venezuela: 'VE',
  Vietnam: 'VN',
  Yemen: 'YE',
  Zambia: 'ZM',
  Zimbabwe: 'ZW',
};

const LOWER_COUNTRY_ISO: Record<string, string> = {};
for (const [name, iso] of Object.entries(WARERA_COUNTRY_ISO)) {
  LOWER_COUNTRY_ISO[name.toLowerCase()] = iso;
}

/**
 * Resolves a country name and/or country code to its canonical 2-letter ISO code
 * matching https://arcana.warera.wiki/company (flagHtml).
 */
export function resolveCountryIsoCode(countryName?: string, countryCode?: string): string | null {
  if (countryName) {
    const trimmedName = countryName.trim();
    if (WARERA_COUNTRY_ISO[trimmedName]) {
      return WARERA_COUNTRY_ISO[trimmedName].toLowerCase();
    }
    const lowerName = trimmedName.toLowerCase();
    if (LOWER_COUNTRY_ISO[lowerName]) {
      return LOWER_COUNTRY_ISO[lowerName].toLowerCase();
    }
  }
  if (countryCode) {
    const trimmedCode = countryCode.trim();
    if (/^[A-Za-z]{2}$/.test(trimmedCode)) {
      return trimmedCode.toLowerCase();
    }
    const lowerCode = trimmedCode.toLowerCase();
    if (LOWER_COUNTRY_ISO[lowerCode]) {
      return LOWER_COUNTRY_ISO[lowerCode].toLowerCase();
    }
  }
  return null;
}

interface WareraCountryFlagProps {
  countryName?: string;
  countryCode?: string;
  size?: 'xs' | 'sm' | 'md' | 'lg';
  className?: string;
}

/**
 * Renders the official country flag from https://flagcdn.com/20x15/{iso}.png
 * exactly as implemented on https://arcana.warera.wiki/company.
 */
export const WareraCountryFlag: React.FC<WareraCountryFlagProps> = ({
  countryName,
  countryCode,
  size = 'md',
  className = '',
}) => {
  const [imgError, setImgError] = useState(false);
  const iso = resolveCountryIsoCode(countryName, countryCode);

  const dimensions = {
    xs: { width: 16, height: 12, cls: 'w-4 h-3 rounded-[2px]' },
    sm: { width: 18, height: 13.5, cls: 'w-[18px] h-[13.5px] rounded-[2px]' },
    md: { width: 20, height: 15, cls: 'w-5 h-[15px] rounded-[3px]' },
    lg: { width: 24, height: 18, cls: 'w-6 h-[18px] rounded-[3px]' },
  }[size];

  if (!iso || imgError) {
    return (
      <span
        className={`inline-flex items-center justify-center shrink-0 text-slate-400 ${className}`}
        title={countryName || countryCode || 'Country'}
      >
        <Globe className="w-4 h-4" />
      </span>
    );
  }

  return (
    <img
      src={`https://flagcdn.com/20x15/${iso}.png`}
      srcSet={`https://flagcdn.com/40x30/${iso}.png 2x`}
      width={dimensions.width}
      height={dimensions.height}
      alt={countryName || iso.toUpperCase()}
      title={countryName || iso.toUpperCase()}
      loading="lazy"
      onError={() => setImgError(true)}
      className={`inline-block shrink-0 object-cover shadow-sm ring-1 ring-white/15 ${dimensions.cls} ${className}`}
    />
  );
};
