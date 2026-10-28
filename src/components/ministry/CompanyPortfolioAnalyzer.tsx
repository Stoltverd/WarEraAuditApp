import React, { useState, useEffect, useMemo, useRef } from 'react';
import {
  AnalyzedCompanyRecord,
  BestProductOpportunity,
  CANONICAL_COMPANY_ITEMS,
  DailyWorkBarPoint,
  LowTaxCountryOpportunity,
  MAX_MGMT,
  MANAGER_CAP_PCT,
  MGMT_CAP_PCT,
  MGMT_PCT,
  HOME_PCT,
  PTS_PER_LEVEL_HOUR,
  PlayerCompanyAnalysisBundle,
  applyPortfolioSupplyTransfers,
  buildSimulatedEmployeeWithStats,
  calculatePointValue,
  fetchPlayerCompanyAnalysisBundle,
  formatNum,
  formatSigned,
  getBestProductOpportunities,
  getCompanyDiagnosticTags,
  getCompanyHireBonus,
  getLowestTaxCountries,
  managerHourly,
  managerPct,
  managerPoints,
  searchWareraPlayers,
} from '../../services/companyAnalysisService';
import { CitizenEconomicProfile } from '../../types/ministry';
import { WareraUserLite } from '../../types/warera';
import { WareraItemIcon } from '../common/WareraItemIcon';
import { WareraCountryFlag } from '../common/WareraCountryFlag';
import { useI18n, translateRawStringEs } from '../../i18n/I18nContext';
import {
  Search,
  RefreshCw,
  HelpCircle,
  BookOpen,
  ChevronDown,
  ChevronUp,
  RotateCcw,
  Building2,
  Users,
  AlertTriangle,
  CheckCircle2,
  SlidersHorizontal,
  Sparkles,
  X,
  ArrowLeft,
  ArrowRight,
  KeyRound,
} from 'lucide-react';

interface CompanyPortfolioAnalyzerProps {
  /** Initial player ID or WareraUserLite to load automatically (e.g., from CitizenAuditModal) */
  initialUserId?: string;
  initialUsername?: string;
  initialUserLite?: WareraUserLite;
  /** Whether to show the top player search bar and quick citizen picker (enabled in WorkforceAdvisor) */
  showPlayerSearch?: boolean;
  /** Optional list of audited citizens for one-click selection in WorkforceAdvisor */
  profiles?: CitizenEconomicProfile[];
}

const HISTORY_STORAGE_KEY = 'warera_ca2_search_history_v1';

interface GuidePageDef {
  title: string;
  intro?: string;
  cards: Array<{ heading: string; body: string }>;
}

const V027_GUIDE_PAGES: GuidePageDef[] = [
  {
    title: 'What changed',
    intro:
      'The job market is gone. Companies hire employees: generated characters with their own stats, traits, wage and age. Working for another player now means being their manager.',
    cards: [
      {
        heading: 'Why',
        body: '70% of players had no workers, and most who hired lost money. Now everyone can staff a company.',
      },
      {
        heading: 'The hourly tick',
        body: "Employees produce every hour and wages are paid every hour. If the full hour can't be paid, nobody works that hour.",
      },
      {
        heading: 'A money sink',
        body: 'Wages leave the game. The drain grows as employees train and companies fill up.',
      },
    ],
  },
  {
    title: 'Your skills',
    intro: 'Everyone gets one free skill reset to rebuild for the new system.',
    cards: [
      {
        heading: 'Entrepreneurship',
        body: 'Removed, its points refunded.',
      },
      {
        heading: 'Energy',
        body: '100 + 10 per level. Pays for self-work, hiring and training (10 each).',
      },
      {
        heading: 'Production',
        body: 'Self-work gives 30 + 3 per level.',
      },
      {
        heading: 'Management',
        body: 'No longer caps hiring: +2% employee output per point.',
      },
      {
        heading: 'Leadership',
        body: 'New, from level 10. Better training cards and event odds.',
      },
    ],
  },
  {
    title: 'Hiring an employee',
    intro:
      'Each company gets 3 new candidates every day at 00:00 UTC. Hiring costs 10 energy; a fresh set costs 10 energy, then doubles each time.',
    cards: [
      {
        heading: 'Hidden until hired',
        body: 'A card shows one hint: one stat, one trait or the Training Potential. Everything else appears once hired.',
      },
      {
        heading: 'Starting rolls',
        body: 'Production, Luck and Responsibility are 1 to 4 each. 50% chance of one trait (53 exist). Potential 3 to 10, age 18 to 45.',
      },
      {
        heading: 'Wage',
        body: 'Set by the employee: its base output (Production ÷ 4) × the money value of a point × its expectation (70–130%). Greedy +20%, Modest −15%.',
      },
      {
        heading: 'Break room = capacity',
        body: 'Level 1: 1 employee. Level 2: 2 (20 steel). Level 3: 3 (80 steel).',
      },
    ],
  },
  {
    title: 'Output and happiness',
    intro: 'Each hour an employee makes Production ÷ 4 points, boosted by:',
    cards: [
      {
        heading: 'Management',
        body: '+2% per point of the owner, plus the manager’s up to +22%; +44% together.',
      },
      {
        heading: 'Happiness',
        body: 'Starts at 50; each point above or below changes output by 1%. Full storage, missed pay, taxes, moves and battles lower it.',
      },
      {
        heading: 'Specialization & home',
        body: '+1% per day on the same good, up to +20%. +5% in one of the owner’s country’s core regions.',
      },
      {
        heading: 'Tools',
        body: '+3% (Common) to +65% (Mythic), about 500 worked hours each. Found in toolboxes (0.1% per Luck point per hour, max 2%).',
      },
      {
        heading: 'Quitting',
        body: 'Below 30 happiness an employee may walk out each hour. Firing costs coworkers −5 for 24 h; a moved employee gets −10 for 7 days.',
      },
    ],
  },
  {
    title: 'Training and life',
    cards: [
      {
        heading: 'Training',
        body: 'One draw per employee per day, 10 energy, uses 1 Potential. Pick 1 of 3 cards: a stat, a lower wage, a trait added or removed, or more Potential.',
      },
      {
        heading: 'Better costs more',
        body: 'Training Production raises the wage. A strong employee is not always a profitable one.',
      },
      {
        heading: 'Events',
        body: '78 small stories, about one a day with 3 employees. Ignored for 36 h, the default option is picked.',
      },
      {
        heading: 'Age',
        body: 'One year per day. At 65 they ask to retire, then every 10 days. A battle in their region carries a 1% risk of death.',
      },
    ],
  },
  {
    title: 'Managers',
    intro:
      'One manager job per company, from level 10. The owner sets the pay per point, and a manager is paid for Management + 1 points (up to 11); applying hires you at once.',
    cards: [
      {
        heading: 'The bonus',
        body: '+2% employee output per point. A manager counts their Management + 1 points (a level-0 manager still gives +2%), up to 11 points: +22%.',
      },
      {
        heading: 'Paid every hour',
        body: 'The manager presses Collect; the country takes its manager tax. Pay stays within 80–120% of the average.',
      },
      {
        heading: 'Care',
        body: 'Once a day the manager gives one employee +5 happiness for 48 h.',
      },
      {
        heading: 'Lock',
        body: 'For 24 h after hiring, neither side can end the contract.',
      },
    ],
  },
  {
    title: 'Country and taxes',
    cards: [
      {
        heading: 'No more best region',
        body: 'Deposits are off, specialization is gone, strategic resources no longer boost production. Everyone gets one free company move home.',
      },
      {
        heading: 'Two taxes',
        body: 'Income tax on employee wages, manager tax on manager pay. The self-work tax is gone.',
      },
      {
        heading: 'Taxes cost happiness',
        body: 'Each 1% of income tax costs employees 1 happiness, so 1% output.',
      },
    ],
  },
  {
    title: 'Reading this page',
    cards: [
      {
        heading: 'What comes from the live API',
        body: "Each company's 14-day daily output (engine, employees, self-work), live bot employee roster (Production stat, Bonus %, Happiness, hourly output & wage estimates), and active manager contracts.",
      },
      {
        heading: 'What is private',
        body: 'Unrevealed employee traits remain hidden to third parties until revealed, though their exact stat and percentage bonuses are already included in the live Production and Bonus figures.',
      },
      {
        heading: 'The simulators',
        body: '"What if…" uses the official v0.27 rules above. You can edit any employee’s Production or Bonus %, toggle or move employees across companies, test hiring a manager, or simulate switching products.',
      },
    ],
  },
];

const V027_GUIDE_PAGES_ES: GuidePageDef[] = [
  {
    title: 'Qué cambió en v0.27',
    intro:
      'El mercado laboral tradicional desapareció. Ahora las empresas contratan empleados (bots): personajes generados con sus propias estadísticas, rasgos, salario y edad. Trabajar para otro jugador ahora significa ser su gerente (Manager).',
    cards: [
      {
        heading: 'Por qué',
        body: 'El 70% de los jugadores no tenía trabajadores y la mayoría de quienes contrataban perdían dinero. Ahora cualquiera puede dotar de personal una empresa.',
      },
      {
        heading: 'El ciclo por hora',
        body: 'Los empleados producen cada hora y los salarios se pagan cada hora. Si no se puede cubrir la hora completa, nadie trabaja esa hora.',
      },
      {
        heading: 'Sumidero de dinero',
        body: 'Los salarios salen de circulación del juego. El gasto crece a medida que los empleados entrenan y las empresas se llenan.',
      },
    ],
  },
  {
    title: 'Tus habilidades (Skills)',
    intro: 'Todos reciben un reinicio gratuito de habilidades para reconstruir su build para el nuevo sistema.',
    cards: [
      {
        heading: 'Emprendimiento (Entrepreneurship)',
        body: 'Eliminado; sus puntos fueron reembolsados.',
      },
      {
        heading: 'Energía (Energy)',
        body: '100 + 10 por nivel. Paga el autotrabajo, la contratación y el entrenamiento (10 de energía cada uno).',
      },
      {
        heading: 'Producción (Production)',
        body: 'El autotrabajo otorga 30 + 3 puntos por nivel.',
      },
      {
        heading: 'Gestión (Management)',
        body: 'Ya no limita la contratación: otorga +2% de producción a los empleados por punto.',
      },
      {
        heading: 'Leadership',
        body: 'Nueva habilidad desde nivel 10. Mejora las cartas de entrenamiento y las probabilidades de eventos.',
      },
    ],
  },
  {
    title: 'Contratar a un empleado',
    intro:
      'Cada empresa recibe 3 nuevos candidatos cada día a las 00:00 UTC. Contratar cuesta 10 de energía; renovar candidatos cuesta 10 de energía y luego se duplica cada vez.',
    cards: [
      {
        heading: 'Oculto hasta contratar',
        body: 'Cada carta muestra una sola pista: una estadística, un rasgo o el Potencial de Entrenamiento. Todo lo demás se revela al contratar.',
      },
      {
        heading: 'Estadísticas iniciales',
        body: 'Producción, Suerte y Responsabilidad van de 1 a 4 cada una. 50% de probabilidad de un rasgo (existen 53). Potencial de 3 a 10, edad de 18 a 45.',
      },
      {
        heading: 'Salario',
        body: 'Fijado por el empleado: su producción base (Producción ÷ 4) × el valor monetario de un punto × su expectativa (70–130%). Codicioso +20%, Modesto −15%.',
      },
      {
        heading: 'Break Room = capacidad',
        body: 'Nivel 1: 1 empleado. Nivel 2: 2 (20 de acero). Nivel 3: 3 (80 de acero).',
      },
    ],
  },
  {
    title: 'Producción y felicidad',
    intro: 'Cada hora un empleado genera Producción ÷ 4 puntos, impulsados por:',
    cards: [
      {
        heading: 'Gestión (Management)',
        body: '+2% por punto del propietario, más el del gerente hasta +22%; +44% en conjunto.',
      },
      {
        heading: 'Felicidad',
        body: 'Empieza en 50; cada punto por encima o por debajo cambia la producción en 1%. Almacenamiento lleno, falta de pago, impuestos, traslados y batallas la reducen.',
      },
      {
        heading: 'Especialización y país natal',
        body: '+1% por día fabricando el mismo bien, hasta +20%. +5% si la empresa está en una región núcleo del país del propietario.',
      },
      {
        heading: 'Herramientas (Tools)',
        body: '+3% (Común) a +65% (Mítica), duran unas 500 horas trabajadas. Se hallan en cajas de herramientas (0.1% por punto de Suerte por hora, máx. 2%).',
      },
      {
        heading: 'Renuncias',
        body: 'Por debajo de 30 de felicidad un empleado puede renunciar cada hora. Despedir resta −5 a los compañeros por 24 h; trasladar resta −10 por 7 días.',
      },
    ],
  },
  {
    title: 'Entrenamiento y vida laboral',
    cards: [
      {
        heading: 'Entrenamiento',
        body: 'Una tirada por empleado al día, cuesta 10 de energía y consume 1 de Potencial. Elige 1 de 3 cartas: subir estadística, bajar salario, añadir/quitar rasgo o más Potencial.',
      },
      {
        heading: 'Mejor cuesta más',
        body: 'Entrenar Producción también sube el salario. Un empleado más fuerte no siempre es el más rentable.',
      },
      {
        heading: 'Eventos',
        body: '78 pequeñas historias, aprox. una al día con 3 empleados. Si se ignora por 36 h, se elige la opción por defecto.',
      },
      {
        heading: 'Edad',
        body: 'Un año por día. A los 65 piden jubilarse, y luego cada 10 días. Una batalla en su región conlleva 1% de riesgo de muerte.',
      },
    ],
  },
  {
    title: 'Gerentes (Managers)',
    intro:
      'Un puesto de gerente por empresa, desde nivel 10. El propietario fija el pago por punto y el gerente cobra por Gestión + 1 puntos (hasta 11); postularse te contrata al instante.',
    cards: [
      {
        heading: 'El bono',
        body: '+2% de producción de empleados por punto. Un gerente suma Gestión + 1 puntos (un gerente nivel 0 igual da +2%), hasta 11 puntos: +22%.',
      },
      {
        heading: 'Pago por hora',
        body: 'El gerente pulsa Cobrar; el país descuenta el impuesto de gerente. El pago se mantiene entre 80–120% del promedio.',
      },
      {
        heading: 'Cuidado',
        body: 'Una vez al día el gerente otorga +5 de felicidad a un empleado durante 48 h.',
      },
      {
        heading: 'Bloqueo de contrato',
        body: 'Durante 24 h tras la contratación, ninguna de las partes puede rescindir el contrato.',
      },
    ],
  },
  {
    title: 'País e impuestos',
    cards: [
      {
        heading: 'Sin mejor región fija',
        body: 'Los depósitos están desactivados, la especialización regional desapareció y los recursos estratégicos ya no impulsan la producción. Todos reciben un traslado gratuito a casa.',
      },
      {
        heading: 'Dos impuestos',
        body: 'Impuesto a la renta sobre salarios de empleados e impuesto de gerente sobre el pago al gerente. El impuesto al autotrabajo desapareció.',
      },
      {
        heading: 'Los impuestos restan felicidad',
        body: 'Cada 1% de impuesto a la renta cuesta 1 de felicidad a los empleados, equivalente a 1% de producción.',
      },
    ],
  },
  {
    title: 'Cómo leer esta página',
    cards: [
      {
        heading: 'Qué proviene de la API en vivo',
        body: 'La producción diaria de los últimos 14 días (motor, empleados, autotrabajo), la plantilla de bots en vivo (Producción, % de Bono, Felicidad, estimaciones por hora) y contratos de gerente activos.',
      },
      {
        heading: 'Qué es privado',
        body: 'Los rasgos ocultos no revelados permanecen privados para terceros, aunque sus bonos exactos ya están incluidos en las cifras de Producción y Bono en vivo.',
      },
      {
        heading: 'Los simuladores',
        body: '"¿Qué pasaría si…?" usa las reglas oficiales de v0.27. Puedes editar la Producción o Bono % de cualquier empleado, activarlo/desactivarlo, moverlo de empresa, probar un gerente o simular otro producto.',
      },
    ],
  },
];

const INFO_POPOVER_ES_MAP: Record<string, string> = {
  'Production points per UTC day. The engine part is automatic; the employee part is the sum of every hourly tick; self-work is the owner working their own company (10 energy each). The last bar is today and still filling. Hover or tap a bar for its numbers.':
    'Puntos de producción por día UTC. La parte del motor es automática; la de empleados es la suma de cada hora trabajada; el autotrabajo es el propietario trabajando su propia empresa (10 de energía cada vez). La última barra es hoy y sigue llenándose. Pasa el cursor o toca una barra para ver sus cifras.',
  "Deposits and region bonuses are gone; employees of a company in its owner's own country get +5%, so moving abroad trades that away. Each 1% of income tax costs employees 1 happiness (1% output), and market tax is taken from what you sell. Sorted by income tax, then market tax.":
    'Los bonos de depósitos y regiones desaparecieron; los empleados de una empresa ubicada en el país natal de su dueño reciben +5%, por lo que mudarse al extranjero pierde ese bono. Cada 1% de impuesto a la renta resta 1 de felicidad (1% de producción), y el impuesto de mercado se descuenta al vender. Ordenado por impuesto a la renta y luego mercado.',
  'Market value of one production point for each product: price, minus raw materials bought on the market, divided by the points a unit needs. It changes with prices.':
    'Valor de mercado de un punto de producción para cada producto: precio de venta menos las materias primas compradas en el mercado, dividido por los puntos que requiere una unidad. Cambia en tiempo real según los precios del mercado.',
  'A manager is a player paid every hour: the owner sets a rate per Management point. They add +2% employee output per point (up to +22%), care for one employee a day (+5 happiness for 48 h), and the country takes its manager tax on their pay. Neither side can end a new contract for 24 hours.':
    'Un gerente es un jugador pagado por hora: el propietario fija una tarifa por punto de Gestión (Management). Añade +2% de producción a los empleados por punto (hasta +22%), cuida a un empleado al día (+5 de felicidad por 48 h), y el país cobra el impuesto de gerente sobre su pago. Ninguna parte puede terminar un contrato nuevo durante 24 horas.',
  'Without a manager the employees work without the manager bonus. Owners can post a manager position from the company screen.':
    'Sin un gerente, los empleados trabajan sin el bono de gerencia. Los propietarios pueden publicar una oferta de gerente desde la pantalla de la empresa.',
  "Straight from the game: each employee's Production stat, total bonus (hover for Management, home region, happiness, specialization…), happiness, and the game's own hourly estimate of output and wage, here per day. Use ⋯ to simulate: edit Production and bonus, deactivate, or move an employee to another company with room. Simulated output follows Production ÷ 4 × the bonus.":
    'Directo del juego: la estadística de Producción de cada empleado, su bono total (pasa el cursor para ver Gestión, región natal, felicidad, especialización…), felicidad y la estimación por hora del juego llevada a valores diarios. Usa ⋯ para simular: editar Producción y bono, desactivar o mover un empleado a otra empresa con cupo en el Break Room. La producción simulada sigue Producción ÷ 4 × el bono.',
};

/**
 * Accessible contextual ? Help Popover matching Arcana's informational tooltips
 */
export const InfoHelpPopover: React.FC<{ text: string; label?: string }> = ({
  text,
  label = 'What does this mean?',
}) => {
  const { lang, tx } = useI18n();
  const [open, setOpen] = useState(false);
  const wrapRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (!open) return;
    const handleOutside = (e: MouseEvent) => {
      if (wrapRef.current && !wrapRef.current.contains(e.target as Node)) {
        setOpen(false);
      }
    };
    document.addEventListener('mousedown', handleOutside);
    return () => document.removeEventListener('mousedown', handleOutside);
  }, [open]);

  const localizedText = useMemo(() => {
    if (lang !== 'es') return text;
    if (INFO_POPOVER_ES_MAP[text]) return INFO_POPOVER_ES_MAP[text];
    if (text.startsWith('Based on the ')) {
      const m = text.match(/^Based on the (.+?)\. Goods value = points ÷ (\d+) points per unit × market price(, minus the raw materials bought on the market)?\. Raw goods that feed the player's own factories are neither sold nor bought\. Employee output and wages are the game's estimate for the current roster; self-work is left out, since it costs the owner energy; the manager is their hourly wage × 24\. Days before v0\.27 \(player workers\) are left out\.$/);
      if (m) {
        const localizedBasis = translateRawStringEs(m[1]);
        const ppNum = m[2];
        const rawClause = m[3] ? ', menos las materias primas compradas en el mercado' : '';
        return `Basado en ${localizedBasis}. Valor de bienes = puntos ÷ ${ppNum} puntos por unidad × precio de mercado${rawClause}. Las materias primas que abastecen las fábricas propias del jugador ni se venden ni se compran. La producción y salarios de empleados son la estimación del juego para la plantilla actual; el autotrabajo se excluye porque cuesta energía al dueño; el gerente es su salario por hora × 24. Los días previos a v0.27 se excluyen.`;
      }
      return text
        .replace('Based on the ', 'Basado en ')
        .replace('Goods value = points ÷ ', 'Valor de bienes = puntos ÷ ')
        .replace(' points per unit × market price, minus the raw materials bought on the market.', ' puntos por unidad × precio de mercado, menos las materias primas compradas en el mercado.')
        .replace(' points per unit × market price.', ' puntos por unidad × precio de mercado.')
        .replace("Raw goods that feed the player's own factories are neither sold nor bought.", 'Las materias primas que abastecen las fábricas propias del jugador ni se venden ni se compran.')
        .replace("Employee output and wages are the game's estimate for the current roster; self-work is left out, since it costs the owner energy; the manager is their hourly wage × 24. Days before v0.27 (player workers) are left out.", 'La producción y salarios de empleados son la estimación del juego para la plantilla actual; el autotrabajo se excluye porque cuesta energía al dueño; el gerente es su salario por hora × 24. Los días previos a v0.27 se excluyen.');
    }
    return translateRawStringEs(text);
  }, [lang, text]);

  return (
    <div ref={wrapRef} className="relative inline-flex items-center">
      <button
        type="button"
        onClick={(e) => {
          e.stopPropagation();
          setOpen((v) => !v);
        }}
        onMouseEnter={() => setOpen(true)}
        onMouseLeave={() => setOpen(false)}
        aria-label={tx(label, '¿Qué significa esto?')}
        className={`w-5 h-5 rounded-full inline-flex items-center justify-center text-xs font-black border transition ${
          open
            ? 'bg-amber-500 text-slate-950 border-amber-400 shadow-sm'
            : 'bg-slate-800/90 text-amber-300 border-amber-500/40 hover:bg-amber-500/20'
        }`}
      >
        ?
      </button>
      {open && (
        <div
          onClick={(e) => e.stopPropagation()}
          className="absolute left-0 top-7 z-50 w-72 sm:w-80 p-3.5 rounded-xl bg-slate-900 border border-amber-500/50 shadow-2xl text-xs sm:text-sm text-slate-100 font-sans font-normal normal-case tracking-normal leading-relaxed pointer-events-auto"
        >
          {localizedText}
        </div>
      )}
    </div>
  );
};

/**
 * Interactive 14-Day Stacked SVG Output Chart (Engine + Employees + Self-work)
 * with floating hover/tap daily breakdown tooltip (matching Screenshot 2)
 */
const CompanyOutputChart: React.FC<{
  company: AnalyzedCompanyRecord;
}> = ({ company }) => {
  const [hoveredIdx, setHoveredIdx] = useState<number | null>(null);
  const history = company.history || [];

  if (!history.length) {
    return (
      <div className="p-4 rounded-xl bg-slate-900/70 border border-slate-800 text-xs sm:text-sm text-slate-400 text-center">
        No work recorded yet for this company.
      </div>
    );
  }

  const W = 280;
  const H = 88;
  const gap = 3;
  const n = history.length;
  const bw = (W - gap * Math.max(0, n - 1)) / Math.max(1, n);
  const max = Math.max(1, ...history.map((d) => d.engine + d.npc + d.self));
  const today = new Date().toISOString().slice(0, 10);

  const activeBar: DailyWorkBarPoint | null =
    hoveredIdx != null && history[hoveredIdx] ? history[hoveredIdx] : null;
  const activeWorth = activeBar ? (activeBar.total / company.pp) * company.unitValue : 0;
  const activeIsToday = activeBar?.date === today;

  const formatUtcHeaderDate = (dateStr: string) => {
    try {
      const d = new Date(`${dateStr}T00:00:00Z`);
      return d.toUTCString().slice(0, 11).toUpperCase();
    } catch {
      return dateStr;
    }
  };

  return (
    <figure className="relative space-y-2 select-none">
      <figcaption className="flex items-center justify-between gap-2 flex-wrap text-xs sm:text-sm">
        <span className="font-extrabold uppercase tracking-wider text-slate-200">
          {`Output, last ${n} days`}
        </span>
        <div className="flex items-center gap-3 text-xs text-slate-300">
          <span className="inline-flex items-center gap-1.5">
            <span className="w-2.5 h-2.5 rounded-xs bg-amber-500 inline-block" />
            Engine
          </span>
          <span className="inline-flex items-center gap-1.5">
            <span className="w-2.5 h-2.5 rounded-xs bg-teal-400 inline-block" />
            Employees
          </span>
          <span className="inline-flex items-center gap-1.5">
            <span className="w-2.5 h-2.5 rounded-xs bg-rose-500 inline-block" />
            Self
          </span>
          <InfoHelpPopover text="Production points per UTC day. The engine part is automatic; the employee part is the sum of every hourly tick; self-work is the owner working their own company (10 energy each). The last bar is today and still filling. Hover or tap a bar for its numbers." />
        </div>
      </figcaption>

      {/* Floating Daily Breakdown Tooltip */}
      {activeBar && hoveredIdx != null && (
        <div
          className="absolute z-40 -top-24 sm:-top-28 bg-slate-950/95 border border-amber-500/50 rounded-xl p-3 shadow-2xl text-xs font-mono text-slate-100 pointer-events-none min-w-[215px]"
          style={{
            left: `${Math.min(Math.max((hoveredIdx / Math.max(1, n - 1)) * 65, 0), 55)}%`,
          }}
        >
          <div className="font-sans font-black text-amber-300 uppercase tracking-wider border-b border-slate-800 pb-1 mb-1.5">
            {`${formatUtcHeaderDate(activeBar.date)}${activeIsToday ? ' · TODAY SO FAR' : ''}`}
          </div>
          <div className="space-y-0.5 tabular-nums">
            <div className="flex items-center justify-between gap-4">
              <span className="inline-flex items-center gap-1.5 text-slate-300 font-sans">
                <span className="w-2 h-2 rounded-xs bg-amber-500" />
                Engine
              </span>
              <span className="font-bold text-white">{formatNum(activeBar.engine, 1)} pts</span>
            </div>
            <div className="flex items-center justify-between gap-4">
              <span className="inline-flex items-center gap-1.5 text-slate-300 font-sans">
                <span className="w-2 h-2 rounded-xs bg-teal-400" />
                Employees
              </span>
              <span className="font-bold text-white">{formatNum(activeBar.npc, 1)} pts</span>
            </div>
            <div className="flex items-center justify-between gap-4">
              <span className="inline-flex items-center gap-1.5 text-slate-300 font-sans">
                <span className="w-2 h-2 rounded-xs bg-rose-500" />
                Self-work
              </span>
              <span className="font-bold text-white">{formatNum(activeBar.self, 1)} pts</span>
            </div>
            <div className="flex items-center justify-between gap-4 border-t border-slate-800 pt-1 mt-1">
              <span className="text-slate-400 font-sans">Total</span>
              <span className="font-black text-amber-200">
                {`${formatNum(activeBar.total, 1)} pts · ${formatNum(activeBar.total / company.pp, 2)} units`}
              </span>
            </div>
            <div className="flex items-center justify-between gap-4">
              <span className="text-slate-400 font-sans">Worth</span>
              <span className="font-bold text-emerald-400">{formatNum(activeWorth, 2)}</span>
            </div>
            <div className="flex items-center justify-between gap-4">
              <span className="text-slate-400 font-sans">Wages</span>
              <span className="font-bold text-rose-400">−{formatNum(activeBar.wage, 3)}</span>
            </div>
          </div>
        </div>
      )}

      <div
        className="p-3 rounded-xl bg-slate-950/90 border border-slate-800/90"
        onMouseLeave={() => setHoveredIdx(null)}
      >
        <svg
          viewBox={`0 0 ${W} ${H}`}
          preserveAspectRatio="none"
          className="w-full h-24 overflow-visible"
          role="img"
          aria-label={`Daily output for the last ${n} days`}
        >
          {/* Baseline */}
          <line x1={0} y1={H} x2={W} y2={H} stroke="#334155" strokeWidth={1} />
          {history.map((d, i) => {
            const x = i * (bw + gap);
            const he = (d.engine / max) * H;
            const hn = (d.npc / max) * H;
            const hs = (d.self / max) * H;
            const isToday = d.date === today;
            const isHovered = hoveredIdx === i;

            return (
              <g
                key={d.date}
                className="cursor-pointer"
                onMouseEnter={() => setHoveredIdx(i)}
                onClick={() => setHoveredIdx(hoveredIdx === i ? null : i)}
                opacity={isToday ? 0.72 : 1}
              >
                {/* Hover Column Highlight */}
                {isHovered && (
                  <rect
                    x={Math.max(0, x - 1)}
                    y={0}
                    width={bw + 2}
                    height={H}
                    fill="rgba(245, 158, 11, 0.12)"
                    rx={2}
                  />
                )}
                {/* Engine Segment (Bottom) */}
                {he > 0 && (
                  <rect
                    x={x}
                    y={H - he}
                    width={bw}
                    height={he}
                    fill="#d97706"
                    rx={1}
                  />
                )}
                {/* Employees Segment (Middle) */}
                {hn > 0 && (
                  <rect
                    x={x}
                    y={H - he - hn}
                    width={bw}
                    height={hn}
                    fill="#14b8a6"
                    rx={1}
                  />
                )}
                {/* Self-work Segment (Top) */}
                {hs > 0 && (
                  <rect
                    x={x}
                    y={H - he - hn - hs}
                    width={bw}
                    height={hs}
                    fill="#e11d48"
                    rx={1}
                  />
                )}
                {/* Invisible Full-Height Hit Target */}
                <rect x={x} y={0} width={bw} height={H} fill="transparent" />
              </g>
            );
          })}
        </svg>

        <div className="flex items-center justify-between text-xs font-mono text-slate-400 pt-2 border-t border-slate-800/80 mt-1">
          <span>{history[0]?.date.slice(5)}</span>
          <span className="text-slate-300 font-semibold">{`max ${formatNum(max, 1)} pts`}</span>
          <span>{history[n - 1]?.date.slice(5)}</span>
        </div>
      </div>
    </figure>
  );
};

export const CompanyPortfolioAnalyzer: React.FC<CompanyPortfolioAnalyzerProps> = ({
  initialUserId,
  initialUsername,
  initialUserLite,
  showPlayerSearch = false,
  profiles = [],
}) => {
  const { lang, tx, translateCommodity } = useI18n();
  const activeGuidePages = lang === 'es' ? V027_GUIDE_PAGES_ES : V027_GUIDE_PAGES;
  const [searchQuery, setSearchQuery] = useState(initialUsername || '');
  const [isSearching, setIsSearching] = useState(false);
  const [searchCandidates, setSearchCandidates] = useState<WareraUserLite[]>([]);
  const [recentSearches, setRecentSearches] = useState<string[]>(() => {
    try {
      return JSON.parse(localStorage.getItem(HISTORY_STORAGE_KEY) || '[]');
    } catch {
      return [];
    }
  });

  const [bundle, setBundle] = useState<PlayerCompanyAnalysisBundle | null>(null);
  const [companiesState, setCompaniesState] = useState<AnalyzedCompanyRecord[]>([]);
  const [isLoadingBundle, setIsLoadingBundle] = useState(false);
  const [statusMessage, setStatusMessage] = useState<string>('');
  const [statusError, setStatusError] = useState<boolean>(false);

  // Open/collapsed company card IDs (first 3 open by default for immediate visibility)
  const [openCompanyIds, setOpenCompanyIds] = useState<Set<string>>(new Set());
  // Open "What If..." drawer company IDs
  const [openSimCompanyIds, setOpenSimCompanyIds] = useState<Set<string>>(new Set());
  // Currently inline-editing employee: { companyId, empIndex }
  const [editingEmp, setEditingEmp] = useState<{ companyId: string; empIndex: number } | null>(
    null
  );
  // Active "What If..." slider state per company ID
  const [simForms, setSimForms] = useState<
    Record<
      string,
      {
        hireProd: number;
        hireExp: number;
        mgrLvl: number;
        mgrRate: number;
        altItem: string;
      }
    >
  >({});

  // 8-Page "How Work Runs Now (v0.27)" Reference Guide Modal
  const [isGuideOpen, setIsGuideOpen] = useState(false);
  const [guideStep, setGuideStep] = useState(0);

  const saveRecentSearch = (username: string) => {
    if (!username) return;
    const updated = [
      username,
      ...recentSearches.filter((u) => u.toLowerCase() !== username.toLowerCase()),
    ].slice(0, 8);
    setRecentSearches(updated);
    try {
      localStorage.setItem(HISTORY_STORAGE_KEY, JSON.stringify(updated));
    } catch {
      // ignore storage errors
    }
  };

  const loadPlayerBundle = async (
    target: string | WareraUserLite,
    forceRefresh = false
  ) => {
    setIsLoadingBundle(true);
    setStatusError(false);
    const label = typeof target === 'string' ? target : target.username;
    setStatusMessage(`Loading ${label}'s companies & live workforce telemetry…`);
    setSearchCandidates([]);

    try {
      const res = await fetchPlayerCompanyAnalysisBundle(target, forceRefresh);
      if (!res) {
        setStatusMessage('Could not load player company telemetry.');
        setStatusError(true);
        return;
      }
      setBundle(res);
      setCompaniesState(res.companies);

      // Initialize default open cards (first 2 cards open) and simulator form defaults
      const initialOpen = new Set<string>(
        res.companies.slice(0, 2).map((c) => c.company._id)
      );
      setOpenCompanyIds(initialOpen);

      const nextForms: Record<
        string,
        { hireProd: number; hireExp: number; mgrLvl: number; mgrRate: number; altItem: string }
      > = {};
      res.companies.forEach((c) => {
        const defaultRate =
          c.manager?.rateManagement ??
          c.offer?.rateManagement ??
          (res.wageStats?.topOffer ? res.wageStats.topOffer / MAX_MGMT : 0.01);
        const rankedAlt = CANONICAL_COMPANY_ITEMS.filter(
          (it) => it.id !== c.company.itemCode && calculatePointValue(it.id, res.prices) != null
        ).sort(
          (a, b) =>
            (calculatePointValue(b.id, res.prices) || 0) -
            (calculatePointValue(a.id, res.prices) || 0)
        );

        nextForms[c.company._id] = {
          hireProd: 3,
          hireExp: 100,
          mgrLvl: c.manager?.managementLevel ?? 5,
          mgrRate: Number(defaultRate.toFixed(4)) || 0.01,
          altItem: rankedAlt[0]?.id || 'cookedFish',
        };
      });
      setSimForms(nextForms);

      if (res.user?.username && !res.user.username.startsWith('Citizen #')) {
        saveRecentSearch(res.user.username);
        setSearchQuery(res.user.username);
      }

      if (res.companies.length === 0) {
        setStatusMessage(`${res.user.username} has no active companies.`);
      } else {
        setStatusMessage('');
      }
    } catch (err: any) {
      setStatusMessage(`Could not load companies (${err?.message || 'Network error'}).`);
      setStatusError(true);
    } finally {
      setIsLoadingBundle(false);
    }
  };

  // Auto-load initial player on mount or when initialUserId changes
  useEffect(() => {
    if (initialUserLite && initialUserLite._id) {
      loadPlayerBundle(initialUserLite);
    } else if (initialUserId) {
      loadPlayerBundle(initialUserId);
    } else if (showPlayerSearch && profiles.length > 0 && !bundle && !isLoadingBundle) {
      // Automatically load the top citizen with companies so the analyzer is never blank
      const firstWithCompanies =
        profiles.find((p) => (p.companiesCount || 0) > 0) || profiles[0];
      if (firstWithCompanies) {
        loadPlayerBundle({
          _id: firstWithCompanies.userId,
          username: firstWithCompanies.username,
          country: firstWithCompanies.countryId,
          level: firstWithCompanies.level,
          skills: firstWithCompanies.skillBreakdown
            ? {
                management: {
                  level: firstWithCompanies.skillBreakdown.management,
                  value: firstWithCompanies.skillBreakdown.management + 1,
                },
              }
            : undefined,
        });
      }
    }
  }, [initialUserId, initialUserLite?._id]);

  const handleSearchSubmit = async (e?: React.FormEvent, overrideName?: string) => {
    if (e) e.preventDefault();
    const q = (overrideName ?? searchQuery).trim();
    if (!q) return;

    // Check if query matches one of our already loaded country profiles first
    const localMatch = profiles.find(
      (p) => p.username.toLowerCase() === q.toLowerCase() || p.userId === q
    );
    if (localMatch) {
      await loadPlayerBundle({
        _id: localMatch.userId,
        username: localMatch.username,
        country: localMatch.countryId,
        level: localMatch.level,
      });
      return;
    }

    setIsSearching(true);
    setStatusError(false);
    setStatusMessage(`Searching War Era for "${q}"…`);
    try {
      const users = await searchWareraPlayers(q);
      if (!users.length) {
        setStatusMessage(`No player matches "${q}".`);
        setStatusError(true);
        return;
      }
      const exact = users.find((u) => u.username?.toLowerCase() === q.toLowerCase());
      if (exact || users.length === 1) {
        await loadPlayerBundle(exact || users[0]);
      } else {
        setSearchCandidates(users);
        setStatusMessage('Several players match. Pick one below:');
      }
    } catch (err: any) {
      setStatusMessage(`Search failed (${err?.message || 'Error'}).`);
      setStatusError(true);
    } finally {
      setIsSearching(false);
    }
  };

  // Recompute portfolio with supply transfers whenever companiesState changes
  const recomputePortfolio = (nextList: AnalyzedCompanyRecord[]) => {
    if (!bundle) return;
    const updated = applyPortfolioSupplyTransfers(nextList, bundle.prices);
    setCompaniesState(updated);
  };

  const isCompanySimulated = (c: AnalyzedCompanyRecord): boolean => {
    return Boolean(c.ov && Object.keys(c.ov).some((k) => (c.ov as any)[k] !== undefined));
  };

  const ensureOverrideEmps = (c: AnalyzedCompanyRecord) => {
    c.ov = c.ov || {};
    if (!c.ov.emps) {
      c.ov.emps = c.base.emps.map((e) => ({ ...e }));
    }
    return c.ov.emps;
  };

  // Simulation mutation handlers
  const handleToggleSupplyOwnFactories = (compIndex: number, checked: boolean) => {
    const next = [...companiesState];
    next[compIndex] = { ...next[compIndex], noSupply: !checked };
    recomputePortfolio(next);
  };

  const handleResetCompanySim = (compIndex: number) => {
    const next = [...companiesState];
    next[compIndex] = { ...next[compIndex], ov: null };
    if (editingEmp?.companyId === next[compIndex].company._id) {
      setEditingEmp(null);
    }
    recomputePortfolio(next);
  };

  const handleEngineSimChange = (compIndex: number, newLevel: number) => {
    const next = [...companiesState];
    const target = { ...next[compIndex], ov: { ...(next[compIndex].ov || {}) } };
    target.ov.engine = newLevel === target.base.engineLvl ? undefined : newLevel;
    next[compIndex] = target;
    recomputePortfolio(next);
  };

  const handleApplyAlternativeProduct = (compIndex: number, newItemCode: string) => {
    const next = [...companiesState];
    const target = { ...next[compIndex], ov: { ...(next[compIndex].ov || {}) } };
    target.ov.item = newItemCode === target.base.item ? undefined : newItemCode;
    next[compIndex] = target;
    recomputePortfolio(next);
  };

  const handleHireSimEmployee = (compIndex: number) => {
    if (!bundle) return;
    const next = [...companiesState];
    const target = { ...next[compIndex], ov: { ...(next[compIndex].ov || {}) } };
    const emps = ensureOverrideEmps(target);
    const form = simForms[target.company._id] || {
      hireProd: 3,
      hireExp: 100,
      mgrLvl: 5,
      mgrRate: 0.01,
      altItem: 'cookedFish',
    };
    const bonus = getCompanyHireBonus(target, bundle.ownerMgmtPoints);
    const simEmp = buildSimulatedEmployeeWithStats(
      {
        id: `sim-emp-${Date.now()}`,
        name: `Sim employee ${emps.length + 1}`,
        prod: 0,
        bonus,
        bonusDetail: `Simulated (+${formatNum(bonus, 1)}% owner/manager/home bonus)`,
        bonusContributions: [],
        ptsH: 0,
        wageH: 0,
        happy: 50,
        quit: 0,
        traits: '',
        traitCodes: [],
        sim: 'added',
      },
      form.hireProd,
      bonus,
      bundle.ppValue
    );
    simEmp.wageH = simEmp.wageH * (form.hireExp / 100);
    emps.push(simEmp);
    next[compIndex] = target;
    recomputePortfolio(next);
  };

  const handleEditEmployeeField = (
    compIndex: number,
    empIndex: number,
    field: 'prod' | 'bonus',
    value: number
  ) => {
    if (!bundle) return;
    const next = [...companiesState];
    const target = { ...next[compIndex], ov: { ...(next[compIndex].ov || {}) } };
    const emps = ensureOverrideEmps(target);
    const currentEmp = emps[empIndex];
    if (!currentEmp) return;

    const clamped =
      field === 'prod'
        ? Math.min(50, Math.max(0, value))
        : Math.min(300, Math.max(-100, value));
    emps[empIndex] = buildSimulatedEmployeeWithStats(
      currentEmp,
      field === 'prod' ? clamped : currentEmp.prod,
      field === 'bonus' ? clamped : currentEmp.bonus,
      bundle.ppValue
    );
    next[compIndex] = target;
    recomputePortfolio(next);
  };

  const handleEmployeeActionMenu = (
    compIndex: number,
    empIndex: number,
    action: string
  ) => {
    if (!action) return;
    const next = [...companiesState];
    const target = { ...next[compIndex], ov: { ...(next[compIndex].ov || {}) } };
    const compId = target.company._id;

    if (action === 'edit') {
      setEditingEmp({ companyId: compId, empIndex });
      return;
    }
    if (action === 'done') {
      setEditingEmp(null);
      return;
    }

    const emps = ensureOverrideEmps(target);
    if (action === 'toggle') {
      const emp = emps[empIndex];
      if (emp) {
        emps[empIndex] = {
          ...emp,
          off: !emp.off,
          sim: emp.sim || 'edited',
        };
      }
    } else if (action === 'remove') {
      emps.splice(empIndex, 1);
    } else if (action.startsWith('move:')) {
      const destIndex = Number(action.slice(5));
      if (!isNaN(destIndex) && next[destIndex]) {
        const [movedEmp] = emps.splice(empIndex, 1);
        if (movedEmp) {
          const destComp = {
            ...next[destIndex],
            ov: { ...(next[destIndex].ov || {}) },
          };
          const destEmps = ensureOverrideEmps(destComp);
          destEmps.push({ ...movedEmp, sim: 'moved' });
          next[destIndex] = destComp;
        }
      }
    }

    next[compIndex] = target;
    recomputePortfolio(next);
  };

  // Portfolio Aggregate Totals (matching the 8 KPI tiles in Screenshot 4)
  const portfolioTotals = useMemo(() => {
    const sum = (key: keyof AnalyzedCompanyRecord) =>
      companiesState.reduce((acc, c) => acc + Number(c[key] || 0), 0);
    const totalPoints = sum('points');
    const totalNpcPoints = sum('npcPoints');
    const totalToolboxes = sum('toolboxes');
    const totalValue = sum('value');
    const totalWages = sum('wages');
    const totalManagerCost = sum('managerCost');
    const totalNet = sum('net');
    const totalSelfValue = sum('selfValue');
    const ppVal = bundle?.ppValue || 0.0971;
    const inGameProfit = totalNpcPoints * ppVal - totalWages;
    const staffedCount = companiesState.filter((c) => c.npcPoints > 0).length;
    const managedCount = companiesState.filter((c) => Boolean(c.manager)).length;
    const hasAnySim = companiesState.some(isCompanySimulated);

    return {
      companiesCount: companiesState.length,
      staffedCount,
      managedCount,
      totalPoints,
      totalNpcPoints,
      totalToolboxes,
      totalValue,
      totalWages,
      totalManagerCost,
      totalNet,
      totalSelfValue,
      inGameProfit,
      hasAnySim,
    };
  }, [companiesState, bundle?.ppValue]);

  const lowestTaxCountries: LowTaxCountryOpportunity[] = useMemo(() => {
    if (!bundle) return [];
    return getLowestTaxCountries(bundle.countryById, companiesState, 8);
  }, [bundle, companiesState]);

  const bestProducts: BestProductOpportunity[] = useMemo(() => {
    if (!bundle) return [];
    return getBestProductOpportunities(bundle.prices, portfolioTotals.totalPoints, 6);
  }, [bundle, portfolioTotals.totalPoints]);

  const ownerCountryName = useMemo(() => {
    if (!bundle) return '';
    const cId =
      typeof bundle.user.country === 'string'
        ? bundle.user.country
        : bundle.user.countryId || (bundle.user.country as any)?._id;
    return cId && bundle.countryById[cId] ? bundle.countryById[cId].name : '';
  }, [bundle]);

  return (
    <div className="space-y-6">
      {/* Top Action & Search Bar */}
      <div className="p-4 sm:p-5 bg-slate-900/90 border border-slate-800 rounded-2xl space-y-4">
        <div className="flex flex-col lg:flex-row lg:items-center justify-between gap-4">
          <div className="space-y-1">
            <div className="flex items-center gap-2.5 flex-wrap">
              <Building2 className="w-5 h-5 text-amber-400" />
              <h3 className="text-base sm:text-lg font-black text-white tracking-tight uppercase">
                Live Company, Manager &amp; Bot Workforce Telemetry
              </h3>
              <span className="px-2.5 py-0.5 rounded-md bg-amber-500/15 text-amber-300 border border-amber-500/30 text-xs font-mono font-bold">
                v0.27 Live API
              </span>
            </div>
            <p className="text-xs sm:text-sm text-slate-300">
              Full 14-day production logs (Engine, Employees, Self-work), live bot rosters, production bonus breakdowns, manager contracts, and interactive &ldquo;What-If…&rdquo; simulators.
            </p>
          </div>

          <div className="flex items-center gap-2.5 flex-wrap shrink-0">
            <button
              type="button"
              onClick={() => {
                setGuideStep(0);
                setIsGuideOpen(true);
              }}
              className="px-3.5 py-2 rounded-xl bg-amber-500/15 hover:bg-amber-500/25 text-amber-300 border border-amber-500/40 text-xs sm:text-sm font-bold flex items-center gap-2 transition shadow-sm cursor-pointer"
            >
              <BookOpen className="w-4 h-4 text-amber-400" />
              <span>📜 How work runs now (v0.27 Guide)</span>
            </button>

            {bundle && (
              <button
                type="button"
                onClick={() => loadPlayerBundle(bundle.user, true)}
                disabled={isLoadingBundle}
                className="px-3.5 py-2 rounded-xl bg-indigo-600 hover:bg-indigo-500 text-white border border-indigo-500/40 text-xs sm:text-sm font-bold flex items-center gap-2 transition disabled:opacity-50 cursor-pointer"
              >
                <RefreshCw className={`w-4 h-4 ${isLoadingBundle ? 'animate-spin' : ''}`} />
                <span>{isLoadingBundle ? 'Syncing…' : 'Refresh Live Telemetry'}</span>
              </button>
            )}
          </div>
        </div>

        {/* Player Search Bar + Audited Citizen Quick Picker (when enabled) */}
        {showPlayerSearch && (
          <div className="pt-3 border-t border-slate-800 space-y-3">
            <form onSubmit={(e) => handleSearchSubmit(e)} className="flex flex-col sm:flex-row gap-2.5">
              <div className="relative flex-1">
                <Search className="w-4 h-4 text-slate-400 absolute left-3.5 top-1/2 -translate-y-1/2" />
                <input
                  type="text"
                  value={searchQuery}
                  onChange={(e) => setSearchQuery(e.target.value)}
                  placeholder="Enter any War Era player username (e.g. Boteracula_Marroquin)..."
                  className="w-full h-10 pl-10 pr-4 bg-slate-950 border border-slate-700 rounded-xl text-sm text-white placeholder-slate-500 focus:outline-none focus:border-amber-500"
                />
              </div>
              <button
                type="submit"
                disabled={isSearching || isLoadingBundle}
                className="h-10 px-5 rounded-xl bg-amber-500 hover:bg-amber-400 text-slate-950 font-black text-sm transition disabled:opacity-50 cursor-pointer shrink-0"
              >
                {isSearching || isLoadingBundle ? 'Analysing…' : 'Analyse Player'}
              </button>

              {profiles.length > 0 && (
                <select
                  value={bundle?.user?._id || ''}
                  onChange={(e) => {
                    const p = profiles.find((item) => item.userId === e.target.value);
                    if (p) {
                      loadPlayerBundle({
                        _id: p.userId,
                        username: p.username,
                        country: p.countryId,
                        level: p.level,
                      });
                    }
                  }}
                  className="h-10 px-3 bg-slate-950 border border-slate-700 rounded-xl text-xs sm:text-sm text-slate-200 font-semibold focus:outline-none focus:border-amber-500"
                >
                  <option value="">— Or Pick Audited Citizen ({profiles.length}) —</option>
                  {profiles.slice(0, 60).map((p) => (
                    <option key={p.userId} value={p.userId}>
                      {p.username} (Lvl {p.level} · {p.companiesCount || 0} Comp)
                    </option>
                  ))}
                </select>
              )}
            </form>

            {/* Recent Searches Chips */}
            {recentSearches.length > 0 && (
              <div className="flex items-center gap-2 flex-wrap text-xs">
                <span className="text-slate-400 font-semibold">Recent players:</span>
                {recentSearches.map((name) => (
                  <button
                    key={name}
                    type="button"
                    onClick={() => {
                      setSearchQuery(name);
                      handleSearchSubmit(undefined, name);
                    }}
                    className={`px-2.5 py-1 rounded-lg font-mono font-bold border transition cursor-pointer ${
                      bundle?.user?.username?.toLowerCase() === name.toLowerCase()
                        ? 'bg-amber-500/20 text-amber-300 border-amber-500/40'
                        : 'bg-slate-950 text-slate-300 border-slate-800 hover:border-slate-700 hover:text-white'
                    }`}
                  >
                    {name}
                  </button>
                ))}
              </div>
            )}

            {/* Disambiguation Picker */}
            {searchCandidates.length > 1 && (
              <div className="p-3 rounded-xl bg-slate-950 border border-amber-500/40 space-y-2">
                <div className="text-xs font-bold text-amber-300">
                  Several players match. Select a player to analyse:
                </div>
                <div className="flex items-center gap-2 flex-wrap">
                  {searchCandidates.map((u) => (
                    <button
                      key={u._id}
                      type="button"
                      onClick={() => loadPlayerBundle(u)}
                      className="px-3 py-1.5 rounded-xl bg-slate-900 hover:bg-slate-800 border border-slate-700 text-xs sm:text-sm font-bold text-white flex items-center gap-2 transition cursor-pointer"
                    >
                      <span>{u.username}</span>
                      <span className="text-xs font-mono text-amber-400">
                        lvl {u.leveling?.level ?? u.level ?? '?'}
                      </span>
                    </button>
                  ))}
                </div>
              </div>
            )}
          </div>
        )}

        {/* Status / Loading Banner */}
        {(statusMessage || isLoadingBundle) && (
          <div
            className={`px-4 py-2.5 rounded-xl border text-xs sm:text-sm font-mono flex items-center gap-2.5 ${
              statusError
                ? 'bg-rose-950/40 border-rose-500/40 text-rose-300'
                : 'bg-slate-950 border-slate-800 text-amber-300'
            }`}
          >
            {isLoadingBundle && <RefreshCw className="w-4 h-4 animate-spin text-amber-400 shrink-0" />}
            <span>{statusMessage || 'Loading company records…'}</span>
          </div>
        )}

        {/* API Key Notice if work.* or employee.getCompanyRoster returned 401 */}
        {bundle && bundle.authStatus !== 'authenticated' && (
          <div className="p-3.5 rounded-xl bg-amber-950/30 border border-amber-500/40 flex items-start gap-3 text-xs sm:text-sm text-amber-200">
            <KeyRound className="w-5 h-5 text-amber-400 shrink-0 mt-0.5" />
            <div className="space-y-1">
              <div className="font-bold text-amber-300">
                War Era API Token Required for Live Bot Roster &amp; 14-Day Work Logs
              </div>
              <p className="text-slate-300 leading-relaxed">
                Public company infrastructure, upgrades, and manager contracts are loaded below. To unlock{' '}
                <code className="text-amber-300 font-mono">employee.getCompanyRoster</code> (live bot names, Production stats, Bonus % breakdowns, Happiness) and{' '}
                <code className="text-amber-300 font-mono">work.getStatsByCompany</code> (14-day stacked output bars), ensure a valid War Era API key is saved in the top header settings.
              </p>
            </div>
          </div>
        )}
      </div>

      {/* Main Results Container */}
      {bundle && companiesState.length > 0 && (
        <div className="space-y-6">
          {/* Player Identity Banner + 8-Tile Portfolio Summary Grid (Screenshot 4) */}
          <div className="p-5 bg-slate-900/90 border border-slate-800 rounded-2xl space-y-5">
            <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 border-b border-slate-800 pb-4">
              <div>
                <h2 className="text-xl sm:text-2xl font-black text-white tracking-wide uppercase">
                  {bundle.user.username}
                </h2>
                <div className="flex items-center gap-3 flex-wrap text-xs sm:text-sm text-slate-300 mt-1 font-medium">
                  {ownerCountryName && (
                    <span className="inline-flex items-center gap-1.5 font-bold text-slate-200">
                      <WareraCountryFlag countryName={ownerCountryName} size="sm" />
                      <span>{ownerCountryName}</span>
                    </span>
                  )}
                  <span className="text-slate-600">·</span>
                  <span className="font-mono text-white">
                    {`Level ${bundle.user.leveling?.level ?? bundle.user.level ?? '?'}`}
                  </span>
                  <span className="text-slate-600">·</span>
                  <span
                    className="inline-flex items-center gap-1.5 px-2.5 py-0.5 rounded-lg bg-emerald-500/15 border border-emerald-500/30 text-emerald-300 font-mono font-bold"
                    title="+2% employee output per point in the player's own companies; it is also what a manager is paid for."
                  >
                    {`Management ${bundle.ownerMgmtPoints} pts · +${bundle.ownerMgmtBonusPct}%`}
                  </span>
                  {bundle.ppValue > 0 && (
                    <>
                      <span className="text-slate-600">·</span>
                      <span className="text-xs font-mono text-slate-400">
                        <span>In-Game Point Value:</span> <strong className="text-amber-300">{`${formatNum(bundle.ppValue, 4)} BTC/pt`}</strong>
                      </span>
                    </>
                  )}
                </div>
              </div>

              {portfolioTotals.hasAnySim && (
                <button
                  type="button"
                  onClick={() => {
                    const resetList = companiesState.map((c) => ({ ...c, ov: null, noSupply: false }));
                    setEditingEmp(null);
                    recomputePortfolio(resetList);
                  }}
                  className="px-3.5 py-2 rounded-xl bg-amber-500/20 hover:bg-amber-500/30 text-amber-300 border border-amber-500/40 text-xs sm:text-sm font-bold flex items-center gap-2 transition self-start sm:self-center cursor-pointer"
                >
                  <RotateCcw className="w-4 h-4" />
                  <span>Reset All Simulations</span>
                </button>
              )}
            </div>

            {/* 8-Tile Summary Grid */}
            <div className="grid grid-cols-2 lg:grid-cols-4 gap-3.5">
              {/* Tile 1: Companies */}
              <div className="p-4 rounded-xl bg-slate-950 border border-slate-800 space-y-1">
                <div className="text-xs font-bold uppercase tracking-wider text-slate-400">
                  Companies
                </div>
                <div className="text-2xl sm:text-3xl font-black text-white font-mono tabular-nums">
                  {portfolioTotals.companiesCount}
                </div>
                <div className="text-xs text-slate-400">
                  {`${portfolioTotals.staffedCount} with working employees · ${portfolioTotals.managedCount} with a manager`}
                </div>
              </div>

              {/* Tile 2: Output */}
              <div className="p-4 rounded-xl bg-slate-950 border border-slate-800 space-y-1">
                <div className="text-xs font-bold uppercase tracking-wider text-slate-400">
                  Output
                </div>
                <div className="text-2xl sm:text-3xl font-black text-amber-300 font-mono tabular-nums">
                  {formatNum(portfolioTotals.totalPoints, 1)}
                </div>
                <div className="text-xs text-slate-400">production points per day</div>
              </div>

              {/* Tile 3: Toolboxes */}
              <div className="p-4 rounded-xl bg-slate-950 border border-slate-800 space-y-1">
                <div className="text-xs font-bold uppercase tracking-wider text-slate-400">
                  Toolboxes
                </div>
                <div className="text-2xl sm:text-3xl font-black text-cyan-300 font-mono tabular-nums">
                  {formatNum(portfolioTotals.totalToolboxes, 1)}
                </div>
                <div className="text-xs text-slate-400">expected finds per day</div>
              </div>

              {/* Tile 4: Goods Value */}
              <div className="p-4 rounded-xl bg-slate-950 border border-slate-800 space-y-1">
                <div className="text-xs font-bold uppercase tracking-wider text-slate-400">
                  Goods Value
                </div>
                <div className="text-2xl sm:text-3xl font-black text-white font-mono tabular-nums">
                  {formatNum(portfolioTotals.totalValue, 2)}
                </div>
                <div className="text-xs text-slate-400">per day, at market price</div>
              </div>

              {/* Tile 5: Employee Wages */}
              <div className="p-4 rounded-xl bg-slate-950 border border-slate-800 space-y-1">
                <div className="text-xs font-bold uppercase tracking-wider text-slate-400">
                  Employee Wages
                </div>
                <div className="text-2xl sm:text-3xl font-black text-rose-400 font-mono tabular-nums">
                  {formatSigned(-portfolioTotals.totalWages, 2)}
                </div>
                <div className="text-xs text-slate-400">per day</div>
              </div>

              {/* Tile 6: Managers */}
              <div className="p-4 rounded-xl bg-slate-950 border border-slate-800 space-y-1">
                <div className="text-xs font-bold uppercase tracking-wider text-slate-400">
                  Managers
                </div>
                <div className="text-2xl sm:text-3xl font-black text-rose-300 font-mono tabular-nums">
                  {formatSigned(-portfolioTotals.totalManagerCost, 2)}
                </div>
                <div className="text-xs text-slate-400">per day</div>
              </div>

              {/* Tile 7: Net */}
              <div
                className={`p-4 rounded-xl bg-slate-950 border space-y-1 ${
                  portfolioTotals.totalNet >= 0
                    ? 'border-emerald-500/40 bg-emerald-950/15'
                    : 'border-rose-500/40 bg-rose-950/15'
                }`}
              >
                <div className="text-xs font-bold uppercase tracking-wider text-slate-300">
                  Net
                </div>
                <div
                  className={`text-2xl sm:text-3xl font-black font-mono tabular-nums ${
                    portfolioTotals.totalNet >= 0 ? 'text-emerald-400' : 'text-rose-400'
                  }`}
                >
                  {formatSigned(portfolioTotals.totalNet, 2)}
                </div>
                <div className="text-xs text-slate-300">
                  per day, at market price
                  {portfolioTotals.hasAnySim ? ' · includes simulations' : ''}
                  {portfolioTotals.totalSelfValue > 0
                    ? ` · ${formatSigned(
                        portfolioTotals.totalNet + portfolioTotals.totalSelfValue,
                        2
                      )} with today's self-work`
                    : ''}
                </div>
              </div>

              {/* Tile 8: In-Game Profit */}
              <div
                className={`p-4 rounded-xl bg-slate-950 border space-y-1 ${
                  portfolioTotals.inGameProfit >= 0
                    ? 'border-emerald-500/30'
                    : 'border-rose-500/30'
                }`}
              >
                <div className="text-xs font-bold uppercase tracking-wider text-slate-400">
                  In-Game Profit
                </div>
                <div
                  className={`text-2xl sm:text-3xl font-black font-mono tabular-nums ${
                    portfolioTotals.inGameProfit >= 0 ? 'text-emerald-400' : 'text-rose-400'
                  }`}
                >
                  {bundle.ppValue ? formatSigned(portfolioTotals.inGameProfit, 2) : '—'}
                </div>
                <div className="text-xs text-slate-400">
                  per day: employees only, as the Workforce panel shows it
                </div>
              </div>
            </div>
          </div>

          {/* Macro Opportunity Strips: Lowest-Tax Countries & Best Products Right Now */}
          <div className="grid grid-cols-1 xl:grid-cols-2 gap-5">
            {/* Lowest-Tax Countries */}
            {lowestTaxCountries.length > 0 && (
              <div className="p-5 bg-slate-900/90 border border-slate-800 rounded-2xl space-y-3.5">
                <div className="flex items-center gap-2">
                  <h3 className="text-sm sm:text-base font-black text-white uppercase tracking-wider">
                    Lowest-Tax Countries
                  </h3>
                  <InfoHelpPopover text="Deposits and region bonuses are gone; employees of a company in its owner's own country get +5%, so moving abroad trades that away. Each 1% of income tax costs employees 1 happiness (1% output), and market tax is taken from what you sell. Sorted by income tax, then market tax." />
                </div>
                <div className="grid grid-cols-1 sm:grid-cols-2 gap-2.5">
                  {lowestTaxCountries.map((entry) => (
                    <div
                      key={entry.country._id}
                      className={`p-3 rounded-xl border flex items-center justify-between gap-2 ${
                        entry.hasCompanyHere
                          ? 'bg-emerald-950/25 border-emerald-500/40'
                          : 'bg-slate-950 border-slate-800'
                      }`}
                    >
                      <div className="min-w-0">
                        <div className="font-bold text-white text-sm truncate flex items-center gap-2">
                          <WareraCountryFlag
                            countryName={entry.country.name}
                            countryCode={entry.country.code}
                            size="sm"
                          />
                          <span className="truncate">{entry.country.name}</span>
                          {entry.hasCompanyHere && (
                            <span className="px-1.5 py-0.5 rounded bg-emerald-500/20 text-emerald-300 text-[11px] font-mono shrink-0">
                              has a company here
                            </span>
                          )}
                        </div>
                        <div className="text-xs font-mono text-slate-400 mt-0.5">
                          {`income ${formatNum(entry.incomeTax, 0)}% · market ${formatNum(entry.marketTax, 0)}%`}
                        </div>
                      </div>
                    </div>
                  ))}
                </div>
              </div>
            )}

            {/* Best Products Right Now */}
            {bestProducts.length > 0 && (
              <div className="p-5 bg-slate-900/90 border border-slate-800 rounded-2xl space-y-3.5">
                <div className="flex items-center gap-2">
                  <h3 className="text-sm sm:text-base font-black text-white uppercase tracking-wider">
                    Best Products Right Now
                  </h3>
                  <InfoHelpPopover text="Market value of one production point for each product: price, minus raw materials bought on the market, divided by the points a unit needs. It changes with prices." />
                </div>
                <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-2.5">
                  {bestProducts.map((bp, idx) => (
                    <div
                      key={bp.item.id}
                      className="p-3 rounded-xl bg-slate-950 border border-slate-800 flex items-center gap-3"
                    >
                      <span className="text-sm font-black font-mono text-amber-400 w-4 shrink-0">
                        {idx + 1}
                      </span>
                      <WareraItemIcon itemCode={bp.item.id} size="md" />
                      <div className="min-w-0">
                        <div className="font-bold text-white text-sm truncate">
                          {translateCommodity(bp.item.name)}
                        </div>
                        <div className="text-xs font-mono text-slate-300 leading-snug">
                          <div>{`${formatNum(bp.valuePer100Pts, 3)} per 100 pts`}</div>
                          {portfolioTotals.totalPoints > 0 && (
                            <div className="text-emerald-400 font-semibold">
                              {`${formatNum(bp.dailyAtOutput, 2)}/day at this output`}
                            </div>
                          )}
                        </div>
                      </div>
                    </div>
                  ))}
                </div>
              </div>
            )}
          </div>

          {/* Expandable Company Cards List */}
          <div className="space-y-4">
            {companiesState.map((c, compIdx) => {
              const compId = c.company._id;
              const isOpen = openCompanyIds.has(compId);
              const isSimOpen = openSimCompanyIds.has(compId);
              const hasSim = isCompanySimulated(c);
              const tags = getCompanyDiagnosticTags(c);
              const up = c.company.activeUpgradeLevels || {};
              const npcShare = c.points > 0 ? Math.round((c.npcPoints / c.points) * 100) : 0;
              const totalDailyCosts = c.wages + c.managerCost;
              const ptValue = c.unitValue / c.pp;
              const workingEmps = c.emps.filter((e) => !e.off);
              const moveTargets = companiesState
                .map((x, j) => ({ targetComp: x, targetIdx: j }))
                .filter(
                  ({ targetComp, targetIdx }) =>
                    targetIdx !== compIdx &&
                    targetComp.emps.filter((e) => !e.off).length < targetComp.cap
                );

              const canSupplyOwnFactory =
                c.item?.type === 'raw' &&
                companiesState.some((x) => x.item?.raw === (c.item?.id || c.company.itemCode));

              // What-If simulator live preview calculations
              const formState = simForms[compId] || {
                hireProd: 3,
                hireExp: 100,
                mgrLvl: c.manager?.managementLevel ?? 5,
                mgrRate: 0.01,
                altItem: 'cookedFish',
              };
              const curMgrPct =
                c.manager && !c.manager.isInactive
                  ? managerPct(c.manager.managementLevel ?? 0)
                  : 0;
              const homePct = c.home ? HOME_PCT : 0;
              const calcMult = (mPct: number) =>
                1 +
                (Math.min(MGMT_CAP_PCT, bundle.ownerMgmtPoints * MGMT_PCT + mPct) + homePct) /
                  100;

              const baseHour = formState.hireProd * PTS_PER_LEVEL_HOUR;
              const simHireWageDay =
                baseHour * bundle.ppValue * (formState.hireExp / 100) * 24;
              const simHirePtsDay = baseHour * 24 * calcMult(curMgrPct);
              const simHireWorthDay = simHirePtsDay * ptValue;
              const simHireNetDay = simHireWorthDay - simHireWageDay;

              const simMgrPct = managerPct(formState.mgrLvl);
              const simMgrWageDay =
                formState.mgrRate * managerPoints(formState.mgrLvl) * 24;
              const npcBaseWithoutMgr =
                calcMult(curMgrPct) > 0 ? c.npcPoints / calcMult(curMgrPct) : 0;
              const simMgrExtraPts =
                npcBaseWithoutMgr * (calcMult(simMgrPct) - calcMult(0));
              const simMgrGainWorth = simMgrExtraPts * ptValue;
              const simMgrNet = simMgrGainWorth - simMgrWageDay;

              const altItemObj = CANONICAL_COMPANY_ITEMS.find(
                (x) => x.id === formState.altItem
              );
              const altPtVal = calculatePointValue(formState.altItem, bundle.prices) || 0;
              const altDailyValue = c.points * altPtVal;
              const currentDailyValue = c.points * ptValue;
              const altDiffValue = altDailyValue - currentDailyValue;

              let balanceWhy = '';
              if (c.points === 0) {
                balanceWhy = tx(
                  'Nothing was produced in this period.',
                  'No se produjo nada en este período.'
                );
              } else if (c.unitValue <= 0) {
                balanceWhy = tx(
                  `Each ${c.item?.name || 'unit'} sells for less than the raw materials it uses, so more output means more loss.`,
                  `Cada ${translateCommodity(c.item?.name || 'unidad')} se vende por menos que las materias primas que consume, por lo que producir más genera más pérdida.`
                );
              } else if (c.net < 0) {
                balanceWhy = tx(
                  `Wages${c.managerCost ? ' and the manager' : ''} (${formatNum(c.wages + c.managerCost, 2)}) cost more than the goods are worth (${formatNum(c.value, 2)}).`,
                  `Los salarios${c.managerCost ? ' y el gerente' : ''} (${formatNum(c.wages + c.managerCost, 2)}) cuestan más de lo que valen los bienes (${formatNum(c.value, 2)}).`
                );
              } else {
                balanceWhy = tx(
                  `The goods (${formatNum(c.value, 2)}) cover wages${c.managerCost ? ' and the manager' : ''} (${formatNum(c.wages + c.managerCost, 2)}).`,
                  `Los bienes (${formatNum(c.value, 2)}) cubren los salarios${c.managerCost ? ' y al gerente' : ''} (${formatNum(c.wages + c.managerCost, 2)}).`
                );
              }

              return (
                <div
                  key={compId}
                  className="bg-slate-900/95 border border-slate-800 rounded-2xl overflow-hidden shadow-md transition hover:border-slate-700"
                >
                  {/* Summary Header Row */}
                  <div
                    role="button"
                    tabIndex={0}
                    onClick={() => {
                      const next = new Set(openCompanyIds);
                      if (next.has(compId)) next.delete(compId);
                      else next.add(compId);
                      setOpenCompanyIds(next);
                    }}
                    onKeyDown={(e) => {
                      if (e.key === 'Enter' || e.key === ' ') {
                        e.preventDefault();
                        const next = new Set(openCompanyIds);
                        if (next.has(compId)) next.delete(compId);
                        else next.add(compId);
                        setOpenCompanyIds(next);
                      }
                    }}
                    className="p-4 sm:p-5 grid grid-cols-2 lg:grid-cols-12 gap-4 items-center cursor-pointer select-none hover:bg-slate-800/40 transition"
                  >
                    {/* Col 1-4: Company Identity & Diagnostic Tags */}
                    <div className="col-span-2 lg:col-span-4 flex items-center gap-3.5 min-w-0">
                      <WareraItemIcon itemCode={c.item?.id || c.company.itemCode} size="lg" />
                      <div className="min-w-0 space-y-1">
                        <div className="flex items-center gap-2 flex-wrap">
                          <h3 className="text-base sm:text-lg font-black text-white uppercase tracking-tight truncate">
                            {c.company.name}
                          </h3>
                          {hasSim && (
                            <span
                              className="px-2 py-0.5 rounded bg-amber-500 text-slate-950 text-xs font-mono font-black uppercase"
                              title="Figures include your simulated changes"
                            >
                              sim
                            </span>
                          )}
                        </div>
                        <div className="text-xs sm:text-sm text-slate-300 font-medium flex items-center gap-1.5 flex-wrap">
                          <span className="font-bold text-amber-300">
                            {translateCommodity(c.item?.name || c.company.itemCode)}
                          </span>
                          <span>·</span>
                          <span className="inline-flex items-center gap-1.5">
                            {c.country?.name && (
                              <>
                                <WareraCountryFlag
                                  countryName={c.country.name}
                                  countryCode={c.country.code}
                                  size="xs"
                                />
                                <span>{c.country.name} ·</span>
                              </>
                            )}
                            <span>{c.region?.name || c.company.region || 'Verified Region'}</span>
                          </span>
                        </div>
                        {tags.length > 0 && (
                          <div className="flex items-center gap-1.5 flex-wrap pt-0.5">
                            {tags.map((t, tIdx) => (
                              <span
                                key={tIdx}
                                title={t.tip}
                                className={`px-2 py-0.5 rounded text-xs font-mono font-bold border ${
                                  t.tone === 'bad'
                                    ? 'bg-rose-500/15 text-rose-300 border-rose-500/30'
                                    : t.tone === 'warn'
                                    ? 'bg-amber-500/15 text-amber-300 border-amber-500/30'
                                    : 'bg-cyan-500/15 text-cyan-300 border-cyan-500/30'
                                }`}
                              >
                                {t.label}
                              </span>
                            ))}
                          </div>
                        )}
                      </div>
                    </div>

                    {/* Col 5-6: OUTPUT / DAY */}
                    <div className="lg:col-span-2 font-mono">
                      <div className="text-xs uppercase font-sans font-bold text-slate-400">
                        Output / Day
                      </div>
                      <div className="text-base sm:text-lg font-black text-white tabular-nums">
                        {`${formatNum(c.points, 1)} pts`}
                      </div>
                      <div className="text-xs text-slate-400 font-sans">
                        {`${formatNum(c.points / c.pp, 2)} ${translateCommodity(c.item?.name || 'units')}`}
                      </div>
                    </div>

                    {/* Col 7-8: BY EMPLOYEES */}
                    <div className="lg:col-span-2 font-mono">
                      <div className="text-xs uppercase font-sans font-bold text-slate-400">
                        By Employees
                      </div>
                      <div className="text-base sm:text-lg font-black text-white tabular-nums">
                        {`${npcShare}%`}
                      </div>
                      <div className="text-xs text-slate-400 font-sans">
                        {`${formatNum(c.npcPoints, 1)} pts · engine ${c.engineLvl}`}
                      </div>
                    </div>

                    {/* Col 9: COSTS / DAY */}
                    <div className="lg:col-span-1 font-mono">
                      <div className="text-xs uppercase font-sans font-bold text-slate-400">
                        Costs / Day
                      </div>
                      <div className="text-base sm:text-lg font-black text-rose-400 tabular-nums">
                        −{formatNum(totalDailyCosts, 2)}
                      </div>
                      <div className="text-xs text-slate-400 font-sans">
                        {`wages ${formatNum(c.wages, 2)} · mgr ${formatNum(c.managerCost, 2)}`}
                      </div>
                    </div>

                    {/* Col 10-11: MANAGER */}
                    <div className="lg:col-span-2 font-mono min-w-0">
                      <div className="text-xs uppercase font-sans font-bold text-slate-400">
                        Manager
                      </div>
                      {c.manager ? (
                        <>
                          <div className="text-sm sm:text-base font-black text-white truncate font-sans">
                            {c.managerUser?.username || 'Active Manager'}
                          </div>
                          <div className="text-xs text-emerald-400">
                            +{formatNum(c.manager.productionBonusPercent, 0)}% ·{' '}
                            {formatNum(managerHourly(c.manager), 3)}/h
                          </div>
                        </>
                      ) : c.offer ? (
                        <>
                          <div className="text-sm sm:text-base font-bold text-amber-300 font-sans">
                            Hiring
                          </div>
                          <div className="text-xs text-slate-400">
                            up to {formatNum(c.offer.maxHourlyWage, 3)}/h
                          </div>
                        </>
                      ) : (
                        <>
                          <div className="text-sm sm:text-base font-bold text-slate-500 font-sans">
                            None
                          </div>
                          <div className="text-xs text-slate-500">no bonus</div>
                        </>
                      )}
                    </div>

                    {/* Col 12: NET / DAY */}
                    <div className="col-span-2 lg:col-span-1 flex items-center justify-between lg:justify-end gap-3">
                      <div
                        className={`px-3.5 py-2 rounded-xl border font-mono text-right min-w-[115px] ${
                          c.net >= 0
                            ? 'bg-emerald-950/30 border-emerald-500/40'
                            : 'bg-rose-950/30 border-rose-500/40'
                        }`}
                      >
                        <div className="text-xs uppercase font-sans font-bold text-slate-300">
                          Net / Day
                        </div>
                        <div
                          className={`text-base sm:text-xl font-black tabular-nums ${
                            c.net >= 0 ? 'text-emerald-400' : 'text-rose-400'
                          }`}
                        >
                          {formatSigned(c.net, 2)}
                        </div>
                        <div className="text-xs text-slate-300 font-sans">
                          {c.company.isFull
                            ? 'Storage full'
                            : c.selfValue > 0
                            ? `${formatSigned(c.net + c.selfValue, 2)} w/ self`
                            : `value ${formatNum(c.value, 2)}`}
                        </div>
                      </div>
                      {isOpen ? (
                        <ChevronUp className="w-5 h-5 text-slate-400 shrink-0" />
                      ) : (
                        <ChevronDown className="w-5 h-5 text-slate-400 shrink-0" />
                      )}
                    </div>
                  </div>

                  {/* Expanded Body */}
                  {isOpen && (
                    <div className="p-5 border-t border-slate-800 bg-slate-950/60 space-y-6">
                      {/* 3-Column Telemetry Grid: Chart + Daily Balance + Manager */}
                      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
                        {/* Column 1: 14-Day Output Chart & Upgrade Pills */}
                        <div className="space-y-4">
                          <CompanyOutputChart company={c} />

                          {/* Upgrade & Tax Pills */}
                          <div className="flex items-center gap-2 flex-wrap">
                            <span
                              className="px-3 py-1 rounded-lg bg-slate-900 border border-slate-800 text-xs font-mono font-bold text-slate-200"
                              title="The engine produces on its own: level × 24 points per day."
                            >
                              {`Engine ${c.engineLvl}`}
                              {c.ov?.engine != null && (
                                <span className="ml-1 text-amber-400 uppercase">sim</span>
                              )}
                            </span>
                            <span className="px-3 py-1 rounded-lg bg-slate-900 border border-slate-800 text-xs font-mono font-bold text-slate-200">
                              {`Storage ${up.storage || 0}`}
                            </span>
                            <span
                              className="px-3 py-1 rounded-lg bg-slate-900 border border-slate-800 text-xs font-mono font-bold text-slate-200"
                              title="The break room sets how many employees the company can hold: 1, 2 or 3."
                            >
                              {`Break Room ${up.breakRoom || 0} · up to ${Math.min(up.breakRoom || 1, 3)} employee${Math.min(up.breakRoom || 1, 3) > 1 ? 's' : ''}`}
                            </span>
                            {c.country?.taxes && (
                              <span
                                className="px-3 py-1 rounded-lg bg-slate-900 border border-slate-800 text-xs font-mono text-slate-300"
                                title="Income tax is taken on employee wages and costs them 1 happiness per 1%. Manager tax is taken on manager pay. Market tax is taken from sales."
                              >
                                {`${c.country.name} tax · income ${formatNum(c.country.taxes.income, 0)}% · manager ${formatNum(
                                  (c.country.taxes as any).manager ?? c.country.taxes.income,
                                  0
                                )}% · market ${formatNum(c.country.taxes.market, 0)}%`}
                              </span>
                            )}
                            {hasSim && (
                              <button
                                type="button"
                                onClick={() => handleResetCompanySim(compIdx)}
                                className="px-3 py-1 rounded-lg bg-amber-500/20 hover:bg-amber-500/30 text-amber-300 border border-amber-500/40 text-xs font-bold transition cursor-pointer"
                              >
                                Reset simulation
                              </button>
                            )}
                          </div>

                          {/* "Supply own factories" Toggle for Raw Resource Companies */}
                          {canSupplyOwnFactory && (
                            <label
                              className="flex items-center gap-2.5 p-3 rounded-xl bg-slate-900 border border-slate-800 text-xs sm:text-sm text-slate-200 cursor-pointer"
                              title="On: this company's output feeds the player's own factories first, so it is not sold and they do not buy it. Off: it sells everything and the factories buy on the market."
                            >
                              <input
                                type="checkbox"
                                checked={!c.noSupply}
                                onChange={(e) =>
                                  handleToggleSupplyOwnFactories(compIdx, e.target.checked)
                                }
                                className="rounded accent-amber-500 w-4 h-4"
                              />
                              <span className="font-bold">Supply own factories</span>
                              {c.sentOut > 0 && (
                                <span className="text-xs font-mono text-cyan-300">
                                  ({formatNum(c.sentOut, 1)} of {formatNum(c.units, 1)} units/day)
                                </span>
                              )}
                            </label>
                          )}
                        </div>

                        {/* Column 2: Daily Balance Ledger */}
                        <div className="p-4 rounded-xl bg-slate-900/80 border border-slate-800 space-y-3">
                          <div className="flex items-center gap-2 border-b border-slate-800 pb-2">
                            <span className="text-xs sm:text-sm font-black uppercase tracking-wider text-slate-200">
                              Daily Balance
                            </span>
                            <InfoHelpPopover
                              text={`Based on the ${c.basis}. Goods value = points ÷ ${c.pp} points per unit × market price${
                                c.item?.raw ? ', minus the raw materials bought on the market' : ''
                              }. Raw goods that feed the player's own factories are neither sold nor bought. Employee output and wages are the game's estimate for the current roster; self-work is left out, since it costs the owner energy; the manager is their hourly wage × 24. Days before v0.27 (player workers) are left out.`}
                            />
                          </div>

                          <dl className="space-y-2 text-xs sm:text-sm font-mono">
                            <div className="flex items-center justify-between">
                              <dt className="font-sans text-slate-300">Output</dt>
                              <dd className="font-bold text-white tabular-nums">
                                {`${formatNum(c.points, 1)} pts · ${formatNum(c.points / c.pp, 2)} units`}
                              </dd>
                            </div>

                            {c.npcPoints > 0 && bundle.ppValue > 0 && (
                              <div
                                className="flex items-center justify-between"
                                title={tx(
                                  `What the companies screen shows: employee points × the value of a point (${formatNum(
                                    bundle.ppValue,
                                    4
                                  )}), minus their wages. Leaves out the engine, self-work and market prices.`,
                                  `Lo que muestra la pantalla de empresas: puntos de empleados × el valor de un punto (${formatNum(
                                    bundle.ppValue,
                                    4
                                  )}), menos sus salarios. No incluye el motor, el autotrabajo ni precios de mercado.`
                                )}
                              >
                                <dt className="font-sans text-slate-300 underline decoration-dotted cursor-help">
                                  In-game employee profit
                                </dt>
                                <dd className="font-bold text-white tabular-nums">
                                  {formatSigned(c.npcPoints * bundle.ppValue - c.wages, 2)}
                                </dd>
                              </div>
                            )}

                            {c.sentOut > 0 && (
                              <div className="flex items-center justify-between">
                                <dt className="font-sans text-cyan-300">To own factories</dt>
                                <dd className="font-bold text-cyan-300 tabular-nums">
                                  {formatNum(c.sentOut, 1)} units, not sold
                                </dd>
                              </div>
                            )}

                            {c.receivedIn > 0 && (
                              <div className="flex items-center justify-between">
                                <dt className="font-sans text-cyan-300">Raw from own companies</dt>
                                <dd className="font-bold text-cyan-300 tabular-nums">
                                  {formatNum(c.receivedIn, 1)} units, not bought
                                </dd>
                              </div>
                            )}

                            <div className="flex items-center justify-between">
                              <dt className="font-sans text-slate-300">Goods value</dt>
                              <dd
                                className={`font-bold tabular-nums ${
                                  c.value >= 0 ? 'text-emerald-400' : 'text-rose-400'
                                }`}
                              >
                                {formatSigned(c.value, 2)}
                              </dd>
                            </div>

                            <div className="flex items-center justify-between">
                              <dt className="font-sans text-slate-300">Employee wages</dt>
                              <dd className="font-bold text-rose-400 tabular-nums">
                                −{formatNum(c.wages, 2)}
                              </dd>
                            </div>

                            <div className="flex items-center justify-between">
                              <dt className="font-sans text-slate-300">Manager</dt>
                              <dd
                                className={`font-bold tabular-nums ${
                                  c.managerCost > 0 ? 'text-rose-400' : 'text-slate-400'
                                }`}
                              >
                                {formatSigned(-c.managerCost, 2)}
                              </dd>
                            </div>

                            <div className="flex items-center justify-between pt-2 border-t border-slate-800 text-sm sm:text-base">
                              <dt className="font-sans font-black text-white uppercase">Net</dt>
                              <dd
                                className={`font-black tabular-nums ${
                                  c.net >= 0 ? 'text-emerald-400' : 'text-rose-400'
                                }`}
                              >
                                {formatSigned(c.net, 2)}
                              </dd>
                            </div>

                            {c.selfValue > 0 && (
                              <div
                                className="flex items-center justify-between text-xs pt-1"
                                title="Self-work you actually did today (UTC), valued like the rest of the output. Not projected into the net."
                              >
                                <dt className="font-sans text-slate-400">With today&apos;s self-work</dt>
                                <dd className="font-bold text-amber-300 tabular-nums">
                                  {formatSigned(c.net + c.selfValue, 2)}{' '}
                                  <span className="text-slate-400">
                                    ({formatNum(c.selfToday, 1)} pts, +{formatNum(c.selfValue, 2)})
                                  </span>
                                </dd>
                              </div>
                            )}
                          </dl>

                          <p
                            className={`text-xs sm:text-sm font-medium pt-1 ${
                              c.net >= 0 ? 'text-emerald-400' : 'text-rose-400'
                            }`}
                          >
                            {balanceWhy}
                          </p>
                          <p className="text-xs italic text-slate-400 leading-relaxed">
                            {c.basis}
                          </p>
                        </div>

                        {/* Column 3: Manager Contract Card */}
                        <div className="p-4 rounded-xl bg-slate-900/80 border border-slate-800 space-y-3">
                          {c.manager ? (
                            <>
                              <div className="flex items-center gap-2 border-b border-slate-800 pb-2">
                                <span className="text-xs sm:text-sm font-black uppercase tracking-wider text-slate-200">
                                  Manager
                                </span>
                                <span
                                  className={`px-2 py-0.5 rounded-full text-xs font-bold border ${
                                    c.manager.isInactive
                                      ? 'bg-amber-500/20 text-amber-300 border-amber-500/40'
                                      : 'bg-emerald-500/20 text-emerald-300 border-emerald-500/40'
                                  }`}
                                >
                                  {c.manager.isInactive ? 'INACTIVE' : 'ACTIVE'}
                                </span>
                                <InfoHelpPopover text="A manager is a player paid every hour: the owner sets a rate per Management point. They add +2% employee output per point (up to +22%), care for one employee a day (+5 happiness for 48 h), and the country takes its manager tax on their pay. Neither side can end a new contract for 24 hours." />
                              </div>

                              <div className="flex items-baseline gap-2 flex-wrap">
                                <span className="text-base sm:text-lg font-black text-white">
                                  {c.managerUser?.username || 'Active Manager'}
                                </span>
                                <span className="text-xs sm:text-sm text-slate-400 font-mono">
                                  {`management ${c.manager.managementLevel ?? 0}`}
                                </span>
                              </div>

                              <dl className="space-y-2 text-xs sm:text-sm font-mono pt-1">
                                <div className="flex items-center justify-between">
                                  <dt className="font-sans text-slate-300">Bonus to employees</dt>
                                  <dd className="font-bold text-emerald-400 tabular-nums">
                                    +{formatNum(c.manager.productionBonusPercent, 0)}%
                                  </dd>
                                </div>
                                <div className="flex items-center justify-between">
                                  <dt className="font-sans text-slate-300">Wage</dt>
                                  <dd className="font-bold text-white tabular-nums">
                                    {`${formatNum(managerHourly(c.manager), 3)}/h · ${formatNum(managerHourly(c.manager) * 24, 2)}/day`}
                                  </dd>
                                </div>
                                <div className="flex items-center justify-between">
                                  <dt className="font-sans text-slate-300">Earned so far</dt>
                                  <dd className="font-bold text-white tabular-nums">
                                    {formatNum(c.manager.totalEarned, 3)}
                                  </dd>
                                </div>
                                <div className="flex items-center justify-between">
                                  <dt className="font-sans text-slate-300">Contract</dt>
                                  <dd className="font-bold text-white">
                                    {new Date(
                                      c.manager.canEndAt || c.manager.lockedUntil || 0
                                    ) > new Date()
                                      ? `locked until ${new Date(
                                          c.manager.canEndAt || c.manager.lockedUntil || ''
                                        )
                                          .toUTCString()
                                          .slice(5, 22)} UTC`
                                      : 'can be ended'}
                                  </dd>
                                </div>
                              </dl>
                            </>
                          ) : c.offer ? (
                            <>
                              <div className="flex items-center gap-2 border-b border-slate-800 pb-2">
                                <span className="text-xs sm:text-sm font-black uppercase tracking-wider text-amber-300">
                                  Looking for a manager
                                </span>
                              </div>
                              <p className="text-xs sm:text-sm text-slate-300 font-mono leading-relaxed">
                                {c.offer.rateManagement != null
                                  ? `Pays ${formatNum(
                                      c.offer.rateManagement,
                                      3
                                    )}/h per Management point · `
                                  : ''}
                                up to {formatNum(c.offer.maxHourlyWage, 3)}/h.
                              </p>
                            </>
                          ) : (
                            <>
                              <div className="flex items-center gap-2 border-b border-slate-800 pb-2">
                                <span className="text-xs sm:text-sm font-black uppercase tracking-wider text-slate-400">
                                  No manager
                                </span>
                                <InfoHelpPopover text="Without a manager the employees work without the manager bonus. Owners can post a manager position from the company screen." />
                              </div>
                              <p className="text-xs sm:text-sm text-slate-400 leading-relaxed">
                                {tx(
                                  'This company currently has no manager assigned. Open the ',
                                  'Esta empresa no tiene un gerente asignado actualmente. Abre el simulador '
                                )}
                                <strong className="text-slate-200">{tx('What if…', '¿Qué pasaría si…?')}</strong>
                                {tx(
                                  ' simulator below to test hiring a manager.',
                                  ' abajo para probar contratar a un gerente.'
                                )}
                              </p>
                            </>
                          )}
                        </div>
                      </div>

                      {/* Live Bot Employees Roster Table */}
                      <div className="p-4 rounded-xl bg-slate-900/90 border border-slate-800 space-y-3">
                        <div className="flex items-center gap-2.5 flex-wrap">
                          <span className="text-xs sm:text-sm font-black uppercase tracking-wider text-white">
                            Employees
                          </span>
                          <span
                            className={`px-2.5 py-0.5 rounded-full text-xs font-mono font-bold border ${
                              workingEmps.length > 0
                                ? 'bg-emerald-500/20 text-emerald-300 border-emerald-500/40'
                                : 'bg-slate-800 text-slate-400 border-slate-700'
                            }`}
                          >
                            {`${workingEmps.length} of ${c.cap}`}
                          </span>
                          <InfoHelpPopover text="Straight from the game: each employee's Production stat, total bonus (hover for Management, home region, happiness, specialization…), happiness, and the game's own hourly estimate of output and wage, here per day. Use ⋯ to simulate: edit Production and bonus, deactivate, or move an employee to another company with room. Simulated output follows Production ÷ 4 × the bonus." />
                        </div>

                        {c.emps.length > 0 ? (
                          <div className="overflow-x-auto">
                            <table className="w-full text-left text-xs sm:text-sm">
                              <thead className="text-xs uppercase font-mono text-slate-400 border-b border-slate-800">
                                <tr>
                                  <th className="py-2.5 px-3">Name</th>
                                  <th className="py-2.5 px-3 text-right">Production</th>
                                  <th className="py-2.5 px-3 text-right">Bonus</th>
                                  <th className="py-2.5 px-3 text-right">Happiness</th>
                                  <th className="py-2.5 px-3 text-right">Pts/Day</th>
                                  <th className="py-2.5 px-3 text-right">Wage/Day</th>
                                  <th
                                    className="py-2.5 px-3 text-right"
                                    title="At live market price"
                                  >
                                    Net/Day
                                  </th>
                                  <th
                                    className="py-2.5 px-3 text-right"
                                    title="What the companies screen shows: points × the point value − wage"
                                  >
                                    In Game
                                  </th>
                                  <th className="py-2.5 px-3 text-right">Simulate</th>
                                </tr>
                              </thead>
                              <tbody className="divide-y divide-slate-800/70 font-mono">
                                {c.emps.map((emp, empIdx) => {
                                  const ptsDay = emp.off ? 0 : emp.ptsH * 24;
                                  const wageDay = emp.off ? 0 : emp.wageH * 24;
                                  const netDay = ptsDay * ptValue - wageDay;
                                  const inGameDay = ptsDay * bundle.ppValue - wageDay;
                                  const isEditing =
                                    editingEmp?.companyId === compId &&
                                    editingEmp?.empIndex === empIdx;

                                  return (
                                    <tr
                                      key={emp.id || `emp-${empIdx}`}
                                      className={`transition ${
                                        emp.off
                                          ? 'opacity-50 bg-slate-950/40'
                                          : 'hover:bg-slate-800/40'
                                      }`}
                                    >
                                      <td
                                        className="py-3 px-3 font-sans font-bold text-white"
                                        title={
                                          emp.traits
                                            ? `Revealed Traits: ${emp.traits}`
                                            : emp.sim === 'added'
                                            ? 'Simulated employee'
                                            : 'Private traits (unrevealed on public API)'
                                        }
                                      >
                                        <div className="flex items-center gap-2 flex-wrap">
                                          <span>{emp.name}</span>
                                          {emp.nationality && (
                                            <span className="px-1.5 py-0.5 rounded bg-slate-800 text-slate-300 text-xs font-mono">
                                              {emp.nationality}
                                            </span>
                                          )}
                                          {emp.traits && (
                                            <span className="px-1.5 py-0.5 rounded bg-purple-500/20 text-purple-300 border border-purple-500/30 text-xs font-mono">
                                              {emp.traits}
                                            </span>
                                          )}
                                          {(emp.sim || emp.off) && (
                                            <span className="px-1.5 py-0.5 rounded bg-amber-500/20 text-amber-300 border border-amber-500/40 text-xs font-mono uppercase">
                                              {emp.off
                                                ? 'off'
                                                : emp.sim === 'added'
                                                ? 'sim'
                                                : emp.sim}
                                            </span>
                                          )}
                                        </div>
                                      </td>

                                      <td
                                        className="py-3 px-3 text-right font-bold text-white tabular-nums"
                                        title={emp.prodBreakdown || 'Employee Production stat'}
                                      >
                                        {isEditing ? (
                                          <input
                                            type="number"
                                            min={0}
                                            max={50}
                                            step={1}
                                            value={Number(emp.prod.toFixed(1))}
                                            onChange={(e) =>
                                              handleEditEmployeeField(
                                                compIdx,
                                                empIdx,
                                                'prod',
                                                 parseFloat(e.target.value) || 0
                                              )
                                            }
                                            className="w-20 px-2 py-1 bg-slate-950 border border-amber-500 rounded text-right text-white font-mono"
                                          />
                                        ) : (
                                          formatNum(emp.prod, 0)
                                        )}
                                      </td>

                                      <td
                                        className="py-3 px-3 text-right font-bold text-emerald-300 tabular-nums"
                                        title={
                                          emp.bonusDetail ||
                                          'Hover in-game for Management, Home region, Happiness, Specialization, and Tool bonuses'
                                        }
                                      >
                                        {isEditing ? (
                                          <input
                                            type="number"
                                            min={-100}
                                            max={300}
                                            step={0.5}
                                            value={Number(emp.bonus.toFixed(1))}
                                            onChange={(e) =>
                                              handleEditEmployeeField(
                                                compIdx,
                                                empIdx,
                                                'bonus',
                                                parseFloat(e.target.value) || 0
                                              )
                                            }
                                            className="w-24 px-2 py-1 bg-slate-950 border border-amber-500 rounded text-right text-emerald-300 font-mono"
                                          />
                                        ) : (
                                          <div className="inline-flex flex-col items-end">
                                            <span>{formatSigned(emp.bonus, 1)}%</span>
                                            {emp.bonusDetail && (
                                              <span className="text-[11px] text-slate-400 font-normal max-w-[230px] truncate">
                                                {emp.bonusDetail}
                                              </span>
                                            )}
                                          </div>
                                        )}
                                      </td>

                                      <td
                                        className="py-3 px-3 text-right font-bold text-white tabular-nums"
                                        title={
                                          emp.happy != null
                                            ? `Quit chance ${formatNum(emp.quit * 100, 0)}%${
                                                emp.happyDetail ? ` · ${emp.happyDetail}` : ''
                                              }`
                                            : ''
                                        }
                                      >
                                        {emp.happy != null ? formatNum(emp.happy, 0) : '—'}
                                      </td>

                                      <td className="py-3 px-3 text-right font-bold text-white tabular-nums">
                                        {formatNum(ptsDay, 1)}
                                      </td>

                                      <td className="py-3 px-3 text-right font-bold text-rose-300 tabular-nums">
                                        {formatSigned(-wageDay, 2)}
                                      </td>

                                      <td
                                        className={`py-3 px-3 text-right font-black tabular-nums ${
                                          netDay >= 0 ? 'text-emerald-400' : 'text-rose-400'
                                        }`}
                                      >
                                        {formatSigned(netDay, 2)}
                                      </td>

                                      <td className="py-3 px-3 text-right font-bold text-slate-200 tabular-nums">
                                        {bundle.ppValue ? formatSigned(inGameDay, 2) : '—'}
                                      </td>

                                      <td className="py-3 px-3 text-right">
                                        <select
                                          value=""
                                          onChange={(e) =>
                                            handleEmployeeActionMenu(
                                              compIdx,
                                              empIdx,
                                              e.target.value
                                            )
                                          }
                                          aria-label={`Simulate a change to ${emp.name}`}
                                          className="px-2.5 py-1.5 bg-slate-950 border border-slate-700 rounded-lg text-xs font-sans font-bold text-slate-200 focus:outline-none focus:border-amber-500 cursor-pointer"
                                        >
                                          <option value="">⋯</option>
                                          <option value={isEditing ? 'done' : 'edit'}>
                                            {isEditing
                                              ? 'Done editing'
                                              : 'Edit Production and bonus'}
                                          </option>
                                          <option value="toggle">
                                            {emp.off ? 'Activate' : 'Deactivate'}
                                          </option>
                                          {emp.sim === 'added' && (
                                            <option value="remove">Remove</option>
                                          )}
                                          {moveTargets.length > 0 && (
                                            <optgroup label="Move to">
                                              {moveTargets.map(({ targetComp, targetIdx }) => (
                                                <option
                                                  key={targetComp.company._id}
                                                  value={`move:${targetIdx}`}
                                                >
                                                  {targetComp.company.name}
                                                </option>
                                              ))}
                                            </optgroup>
                                          )}
                                        </select>
                                      </td>
                                    </tr>
                                  );
                                })}
                              </tbody>
                            </table>
                          </div>
                        ) : (
                          <p className="text-xs sm:text-sm text-slate-400">
                            {c.base.logNpc && !c.ov?.emps
                              ? 'No live employee roster returned (ensure your War Era API Key is active): employee figures above come from the daily work log.'
                              : 'This company has no employees right now. Use "What if…" below to simulate hiring.'}
                          </p>
                        )}
                      </div>

                      {/* Collapsible "WHAT IF..." Simulator Drawer */}
                      <div className="rounded-xl border border-slate-800 bg-slate-900/70 overflow-hidden">
                        <button
                          type="button"
                          onClick={() => {
                            const next = new Set(openSimCompanyIds);
                            if (next.has(compId)) next.delete(compId);
                            else next.add(compId);
                            setOpenSimCompanyIds(next);
                          }}
                          className="w-full p-4 flex items-center justify-between gap-3 text-left hover:bg-slate-800/50 transition cursor-pointer"
                        >
                          <div className="flex items-center gap-2.5 flex-wrap">
                            <SlidersHorizontal className="w-4 h-4 text-amber-400" />
                            <span className="text-xs sm:text-sm font-black uppercase tracking-wider text-white">
                              What if…
                            </span>
                            <span className="text-xs sm:text-sm text-slate-400">
                              simulate an employee, a manager or another product
                            </span>
                          </div>
                          {isSimOpen ? (
                            <ChevronUp className="w-4 h-4 text-slate-400" />
                          ) : (
                            <ChevronDown className="w-4 h-4 text-slate-400" />
                          )}
                        </button>

                        {isSimOpen && (
                          <div className="p-4 pt-2 border-t border-slate-800 space-y-4">
                            <p className="text-xs text-slate-300 leading-relaxed">
                              Official v0.27 rules: an employee makes Production ÷ 4 points per hour, +{MGMT_PCT}% per Management point of the owner ({bundle.ownerMgmtPoints} here) and of the manager (up to +{MANAGER_CAP_PCT}%, +{MGMT_CAP_PCT}% together)
                              {c.home ? `, plus +${HOME_PCT}% for being in the owner's country` : ''}. Its wage is that base output × the value of a point ({formatNum(bundle.ppValue, 4)}) × its own expectation. Valued at market price
                              {c.item?.raw ? ' minus raw materials' : ''}. Happiness, tools, traits and specialization are left out.
                            </p>

                            <div className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-4 gap-4">
                              {/* Box 1: Hire an employee */}
                              <div className="p-3.5 rounded-xl bg-slate-950 border border-slate-800 space-y-3 flex flex-col justify-between">
                                <div className="space-y-3">
                                  <div className="text-xs font-black uppercase tracking-wider text-amber-300">
                                    Hire an employee
                                  </div>
                                  <label className="block space-y-1 text-xs">
                                    <div className="flex justify-between text-slate-300">
                                      <span>Production</span>
                                      <span className="font-mono font-bold text-white">
                                        {formState.hireProd}
                                      </span>
                                    </div>
                                    <input
                                      type="range"
                                      min={1}
                                      max={10}
                                      step={1}
                                      value={formState.hireProd}
                                      onChange={(e) =>
                                        setSimForms({
                                          ...simForms,
                                          [compId]: {
                                            ...formState,
                                            hireProd: Number(e.target.value),
                                          },
                                        })
                                      }
                                      className="w-full accent-amber-500"
                                    />
                                  </label>

                                  <label className="block space-y-1 text-xs">
                                    <div className="flex justify-between text-slate-300">
                                      <span>Wage expectation</span>
                                      <span className="font-mono font-bold text-white">
                                        {formState.hireExp}%
                                      </span>
                                    </div>
                                    <input
                                      type="range"
                                      min={70}
                                      max={130}
                                      step={1}
                                      value={formState.hireExp}
                                      onChange={(e) =>
                                        setSimForms({
                                          ...simForms,
                                          [compId]: {
                                            ...formState,
                                            hireExp: Number(e.target.value),
                                          },
                                        })
                                      }
                                      className="w-full accent-amber-500"
                                    />
                                  </label>

                                  <div className="p-2.5 rounded-lg bg-slate-900 border border-slate-800 text-xs font-mono space-y-1">
                                    <div className="text-slate-300">
                                      {formatNum(simHirePtsDay, 1)} pts/day → worth{' '}
                                      {formatNum(simHireWorthDay, 2)} · wage{' '}
                                      {formatNum(simHireWageDay, 2)}
                                    </div>
                                    <div
                                      className={`font-black text-sm ${
                                        simHireNetDay >= 0 ? 'text-emerald-400' : 'text-rose-400'
                                      }`}
                                    >
                                      {formatSigned(simHireNetDay, 2)} per day
                                    </div>
                                    <div className="text-[11px] font-sans text-slate-400">
                                      Point value: {formatNum(bundle.ppValue, 4)}; this product is worth{' '}
                                      {formatNum(ptValue, 4)} a point.
                                    </div>
                                  </div>
                                </div>

                                {workingEmps.length < c.cap ? (
                                  <button
                                    type="button"
                                    onClick={() => handleHireSimEmployee(compIdx)}
                                    className="w-full py-2 rounded-lg bg-amber-500 hover:bg-amber-400 text-slate-950 font-black text-xs transition cursor-pointer"
                                  >
                                    Apply to this company
                                  </button>
                                ) : (
                                  <div className="text-xs text-amber-300/90 font-medium">
                                    The break room is full: deactivate or move an employee first.
                                  </div>
                                )}
                              </div>

                              {/* Box 2: Your manager / Hire a manager */}
                              <div className="p-3.5 rounded-xl bg-slate-950 border border-slate-800 space-y-3 flex flex-col justify-between">
                                <div className="space-y-3">
                                  <div className="text-xs font-black uppercase tracking-wider text-amber-300">
                                    {c.manager ? 'Your manager' : 'Hire a manager'}
                                  </div>
                                  <label className="block space-y-1 text-xs">
                                    <div className="flex justify-between text-slate-300">
                                      <span>Management</span>
                                      <span className="font-mono font-bold text-white">
                                        {formState.mgrLvl} (+{simMgrPct}%)
                                      </span>
                                    </div>
                                    <input
                                      type="range"
                                      min={0}
                                      max={MAX_MGMT}
                                      step={1}
                                      value={formState.mgrLvl}
                                      onChange={(e) =>
                                        setSimForms({
                                          ...simForms,
                                          [compId]: {
                                            ...formState,
                                            mgrLvl: Number(e.target.value),
                                          },
                                        })
                                      }
                                      className="w-full accent-amber-500"
                                    />
                                  </label>

                                  <label className="block space-y-1 text-xs">
                                    <div className="flex justify-between text-slate-300">
                                      <span>Pay per point</span>
                                      <span className="font-mono font-bold text-white">
                                        {formState.mgrRate.toFixed(3)}/h
                                      </span>
                                    </div>
                                    <input
                                      type="range"
                                      min={0}
                                      max={0.3}
                                      step={0.001}
                                      value={formState.mgrRate}
                                      onChange={(e) =>
                                        setSimForms({
                                          ...simForms,
                                          [compId]: {
                                            ...formState,
                                            mgrRate: parseFloat(e.target.value) || 0,
                                          },
                                        })
                                      }
                                      className="w-full accent-amber-500"
                                    />
                                  </label>

                                  <div className="p-2.5 rounded-lg bg-slate-900 border border-slate-800 text-xs font-mono space-y-1">
                                    {c.npcPoints <= 0 ? (
                                      <div className="font-sans text-slate-400">
                                        A manager only boosts employees, and this company has no employee output yet.
                                      </div>
                                    ) : (
                                      <>
                                        <div className="text-slate-300">
                                          +{simMgrPct}% → +{formatNum(simMgrExtraPts, 2)} pts/day, worth{' '}
                                          {formatNum(simMgrGainWorth, 3)} · pay{' '}
                                          {formatNum(simMgrWageDay, 2)}
                                        </div>
                                        <div
                                          className={`font-black text-sm ${
                                            simMgrNet >= 0 ? 'text-emerald-400' : 'text-rose-400'
                                          }`}
                                        >
                                          {formatSigned(simMgrNet, 3)} per day
                                        </div>
                                        <div className="text-[11px] font-sans text-slate-400">
                                          {bundle.ownerMgmtPoints * MGMT_PCT + simMgrPct >
                                          MGMT_CAP_PCT
                                            ? `Capped: owner and manager together give at most +${MGMT_CAP_PCT}%.`
                                            : "Before the country's manager tax."}
                                        </div>
                                      </>
                                    )}
                                  </div>
                                </div>
                              </div>

                              {/* Box 3: Make another product */}
                              <div className="p-3.5 rounded-xl bg-slate-950 border border-slate-800 space-y-3 flex flex-col justify-between">
                                <div className="space-y-3">
                                  <div className="text-xs font-black uppercase tracking-wider text-amber-300">
                                    Make another product
                                  </div>
                                  <label className="block space-y-1 text-xs">
                                    <span className="text-slate-300 block">Product</span>
                                    <select
                                      value={formState.altItem}
                                      onChange={(e) =>
                                        setSimForms({
                                          ...simForms,
                                          [compId]: {
                                            ...formState,
                                            altItem: e.target.value,
                                          },
                                        })
                                      }
                                      className="w-full h-9 px-2.5 bg-slate-900 border border-slate-700 rounded-lg text-xs font-bold text-white focus:outline-none focus:border-amber-500"
                                    >
                                      {CANONICAL_COMPANY_ITEMS.filter(
                                        (it) => it.id !== c.company.itemCode
                                      )
                                        .sort(
                                          (a, b) =>
                                            (calculatePointValue(b.id, bundle.prices) || 0) -
                                            (calculatePointValue(a.id, bundle.prices) || 0)
                                        )
                                        .map((it) => (
                                          <option key={it.id} value={it.id}>
                                            {it.name} (
                                            {formatNum(
                                              (calculatePointValue(it.id, bundle.prices) || 0) *
                                                100,
                                              2
                                            )}{' '}
                                            / 100 pts)
                                          </option>
                                        ))}
                                    </select>
                                  </label>

                                  <div className="p-2.5 rounded-lg bg-slate-900 border border-slate-800 text-xs font-mono space-y-1">
                                    {c.points <= 0 ? (
                                      <div className="font-sans text-slate-400">
                                        This company has no output to compare yet.
                                      </div>
                                    ) : (
                                      <>
                                        <div className="text-slate-300">
                                          Same {formatNum(c.points, 1)} pts/day as{' '}
                                          {altItemObj?.name} → worth{' '}
                                          {formatNum(altDailyValue, 2)} (now{' '}
                                          {formatNum(currentDailyValue, 2)})
                                        </div>
                                        <div
                                          className={`font-black text-sm ${
                                            altDiffValue >= 0
                                              ? 'text-emerald-400'
                                              : 'text-rose-400'
                                          }`}
                                        >
                                          {formatSigned(altDiffValue, 2)} per day
                                        </div>
                                        <div className="text-[11px] font-sans text-slate-400">
                                          Ignores the switching cost and the specialization employees lose on a new good.
                                        </div>
                                      </>
                                    )}
                                  </div>
                                </div>

                                <button
                                  type="button"
                                  onClick={() =>
                                    handleApplyAlternativeProduct(compIdx, formState.altItem)
                                  }
                                  className="w-full py-2 rounded-lg bg-indigo-600 hover:bg-indigo-500 text-white font-bold text-xs transition cursor-pointer"
                                >
                                  Apply to this company
                                </button>
                              </div>

                              {/* Box 4: Engine Level */}
                              <div className="p-3.5 rounded-xl bg-slate-950 border border-slate-800 space-y-3 flex flex-col justify-between">
                                <div className="space-y-3">
                                  <div className="text-xs font-black uppercase tracking-wider text-amber-300">
                                    Engine
                                  </div>
                                  <label className="block space-y-1 text-xs">
                                    <span className="text-slate-300 block">Level</span>
                                    <select
                                      value={c.engineLvl}
                                      onChange={(e) =>
                                        handleEngineSimChange(compIdx, Number(e.target.value))
                                      }
                                      className="w-full h-9 px-2.5 bg-slate-900 border border-slate-700 rounded-lg text-xs font-bold text-white focus:outline-none focus:border-amber-500"
                                    >
                                      {[0, 1, 2, 3, 4, 5, 6, 7].map((lv) => (
                                        <option key={lv} value={lv}>
                                          {lv ? `Level ${lv} · ${lv * 24} pts/day` : 'Off (0 pts/day)'}
                                        </option>
                                      ))}
                                    </select>
                                  </label>

                                  <div className="p-2.5 rounded-lg bg-slate-900 border border-slate-800 text-xs text-slate-300 leading-relaxed">
                                    Applies to the whole portfolio at once: daily output, goods value, and raw material supply transfers.
                                  </div>
                                </div>

                                {c.ov?.engine != null && (
                                  <button
                                    type="button"
                                    onClick={() =>
                                      handleEngineSimChange(compIdx, c.base.engineLvl)
                                    }
                                    className="w-full py-2 rounded-lg bg-slate-800 hover:bg-slate-700 text-amber-300 font-bold text-xs transition cursor-pointer"
                                  >
                                    Back to level {c.base.engineLvl}
                                  </button>
                                )}
                              </div>
                            </div>
                          </div>
                        )}
                      </div>
                    </div>
                  )}
                </div>
              );
            })}
          </div>
        </div>
      )}

      {/* 8-Page "How Work Runs Now (v0.27)" Interactive Reference Guide Modal */}
      {isGuideOpen && (
        <div
          className="fixed inset-0 z-50 bg-slate-950/80 backdrop-blur-xs flex items-center justify-center p-4"
          onClick={() => setIsGuideOpen(false)}
        >
          <div
            className="bg-slate-900 border border-amber-500/40 rounded-2xl max-w-3xl w-full p-6 space-y-5 shadow-2xl"
            onClick={(e) => e.stopPropagation()}
          >
            <div className="flex items-center justify-between border-b border-slate-800 pb-4">
              <div>
                <h2 className="text-lg sm:text-xl font-black text-white uppercase tracking-wider">
                  {tx(
                    '📜 How Work Runs Now (War Era v0.27)',
                    '📜 Cómo Funciona el Trabajo Ahora (War Era v0.27)'
                  )}
                </h2>
                <p className="text-xs sm:text-sm font-mono text-amber-300 mt-0.5">
                  {tx('Page', 'Página')} {guideStep + 1} {tx('of', 'de')}{' '}
                  {activeGuidePages.length} — {activeGuidePages[guideStep].title}
                </p>
              </div>
              <button
                type="button"
                onClick={() => setIsGuideOpen(false)}
                className="p-2 rounded-xl bg-slate-800 hover:bg-slate-700 text-slate-300 hover:text-white transition cursor-pointer"
              >
                <X className="w-5 h-5" />
              </button>
            </div>

            <div className="space-y-4 min-h-[260px]">
              <h3 className="text-base sm:text-lg font-extrabold text-amber-300">
                {activeGuidePages[guideStep].title}
              </h3>
              {activeGuidePages[guideStep].intro && (
                <p className="text-sm text-slate-200 leading-relaxed">
                  {activeGuidePages[guideStep].intro}
                </p>
              )}
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-3.5">
                {activeGuidePages[guideStep].cards.map((card, idx) => (
                  <div
                    key={idx}
                    className="p-4 rounded-xl bg-slate-950 border border-slate-800 space-y-1.5"
                  >
                    <h4 className="text-sm font-black text-white">{card.heading}</h4>
                    <p className="text-xs sm:text-sm text-slate-300 leading-relaxed">
                      {card.body}
                    </p>
                  </div>
                ))}
              </div>
            </div>

            <div className="flex items-center justify-between border-t border-slate-800 pt-4">
              <button
                type="button"
                disabled={guideStep === 0}
                onClick={() => setGuideStep((s) => Math.max(0, s - 1))}
                className="px-4 py-2 rounded-xl bg-slate-800 hover:bg-slate-700 text-white text-xs sm:text-sm font-bold flex items-center gap-1.5 disabled:opacity-40 transition cursor-pointer"
              >
                <ArrowLeft className="w-4 h-4" />
                <span>{tx('Back', 'Anterior')}</span>
              </button>

              <div className="flex items-center gap-1.5">
                {activeGuidePages.map((p, idx) => (
                  <button
                    key={p.title}
                    type="button"
                    onClick={() => setGuideStep(idx)}
                    title={p.title}
                    className={`w-2.5 h-2.5 rounded-full transition cursor-pointer ${
                      idx === guideStep
                        ? 'bg-amber-400 scale-125'
                        : 'bg-slate-700 hover:bg-slate-500'
                    }`}
                  />
                ))}
              </div>

              <button
                type="button"
                disabled={guideStep === activeGuidePages.length - 1}
                onClick={() =>
                  setGuideStep((s) => Math.min(activeGuidePages.length - 1, s + 1))
                }
                className="px-4 py-2 rounded-xl bg-amber-500 hover:bg-amber-400 text-slate-950 text-xs sm:text-sm font-black flex items-center gap-1.5 disabled:opacity-40 transition cursor-pointer"
              >
                <span>{tx('Next', 'Siguiente')}</span>
                <ArrowRight className="w-4 h-4" />
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};
