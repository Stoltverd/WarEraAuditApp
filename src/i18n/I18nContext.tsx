import React, { createContext, useContext, useState, useEffect, useCallback, useRef } from 'react';

export type AppLanguage = 'en' | 'es';

const LANG_STORAGE_KEY = 'warera_app_lang_v1';

interface I18nContextValue {
  lang: AppLanguage;
  setLang: (lang: AppLanguage) => void;
  tx: (en: string, es: string) => string;
  translateSkill: (skillName: string) => string;
  translateCommodity: (itemName: string) => string;
}

const I18nContext = createContext<I18nContextValue>({
  lang: 'en',
  setLang: () => {},
  tx: (en) => en,
  translateSkill: (s) => s,
  translateCommodity: (c) => c,
});

/**
 * Canonical War Era Skill Translations (ES)
 * NOTE: Per War Era terminology rules:
 * - "Leadership" is NEVER translated (stays "Leadership")
 * - "Eco", "War", "Hybrid" stay "Eco", "War", "Hybrid"
 * - "Break Room" stays "Break Room"
 */
export const WARERA_SKILL_ES_MAP: Record<string, string> = {
  Leadership: 'Leadership',
  leadership: 'Leadership',
  Management: 'Gestión',
  management: 'Gestión',
  Production: 'Producción',
  production: 'Producción',
  Companies: 'Empresas',
  companies: 'Empresas',
  Energy: 'Energía',
  energy: 'Energía',
  'Work Energy': 'Energía de Trabajo',
  Luck: 'Suerte',
  luck: 'Suerte',
  Responsibility: 'Responsabilidad',
  responsibility: 'Responsabilidad',
  Health: 'Salud',
  health: 'Salud',
  Attack: 'Ataque',
  attack: 'Ataque',
  Strength: 'Fuerza',
  strength: 'Fuerza',
  Defense: 'Defensa',
  defense: 'Defensa',
  Armor: 'Armadura',
  armor: 'Armadura',
  Critical: 'Crítico',
  critical: 'Crítico',
  'Critical Chance': 'Prob. Crítica',
  'Critical Damage': 'Daño Crítico',
  Dodge: 'Evasión',
  dodge: 'Evasión',
  Evasion: 'Evasión',
  Precision: 'Precisión',
  precision: 'Precisión',
  Accuracy: 'Precisión',
  Looting: 'Botín',
  looting: 'Botín',
  Entrepreneurship: 'Emprendimiento',
  entrepreneurship: 'Emprendimiento',
};

/**
 * Canonical War Era Commodity & Product Translations (ES)
 */
export const WARERA_COMMODITY_ES_MAP: Record<string, string> = {
  'Cooked Fish': 'Pescado Cocido',
  cookedFish: 'Pescado Cocido',
  Paper: 'Papel',
  paper: 'Papel',
  Oil: 'Petróleo',
  oil: 'Petróleo',
  'Light Ammo': 'Munición Ligera',
  lightAmmo: 'Munición Ligera',
  'Heavy Ammo': 'Munición Pesada',
  heavyAmmo: 'Munición Pesada',
  Ammo: 'Munición',
  ammo: 'Munición',
  Cocaine: 'Cocaína',
  cocaine: 'Cocaína',
  Lead: 'Plomo',
  lead: 'Plomo',
  Steel: 'Acero',
  steel: 'Acero',
  Concrete: 'Concreto',
  concrete: 'Concreto',
  Bread: 'Pan',
  bread: 'Pan',
  Steak: 'Filete',
  steak: 'Filete',
  Fish: 'Pescado',
  fish: 'Pescado',
  Grain: 'Grano',
  grain: 'Grano',
  Wheat: 'Trigo',
  wheat: 'Trigo',
  Iron: 'Hierro',
  iron: 'Hierro',
  Limestone: 'Piedra Caliza',
  limestone: 'Piedra Caliza',
  Coal: 'Carbón',
  coal: 'Carbón',
  Petroleum: 'Combustible',
  petroleum: 'Combustible',
  Coca: 'Hoja de Coca',
  coca: 'Hoja de Coca',
  Livestock: 'Ganado',
  livestock: 'Ganado',
  Cattle: 'Ganado',
  cattle: 'Ganado',
  Wood: 'Madera',
  wood: 'Madera',
  Case: 'Caja',
  case: 'Caja',
  Weapons: 'Armas',
  weapons: 'Armas',
  Tanks: 'Tanques',
  tanks: 'Tanques',
};

/**
 * Exact Whole-String Dictionary for Instant Reversible DOM Localization (EN -> ES)
 * Preserves "Leadership", "Eco", "War", "Hybrid", "Break Room" in English.
 */
const EXACT_PHRASE_ES: Record<string, string> = {
  // Header & Navigation
  'BTC Donations': 'Donaciones BTC',
  'Daily, Weekly & Monthly Citizen Audit': 'Auditoría Ciudadana Diaria, Semanal y Mensual',
  'Choose Country to Audit...': 'Elegir País a Auditar...',
  'Search 180 countries...': 'Buscar 180 países...',
  'Select for audit': 'Seleccionar para auditar',
  'Leaderboard': 'Clasificación',
  '🏛️ Ministry': '🏛️ Ministerio',
  'Ministry': 'Ministerio',
  'API Key Active': 'API Key Activa',
  'Connect API Token': 'Conectar Token API',
  'Inspector': 'Inspector',
  'Syncing...': 'Sincronizando...',
  'Sync Donors': 'Sincronizar',

  // Timeframes & Leaderboard Controls (Screenshot 1)
  'Daily (24h)': 'Diario (24h)',
  'Weekly (7d)': 'Semanal (7d)',
  'Monthly (30d)': 'Mensual (30d)',
  'All-Time': 'Histórico Total',
  'Custom Range': 'Rango Personalizado',
  'Export Leaderboard': 'Exportar Clasificación',
  'Start Date:': 'Fecha Inicio:',
  'End Date:': 'Fecha Fin:',
  'Presets:': 'Ajustes:',
  'Last 14d': 'Últimos 14d',
  'Last 30d': 'Últimos 30d',
  'Last 60d': 'Últimos 60d',
  'This Month': 'Este Mes',
  'Include Damage Donations (War Mode)': 'Incluir Donaciones por Daño (Modo War)',
  'Include Combat Damage as Donations (War Mode)': 'Incluir Daño de Combate como Donación (Modo War)',
  'Optionally add citizen combat damage in this timeframe to rankings as money.':
    'Opcionalmente suma el daño de combate ciudadano en este período a la clasificación como dinero.',
  'Ratio:': 'Tasa:',
  'BTC per 1,000 DMG': 'BTC por 1,000 DMG',
  'Changes pending': 'Cambios pendientes',
  'Calculate new rankings': 'Calcular nueva clasificación',
  'Calculating & Hydrating Combat Stats...': 'Calculando e Hidratando Estadísticas de Combate...',
  'Top 3 Sovereign Patrons': 'Top 3 Patrones Soberanos',
  'Champion Patron': 'Patrón Campeón',
  'Silver Patron': 'Patrón de Plata',
  'Bronze Patron': 'Patrón de Bronce',
  'All-Time Treasury': 'Tesorería Histórica',
  'Period Donated': 'Donado en el Período',
  'Active Donors': 'Donantes Activos',
  'Average / Median': 'Promedio / Mediana',
  'Search donor username or citizen ID...': 'Buscar nombre de donante o ID de ciudadano...',
  'Search citizen username or ID...': 'Buscar usuario o ID de ciudadano...',
  'Rank': 'Rango',
  'Citizen': 'Ciudadano',
  'Direct BTC': 'BTC Directo',
  'Combat Damage': 'Daño de Combate',
  'Total Value': 'Valor Total',
  'Receipts': 'Recibos',
  'Last Donation': 'Última Donación',
  'Actions': 'Acciones',
  'Inspect': 'Inspeccionar',
  'Audit': 'Auditar',

  // RankingStats KPI Cards & Podium & LeaderboardTable (Screenshot 1)
  'Total BTC Donated': 'Total BTC Donado',
  'TOTAL BTC DONATED': 'TOTAL BTC DONADO',
  'Contributing Citizens': 'Ciudadanos Contribuyentes',
  'CONTRIBUTING CITIZENS': 'CIUDADANOS CONTRIBUYENTES',
  'Median Contribution': 'Contribución Mediana',
  'MEDIAN CONTRIBUTION': 'CONTRIBUCIÓN MEDIANA',
  'Top Benefactor': 'Principal Benefactor',
  'TOP BENEFACTOR': 'PRINCIPAL BENEFACTOR',
  'Past 24 Hours': 'Últimas 24 Horas',
  'Past 7 Days': 'Últimos 7 Días',
  'Past 30 Days': 'Últimos 30 Días',
  'All-Time Record': 'Registro Histórico Total',
  'patrons': 'patrones',
  'out of': 'de',
  'active citizens': 'ciudadanos activos',
  'Ranked in this period': 'Clasificados en este período',
  'Active pool: level 10+ and active status': 'Población activa: nivel 10+ y estado activo',
  'No recorded contributions': 'Sin contribuciones registradas',
  '• Skewed by large contributions': '• Sesgado por grandes aportes',
  '• Uniform contributions': '• Contribuciones uniformes',
  'View citizen details': 'Ver detalles del ciudadano',
  'No donations recorded in this period': 'Sin donaciones registradas en este período',
  'Top Contributing Citizens': 'Principales Ciudadanos Contribuyentes',
  'in the last 24 hours': 'en las últimas 24 horas',
  'in the last 7 days': 'en los últimos 7 días',
  'in the last 30 days': 'en los últimos 30 días',
  'of all time': 'de todos los tiempos',
  'National podium for highest BTC contributions': 'Podio nacional de mayores contribuciones en BTC',
  'Empty': 'Vacío',
  'FIRST': 'PRIMERO',
  'SECOND': 'SEGUNDO',
  'THIRD': 'TERCERO',
  'Citizen Donation Leaderboard': 'Clasificación de Donaciones Ciudadanas',
  'Period Share': 'Cuota del Período',
  'PERIOD SHARE': 'CUOTA DEL PERÍODO',
  'Donations': 'Donaciones',
  'DONATIONS': 'DONACIONES',
  'of period funds': 'de los fondos del período',
  'Official lifetime treasury record on register': 'Registro oficial histórico en tesorería',
  'Lifetime': 'Histórico',
  'War Only': 'Solo War',
  'War Mode Active': 'Modo War Activo',
  'View audit details': 'Ver detalles de auditoría',
  'No donation records found for this period.': 'No se encontraron registros de donación para este período.',
  'Showing': 'Mostrando',
  'of': 'de',
  'Per page:': 'Por página:',
  'First Page': 'Primera Página',
  'Previous Page': 'Página Anterior',
  'Next Page': 'Página Siguiente',
  'Last Page': 'Última Página',
  'Go to:': 'Ir a:',
  'Go': 'Ir',

  // Top Granular Transaction Stream Banner (Screenshot 2)
  'Granular Transaction Stream Active:': 'Flujo Granular de Transacciones Activo:',
  'Displaying exact individual donation receipts and precise Daily, Weekly, and Monthly rollups.':
    'Mostrando recibos individuales exactos de donación y acumulados precisos Diarios, Semanales y Mensuales.',

  // Ministry Workspace Header, Daily Protocol & Tabs (Screenshot 2)
  'EXECUTIVE SOVEREIGN COMMAND': 'COMANDO EJECUTIVO SOBERANO',
  '100% Census & Receipts Audited': '100% Censo y Recibos Auditados',
  'National Treasury & Economic Strategy Office': 'Oficina del Tesoro Nacional y Estrategia Económica',
  'Citizen contribution ratios, leech detection, inter-state sovereign transfers, and strategic commodity arbitrage.':
    'Tasas de contribución ciudadana, detección de parásitos (leeches), transferencias interestatales y arbitraje estratégico.',
  'Daily Protocol Recommendation:': 'Recomendación de Protocolo Diario:',
  'Use the': 'Usa el botón',
  'button above to download a daily backup file, safeguarding your historical citizen wealth snapshots, watchlist, and custom policy configurations against browser cache clearing or disk cleaner utilities.':
    'arriba para descargar un archivo de respaldo diario, protegiendo tus capturas históricas de riqueza ciudadana, lista de vigilancia y políticas personalizadas contra limpiezas de caché del navegador o utilidades de disco.',
  'HISTORICAL AUDIT': 'AUDITORÍA HISTÓRICA',
  'Take Citizen Snapshot': 'Tomar Captura Ciudadana',
  'CONSOLIDATED REPORT': 'REPORTE CONSOLIDADO',
  'Export Digest (CSV)': 'Exportar Resumen (CSV)',
  'DISASTER RECOVERY': 'RECUPERACIÓN DE DATOS',
  'Backup & Safeguards': 'Respaldo y Seguridad',
  'Citizen Leech & Wealth Radar': 'Radar de Riqueza y Contribución',
  'War-Readiness Evaluation': 'Evaluación de Preparación Bélica',
  'Workforce & Trait Advisor (v0.27)': 'Asesor de Fuerza Laboral y Empresas (v0.27)',
  'Inter-State Transfers': 'Transferencias Interestatales',
  'National Strategic Reserves': 'Reservas Estratégicas Nacionales',
  'Market Arbitrage Advisor': 'Asesor de Arbitraje de Mercado',
  'Citizens on watch': 'Ciudadanos en Vigilancia',

  // Citizen Radar KPIs, Filters & Banners (Screenshot 2)
  'ECONOMY MINISTRY': 'MINISTERIO DE ECONOMÍA',
  'Economy Ministry': 'Ministerio de Economía',
  'AUDIT CYCLE:': 'CICLO DE AUDITORÍA:',
  'Audit Cycle:': 'Ciclo de Auditoría:',
  '7 Days': '7 Días',
  '30 Days': '30 Días',
  'Policy Calibration & Quotas': 'Calibración de Políticas y Cuotas',
  'Calibrate Sovereign Contribution Thresholds & Leech Ratios': 'Calibrar Umbrales de Contribución Soberana y Tasas de Leech',
  'Monitored Net Worth': 'Patrimonio Neto Monitoreado',
  'Auditing National Assets...': 'Auditando Activos Nacionales...',
  'Critical Leeches Flagged': 'Críticos / Leeches Detectados',
  'Calculating Leech Quotas...': 'Calculando Cuotas de Leech...',
  'Inactive Donors (>7d)': 'Donantes Inactivos (>7d)',
  'Scanning Inactive Donors...': 'Escaneando Donantes Inactivos...',
  'Active citizens with no treasury contribution in 7+ days':
    'Ciudadanos activos sin aportes al tesoro en más de 7 días',
  'Eco vs War Stance': 'Postura Eco vs War',
  'Analyzing Stance Distribution...': 'Analizando Distribución de Posturas...',
  'Compiling Eco / War / Hybrid build distribution': 'Compilando distribución de builds Eco / War / Hybrid',
  'Pure Eco / Pure War / Hybrid citizens': 'Ciudadanos Pure Eco / Pure War / Hybrid',
  'Search citizen or ID...': 'Buscar ciudadano o ID...',
  'Filter citizens who have not donated in over 7 days': 'Filtrar ciudadanos que no han donado en más de 7 días',
  'Filter by sovereign fiscal standing': 'Filtrar por estado fiscal soberano',
  'Filter by build and commitment': 'Filtrar por build y compromiso',
  'Filter by War Era v0.27 BuhDeuce Build Evaluation Grade': 'Filtrar por Grado de Evaluación de Build BuhDeuce v0.27',
  'All Citizen Builds': 'Todas las Builds',
  '🌾 Eco Players (Dynamic & Perma)': '🌾 Jugadores Eco (Dinámico y Perma)',
  '⚔️ War Players (Dynamic & Perma)': '⚔️ Jugadores War (Dinámico y Perma)',
  '⚖️ Hybrid Builds': '⚖️ Builds Hybrid',
  '🔒 Pinned Builds Only': '🔒 Solo Builds Fijadas',
  'All v0.27 Build Grades': 'Todos los Grados de Build v0.27',
  '🌟 Lvl 26+ Eco Meta (Lead + Mgmt)': '🌟 Meta Eco Nvl 26+ (Leadership + Gestión)',
  '⚡ Lvl 1–25 Self-Work (Prod + Energy)': '⚡ Autotrabajo Nvl 1–25 (Prod + Energía)',
  '🛠️ Lvl 26+ Viable Self-Work (Prod + Energy)': '🛠️ Autotrabajo Viable Nvl 26+ (Prod + Energía)',
  '⚔️ War-Ready / War in Eco': '⚔️ Listo para Guerra / War en Eco',
  '⚠️ SP Optimization Needed': '⚠️ Requiere Optimización de SP',
  'Continuous Fiscal Audit Active — Day-1 Provisional Baseline': 'Auditoría Fiscal Continua Activa — Línea Base Provisional Día 1',
  'Daily wealth snapshots are recorded to establish verified historical deltas. Click "Audit" on any citizen to inspect their full multi-channel cashflow ledger and company upgrade breakdown.':
    'Las capturas diarias de riqueza se registran para establecer deltas históricos verificados. Haz clic en "Auditar" en cualquier ciudadano para inspeccionar su flujo de caja multicanal y mejoras de empresas.',
  '4-Thread Delta Receipt Verification:': 'Verificación Delta de Recibos (4 Hilos):',
  '4-Worker Delta Receipt Verification:': 'Verificación Delta de Recibos (4 Hilos):',
  'Resume': 'Reanudar',
  'Pause': 'Pausar',
  'Stop': 'Detener',
  'Resume Stream': 'Reanudar Flujo',
  'Re-Audit All': 'Re-Auditar Todos',
  'Re-Filter View': 'Re-Filtrar Vista',
  'Configure War Era API Key in header to stream live personal receipts':
    'Configura tu API Key de War Era en el encabezado para transmitir recibos personales en vivo',
  'CITIZEN': 'CIUDADANO',
  'NET WORTH': 'PATRIMONIO NETO',
  'Net Worth': 'Patrimonio Neto',
  'INFLOW & NET (7D)': 'INGRESO Y NETO (7D)',
  'INFLOW & NET (30D)': 'INGRESO Y NETO (30D)',
  'DONATED (7D)': 'DONADO (7D)',
  'DONATED (30D)': 'DONADO (30D)',
  'FISCAL STANDING': 'ESTADO FISCAL',
  'Fiscal Standing': 'Estado Fiscal',
  'BUILD & COMMITMENT': 'BUILD Y COMPROMISO',
  'Build & Commitment': 'Build y Compromiso',
  'ACTIONS': 'ACCIONES',
  'Baseline: Today': 'Base: Hoy',
  'In': 'Ent',
  'Pending Audit': 'Auditoría Pendiente',
  'Click to stream': 'Clic para transmitir',
  '0 donations': '0 donaciones',
  '⏳ Pending': '⏳ Pendiente',
  '🏛️ Pillar': '🏛️ Pilar',
  '⚔️ Frontline Hero': '⚔️ Héroe del Frente',
  '🚨 Critical Leech': '🚨 Parásito Crítico (Leech)',
  '⚠️ Low Donor': '⚠️ Bajo Donante',
  '🟢 Model Patriot': '🟢 Patriota Modelo',
  '🔵 Moderate': '🔵 Moderado',
  'Unverified': 'Sin verificar',
  '🛡️ Perma-War': '🛡️ Perma-War',
  '🌾 Perma-Eco': '🌾 Perma-Eco',
  '⚔️ Mercenary': '⚔️ Mercenario',
  '⭐ VIP': '⭐ VIP',
  '🔄 Mixed': '🔄 Mixto',
  '🌾 Eco': '🌾 Eco',
  '⚔️ War': '⚔️ War',
  '⚖️ Hybrid': '⚖️ Hybrid',
  'Pin: Perma-War': 'Fijar: Perma-War',
  'Pin: Perma-Eco': 'Fijar: Perma-Eco',
  'Pin: Mercenary': 'Fijar: Mercenario',
  'Pin: VIP': 'Fijar: VIP',
  'Nudge': 'Notificar',
  'Audited': 'Auditado',
  'Pending': 'Pendiente',
  'Dynamic (Auto)': 'Dinámico (Auto)',
  'Perma-Eco': 'Perma-Eco',
  'Perma-War': 'Perma-War',
  'Model Patriot': 'Patriota Modelo',
  'Historical Pillar': 'Pilar Histórico',
  'Frontline Hero': 'Héroe del Frente',
  'Standard Contributor': 'Contribuyente Estándar',
  'Low Contributor': 'Bajo Contribuyente',
  'Critical Leech': 'Parásito Crítico (Leech)',
  'Exempt / Low Level': 'Exento / Nivel Bajo',
  'Optimal v0.27 Meta': 'Meta v0.27 Óptimo',
  '🌟 Optimal v0.27 Eco Meta': '🌟 Meta Eco v0.27 Óptimo',
  '🌱 Optimal Lvl 1–25 Self-Work': '🌱 Autotrabajo Óptimo Nvl 1–25',
  'Optimal Lvl 1–25': 'Óptimo Nvl 1–25',
  '⚠️ Early Lvl No Self-Work': '⚠️ Nvl Inicial Sin Autotrabajo',
  'Low Self-Work SP': 'Bajo SP Autotrabajo',
  '⚔️ War Ready (Early Lvl)': '⚔️ Listo para War (Nvl Inicial)',
  'War Ready': 'Listo para War',
  '⚔️ Optimal War Spec': '⚔️ Spec War Óptima',
  '🛡️ War / Eco Transition': '🛡️ Transición War / Eco',
  'War-in-Eco': 'War-en-Eco',
  '⚡ Optimal War-in-Eco': '⚡ War-en-Eco Óptimo',
  'War-in-Eco Meta': 'Meta War-en-Eco',
  '🛠️ Viable (Prod+Energy Self-Work)': '🛠️ Viable (Autotrabajo Prod+Energía)',
  '⚠️ Suboptimal v0.27 SP Split': '⚠️ Distribución SP v0.27 Subóptima',
  'Needs SP Rework': 'Requiere Ajuste SP',
  'Optimal Eco Meta': 'Meta Eco Óptimo',
  'Optimal Self-Work': 'Autotrabajo Óptimo',
  'Viable Self-Work': 'Autotrabajo Viable',
  'War Optimal': 'War Óptimo',
  'War in Eco': 'War en Eco',
  'Suboptimal SP': 'SP Subóptimo',

  // Floating AuditProgressDock (Screenshot 2 bottom-right)
  'Auditing Receipts': 'Auditando Recibos',
  'Stream Paused': 'Flujo en Pausa',
  '30m Auto-Sync': 'Auto-Sinc 30m',
  '100/page Delta Sync': 'Sinc Delta 100/pág',
  '4-Thread Priority Delta Sync Active': 'Sinc Delta Prioritaria de 4 Hilos Activa',
  '4-Worker Priority Delta Sync Active': 'Sinc Delta Prioritaria de 4 Hilos Activa',
  'Why per-citizen queries are required:': 'Por qué se requieren consultas por ciudadano:',
  'The War Era API (': 'La API de War Era (',
  ') only returns personal wages and market trades per': ') solo devuelve salarios personales y comercio de mercado por cursor de',
  'cursor—it does not expose a bulk country-wide personal ledger endpoint.': '—no expone un endpoint masivo del libro mayor personal de todo el país.',
  'How we maximize speed safely:': 'Cómo maximizamos la velocidad de forma segura:',
  'All countries run': 'Todos los países ejecutan',
  '4 parallel threads': '4 hilos paralelos',
  '4 parallel workers': '4 hilos paralelos',
  'with': 'con',
  '100-receipt page batching': 'lotes de 100 recibos por página',
  'Priority-First ordering': 'orden de Prioridad Primero',
  '(auditing top wealth & potential leeches first), and': '(auditando mayor patrimonio y posibles leeches primero), y',
  'Incremental Delta Short-Circuiting': 'Cortocircuito Delta Incremental',
  '(stopping pagination immediately upon reaching an already-cached receipt ID), paced by a token bucket to prevent HTTP 429 bans.':
    '(deteniendo la paginación al instante al alcanzar un ID de recibo ya en caché), regulado para evitar bloqueos HTTP 429.',
  'Priority queue audits top wealth & earners first. Table row order stays locked while you browse.':
    'La cola de prioridad audita primero a los ciudadanos de mayor patrimonio e ingresos. El orden de las filas permanece bloqueado mientras navegas.',
  'Priority queue audits top wealth & earners first. Row positions remain locked until you click Apply.':
    'La cola prioritaria audita primero mayor patrimonio e ingresos. El orden de las filas permanece bloqueado hasta que hagas clic en Aplicar.',
  '— Table row order was kept locked so rows wouldn\'t jump while you were browsing.':
    '— El orden de las filas se mantuvo bloqueado para que no salten mientras navegas.',
  'Table row order was kept locked so rows wouldn\'t jump while you were browsing.':
    'El orden de las filas se mantuvo bloqueado para que no salten mientras navegas.',
  'Background audit complete: all citizen receipts verified':
    'Auditoría en segundo plano completa: todos los recibos verificados',
  'Background audit complete: all citizens verified':
    'Auditoría en segundo plano completa: todos los ciudadanos verificados',
  'All citizens verified with live receipts':
    'Todos los ciudadanos verificados con recibos en vivo',
  'Background audit paused': 'Auditoría en segundo plano en pausa',
  'Resuming background audit...': 'Reanudando auditoría en segundo plano...',
  'Background stream stopped': 'Flujo en segundo plano detenido',
  'Why per-citizen receipt streaming takes time & how 4-Thread Delta Sync accelerates it':
    'Por qué la transmisión de recibos por ciudadano toma tiempo y cómo la Sinc Delta de 4 Hilos la acelera',
  'Why per-citizen receipt streaming takes time & how 4-Worker Delta Sync accelerates it':
    'Por qué la transmisión de recibos por ciudadano toma tiempo y cómo la Sinc Delta de 4 Hilos la acelera',
  'Resume background audit': 'Reanudar auditoría en segundo plano',
  'Pause background audit': 'Pausar auditoría en segundo plano',
  'Expand audit dock': 'Expandir panel de auditoría',
  'Minimize audit dock': 'Minimizar panel de auditoría',
  'Dismiss audit dock': 'Cerrar panel de auditoría',

  // CitizenAuditModal Header & Navigation Tabs (Screenshots 3, 4, 5, 6)
  '⏳ Pending Receipt Verification': '⏳ Verificación de Recibos Pendiente',
  '🚨 Evader / Leech': '🚨 Evasor / Leech',
  '🛡️ Subsistence Worker': '🛡️ Trabajador de Subsistencia',
  '🔒 Illiquid Combatant': '🔒 Combatiente Ilíquido',
  '🌟 Sovereign Patriot': '🌟 Patriota Soberano',
  '🏛️ Historical Pillar': '🏛️ Pilar Histórico',
  '🔵 Standard Contributor': '🔵 Contribuyente Estándar',
  'Copy Citizen ID': 'Copiar ID de Ciudadano',
  '🌾 Eco Build': '🌾 Build Eco',
  '⚔️ War Build': '⚔️ Build War',
  '⚖️ Hybrid Build': '⚖️ Build Hybrid',
  'Strategic Tag:': 'Etiqueta Estratégica:',
  'Unassigned': 'Sin asignar',
  'Window:': 'Ventana:',
  'WINDOW:': 'VENTANA:',
  'Financial & Solvency Audit': 'Auditoría Financiera y Solvencia',
  'Companies & Bot Workforce': 'Empresas y Fuerza Laboral Bot',
  'Military & Battlefield Defense': 'Defensa Militar y Campo de Batalla',
  'Close Audit': 'Cerrar Auditoría',
  'Audit Baseline': 'Línea Base de Auditoría',
  'Audit Baseline:': 'Línea Base de Auditoría:',
  'Day-1 Provisional Baseline': 'Línea Base Provisional Día 1',

  // CitizenAuditModal Tab 1: Financial & Solvency Audit (Screenshot 3)
  'Personal receipts pending. Click to stream line-item ledger.':
    'Recibos personales pendientes. Haz clic para transmitir el libro mayor detallado.',
  'Halt Stream': 'Detener Flujo',
  'Streaming receipts...': 'Transmitiendo recibos...',
  'Stream Live In-Game Receipts': 'Transmitir Recibos del Juego en Vivo',
  'Staging Buffer Active': 'Búfer Temporal Activo',
  'Halt & Keep Loaded': 'Detener y Conservar Cargados',
  'Financial metrics are shielded under skeleton loaders until receipt stream completes, preventing temporary misleading figures.':
    'Las métricas financieras se mantienen protegidas hasta completar la transmisión de recibos, evitando cifras parciales engañosas.',
  'Connect War Era API token in the top header to stream live line-item wage contracts, item sales, and market purchases.':
    'Conecta tu token API de War Era en el encabezado superior para transmitir contratos salariales, ventas de artículos y compras de mercado en vivo.',
  'Calculating...': 'Calculando...',
  'Calculating net...': 'Calculando neto...',
  'Verifying ratio...': 'Verificando tasa...',
  'Unverified · Stream Receipts First': 'Sin Verificar · Transmite Recibos Primero',
  'Total BTC passing into wallet from wages, commodity/gear sales turnover, and tips.':
    'Total de BTC que ingresa a la billetera por salarios, volumen de ventas de bienes/equipo y propinas.',
  'Net BTC gained or lost from wages and market trading after subtracting purchases and payroll.':
    'BTC neto ganado o perdido por salarios y comercio de mercado tras restar compras y nómina.',
  'Period Treasury Contribution': 'Contribución al Tesoro en el Período',
  'PERIOD TREASURY CONTRIBUTION': 'CONTRIBUCIÓN AL TESORO EN EL PERÍODO',
  'Pending live stream verification': 'Pendiente de verificación en vivo',
  'Itemized Income Streams & Hoarding Analysis': 'Flujos de Ingresos Detallados y Análisis de Acaparamiento',
  'ITEMIZED INCOME STREAMS & HOARDING ANALYSIS': 'FLUJOS DE INGRESOS DETALLADOS Y ANÁLISIS DE ACAPARAMIENTO',
  'Wages Earned (Labor Salary)': 'Salarios Ganados (Sueldo Laboral)',
  'Wages Paid (Employee Payroll)': 'Salarios Pagados (Nómina de Empleados)',
  'Market Sales (Trading & Gear)': 'Ventas de Mercado (Comercio y Equipo)',
  'Purchases (Supplies & Gear)': 'Compras (Suministros y Equipo)',
  'Net Trading Balance': 'Balance Neto de Comercio',
  'Net difference between market sales turnover and purchase orders.':
    'Diferencia neta entre el volumen de ventas de mercado y las órdenes de compra.',
  'Journalism Tips & Crafting': 'Propinas de Periodismo y Fabricación',
  'Liquid Cash': 'Efectivo Líquido',
  'Available in wallet': 'Disponible en billetera',
  'Companies Capital': 'Capital en Empresas',
  'Resource Stockpile': 'Reserva de Recursos',
  'Items & commodities': 'Artículos y materias primas',
  'Equipment & Weapons': 'Equipamiento y Armas',
  'Equipped military armor/guns': 'Armadura y armas militares equipadas',

  // CitizenAuditModal Tab 1 Explainer Dialog
  'Net Cashflow': 'Flujo de Caja Neto',
  'Gross Cash Inflow': 'Ingreso Bruto de Caja',
  'Market Sales Turnover': 'Volumen de Ventas de Mercado',
  'Market Sourcing Purchases': 'Compras de Abastecimiento en Mercado',
  'Calculated Net Cashflow:': 'Flujo de Caja Neto Calculado:',
  'Step-by-Step Mathematical Reconciliation:': 'Reconciliación Matemática Paso a Paso:',
  '+ Wages Earned (Daily labor shifts):': '+ Salarios Ganados (Turnos diarios):',
  '+ Market Sales Turnover (Commodities & Gear):': '+ Ventas de Mercado (Materias Primas y Equipo):',
  '+ Article Journalism Tips Received:': '+ Propinas por Artículos Recibidas:',
  '- Market Sourcing Purchases:': '- Compras de Abastecimiento en Mercado:',
  '- Employee Payroll Wages Paid Out:': '- Nómina Pagada a Empleados:',
  '- Gear Crafting & Dismantle Fees:': '- Tarifas de Fabricación y Desmantelamiento:',
  '- Application & Registration Fees:': '- Tarifas de Postulación y Registro:',
  '= Net Cashflow:': '= Flujo de Caja Neto:',
  'Total Gross Cash Inflow:': 'Ingreso Bruto Total de Caja:',
  'Definition': 'Definición',
  'Inflow Stream Aggregation:': 'Agregación de Flujos de Entrada:',
  '+ Wages Earned (Daily shifts):': '+ Salarios Ganados (Turnos diarios):',
  '+ Journalism Tips Received:': '+ Propinas de Periodismo Recibidas:',
  '= Total Gross Inflow:': '= Ingreso Bruto Total:',
  'Period Treasury Donations:': 'Donaciones al Tesoro en el Período:',
  'Civic Contribution Overview': 'Resumen de Contribución Cívica',
  'Contribution Metrics:': 'Métricas de Contribución:',
  'Period Donations Tithed:': 'Donaciones del Período Aportadas:',
  'Contribution Ratio:': 'Tasa de Contribución:',
  'National Policy Minimum Quota:': 'Cuota Mínima de Política Nacional:',
  'Lifetime Historical Donations:': 'Donaciones Históricas Totales:',
  'Combat Defense Credit:': 'Crédito de Defensa en Combate:',
  'Wages Earned from Labor:': 'Salarios Ganados por Trabajo:',
  'Labor Contract Mechanics': 'Mecánica de Contratos Laborales',
  'Item Market & Commodity Orders': 'Mercado de Artículos y Órdenes de Materias Primas',
  'Market Purchases Sunk Outflow:': 'Flujo de Salida por Compras de Mercado:',
  'Sourcing Expenses': 'Gastos de Abastecimiento',
  'Net Realized Trading Balance:': 'Balance Neto Realizado de Comercio:',
  'Mathematical Difference': 'Diferencia Matemática',
  'Gross Sales Turnover:': 'Volumen Bruto de Ventas:',
  'Sourcing Purchases:': 'Compras de Abastecimiento:',
  '= Net Realized Trading Balance:': '= Balance Neto Realizado de Comercio:',
  'Dismiss Explainer': 'Cerrar Explicación',

  // CitizenAuditModal Tab 2: Line-Item Transaction Ledger (Screenshot 4)
  'Halt': 'Detener',
  'Streaming...': 'Transmitiendo...',
  'Stream Receipts': 'Transmitir Recibos',
  'Search item, ID...': 'Buscar artículo, ID...',
  'Color Guide:': 'Guía de Colores:',
  '+ Inflow (Wages, Sales, Tips)': '+ Entrada (Salarios, Ventas, Propinas)',
  '- Outflow (Purchases, Payroll, Fees)': '- Salida (Compras, Nómina, Tarifas)',
  'Tithes (Treasury / Military Donations)': 'Diezmos (Donaciones al Tesoro / Militares)',
  'Neutral / Admin': 'Neutral / Admin',
  'Date / Time': 'Fecha / Hora',
  'DATE / TIME': 'FECHA / HORA',
  'Type': 'Tipo',
  'TYPE': 'TIPO',
  'Role': 'Rol',
  'ROLE': 'ROL',
  'Item / Resource': 'Artículo / Recurso',
  'ITEM / RESOURCE': 'ARTÍCULO / RECURSO',
  'Amount (BTC)': 'Monto (BTC)',
  'AMOUNT (BTC)': 'MONTO (BTC)',
  'Counterparty / Details': 'Contraparte / Detalles',
  'COUNTERPARTY / DETAILS': 'CONTRAPARTE / DETALLES',
  'No transactions match the selected filter criteria.': 'Ninguna transacción coincide con los filtros seleccionados.',
  'Recent': 'Reciente',
  'Employer (Wage Outflow)': 'Empleador (Pago de Salario)',
  'Worker (Wage Inflow)': 'Trabajador (Cobro de Salario)',
  'Seller (Market Inflow)': 'Vendedor (Ingreso de Mercado)',
  'Buyer (Market Outflow)': 'Comprador (Compra de Mercado)',
  'Donor (Treasury Transfer)': 'Donante (Transferencia al Tesoro)',
  'Participant': 'Participante',
  'Transaction': 'Transacción',
  'trading': 'comercio',
  'wage': 'salario',
  'donation': 'donación',
  'itemMarket': 'mercado equip.',
  'craftItem': 'fabricación',
  'dismantleItem': 'desmantelar',
  'openCase': 'abrir caja',
  'articleTip': 'propina artículo',
  'applicationFee': 'tarifa postulación',
  'Domestic sovereign ledger': 'Libro mayor soberano nacional',

  // CitizenAuditModal Tab 3: Companies & Bot Workforce (Screenshot 5)
  'v0.27 Skill Build & BuhDeuce Workforce Evaluation': 'Evaluación de Build de Habilidades v0.27 y Fuerza Laboral BuhDeuce',
  'V0.27 SKILL BUILD & BUHDEUCE WORKFORCE EVALUATION': 'EVALUACIÓN DE BUILD DE HABILIDADES V0.27 Y FUERZA LABORAL BUHDEUCE',
  'Mgmt Bot Boost': 'Bono Bot de Gestión',
  'MGMT BOT BOOST': 'BONO BOT DE GESTIÓN',
  'Luck / Loot': 'Suerte / Botín',
  'In-Game Point Value:': 'Valor de Punto en Juego:',
  'Piraterers 29-Trait Sandbox & Breakroom Override Inspector': 'Simulador de 29 Rasgos Piraterers e Inspector de Break Room',
  'PIRATERERS 29-TRAIT SANDBOX & BREAKROOM OVERRIDE INSPECTOR': 'SIMULADOR DE 29 RASGOS PIRATERERS E INSPECTOR DE BREAK ROOM',
  'Syncing Live Companies...': 'Sincronizando Empresas en Vivo...',
  'Sync Live Companies': 'Sincronizar Empresas en Vivo',
  'All': 'Todas',
  'Retrieving live company and upgrade records from War Era server...':
    'Recuperando registros en vivo de empresas y mejoras desde el servidor de War Era...',

  // CitizenAuditModal Tab 4: Military & Battlefield Defense (Screenshot 6)
  'Frontline Combat & Battlefield Defense': 'Combate en el Frente y Defensa del Campo de Batalla',
  'FRONTLINE COMBAT & BATTLEFIELD DEFENSE': 'COMBATE EN EL FRENTE Y DEFENSA DEL CAMPO DE BATALLA',
  'Syncing military records...': 'Sincronizando registros militares...',
  'Combat Credit Conversion: ACTIVE': 'Conversión de Crédito de Combate: ACTIVA',
  'Combat Credit Conversion: INACTIVE': 'Conversión de Crédito de Combate: INACTIVA',
  '30-Day Combat Log Verified from Snapshots': 'Registro de Combate de 30 Días Verificado por Capturas',
  '30-Day Combat Data Notice': 'Aviso sobre Datos de Combate de 30 Días',
  'Only weekly damage is provided by the API. The APP saves snapshots of each user as you audit them. Once enough snapshots are provided to calculate a 30 day damage log, they will be displayed here.':
    'La API solo proporciona el daño semanal. La aplicación guarda capturas de cada ciudadano al auditarlo. Cuando existan suficientes capturas para calcular un registro de daño de 30 días, se mostrará aquí.',
  '30-Day Snapshot Combat Output': 'Producción de Combate de 30 Días (Capturas)',
  '7-Day War Tournament Output': 'Daño en Torneo Semanal de Guerra (7 Días)',
  'Computed from historical audit snapshots': 'Calculado a partir de capturas históricas de auditoría',
  'Weekly tournament ranking cycle': 'Ciclo semanal del ranking de torneo',
  'Converted Military Credit': 'Crédito Militar Convertido',
  'Total National Contribution': 'Contribución Nacional Total',
  'Direct BTC donations + combat credit': 'Donaciones directas en BTC + crédito de combate',
  'Fighters deployed to sovereign battlefields spend substantial liquid BTC on munitions, armor, and weapons. Frontline soldiers dealing high combat damage are recognized through military defense credits against national ministerial quotas.':
    'Los combatientes desplegados en los campos de batalla soberanos gastan importantes cantidades de BTC líquido en municiones, armaduras y armas. Los soldados de primera línea que infligen alto daño en combate son reconocidos mediante créditos de defensa militar frente a las cuotas ministeriales nacionales.',

  // War-Readiness Evaluation
  'Economic War-Readiness & Industrial Mobilization Evaluation':
    'Evaluación de Preparación Económica de Guerra y Movilización Industrial',
  'Select primary belligerents and coalition supporters to evaluate Active Population, Lvl 25+ War-Ready Citizens, Average War Participants, and Tier-5 Industrial Citizens (12 Companies @ Automation Lvl 5+).':
    'Selecciona los beligerantes principales y aliados de coalición para evaluar Población Activa, Ciudadanos Listos para Guerra (Nvl 25+), Promedio de Participantes y Ciudadanos Industriales Tier-5 (12 Empresas @ Motor Nvl 5+).',
  'Allied Coalition Force': 'Fuerza de Coalición Aliada',
  'Opponent Coalition Force': 'Fuerza de Coalición Oponente',
  'PRIMARY ALLIED STATE (AUDITED NATION)': 'ESTADO ALIADO PRINCIPAL (NACIÓN AUDITADA)',
  'PRIMARY OPPONENT STATE': 'ESTADO OPONENTE PRINCIPAL',
  'ALLIED SUPPORTER STATES (OPTIONAL)': 'ESTADOS ALIADOS DE APOYO (OPCIONAL)',
  'OPPONENT SUPPORTER STATES (OPTIONAL)': 'ESTADOS OPONENTES DE APOYO (OPCIONAL)',
  'COMBINED COALITION FORCE & INDUSTRIAL READINESS TOTALS':
    'TOTALES COMBINADOS DE FUERZA DE COALICIÓN Y PREPARACIÓN INDUSTRIAL',
  'Active Population': 'Población Activa',
  'Every active citizen (Lvl 10+)': 'Todo ciudadano activo (Nvl 10+)',
  'War-Ready Citizens (Lvl 25+)': 'Ciudadanos Listos para Guerra (Nvl 25+)',
  'WAR-READY CITIZENS': 'LISTOS PARA GUERRA',
  'Active citizens filtered by Level ≥ 25': 'Ciudadanos activos filtrados por Nivel ≥ 25',
  'Active citizens at Lvl 25+': 'Ciudadanos activos Nvl 25+',
  'Average War Participants': 'Promedio de Participantes en Guerra',
  'AVG. WAR PARTICIPANTS': 'PROM. PARTICIPANTES',
  'Active Population ÷ 2': 'Población Activa ÷ 2',
  'Tier-5 Industrial Citizens': 'Ciudadanos Industriales Tier-5',
  'TIER-5 INDUSTRIAL': 'INDUSTRIAL TIER-5',
  'Active citizens with 12 Companies @ Auto Lvl 5+': 'Ciudadanos activos con 12 Empresas @ Motor Nvl 5+',
  '12 Companies @ Auto Lvl 5+': '12 Empresas @ Motor Nvl 5+',
  'Allied Primary State': 'Estado Aliado Principal',
  'Opponent Primary State': 'Estado Oponente Principal',
  'Allied Supporter': 'Aliado de Apoyo',
  'Opponent Supporter': 'Oponente de Apoyo',
  'Verified': 'Verificado',
  'Evaluate All Pending States': 'Evaluar Estados Pendientes',
  'Re-Verify All': 'Re-Verificar Todos',

  // Company & Workforce Analyzer (v0.27) & Diagnostic Tags
  'Live Company, Manager & Bot Workforce Telemetry': 'Telemetría en Vivo de Empresas, Gerentes y Empleados Bot',
  'Full 14-day production logs (Engine, Employees, Self-work), live bot rosters, production bonus breakdowns, manager contracts, and interactive “What-If…” simulators.':
    'Registros de producción de 14 días (Motor, Empleados, Autotrabajo), plantilla de bots en vivo, desgloses de bonos, contratos de gerente y simuladores interactivos “¿Qué pasaría si…?”.',
  '📜 How work runs now (v0.27 Guide)': '📜 Cómo funciona el trabajo ahora (Guía v0.27)',
  'Refresh Live Telemetry': 'Actualizar Telemetría en Vivo',
  'Syncing…': 'Sincronizando…',
  'Analysing…': 'Analizando…',
  'Analyse Player': 'Analizar Jugador',
  'Enter any War Era player username (e.g. Boteracula_Marroquin)...': 'Ingresa cualquier usuario de War Era (ej. Boteracula_Marroquin)...',
  'Recent players:': 'Jugadores recientes:',
  'Several players match. Select a player to analyse:': 'Varios jugadores coinciden. Selecciona uno para analizar:',
  'Loading company records…': 'Cargando registros de empresas…',
  'War Era API Token Required for Live Bot Roster & 14-Day Work Logs': 'Token API de War Era Requerido para Plantilla de Bots y Registros de 14 Días',
  'Reset All Simulations': 'Restablecer Simulaciones',
  'Companies': 'Empresas',
  'Toolboxes': 'Cajas de Herramientas',
  'expected finds per day': 'hallazgos esperados por día',
  'Goods Value': 'Valor de Bienes',
  'per day, at market price': 'por día, a precio de mercado',
  'Employee Wages': 'Salarios de Empleados',
  'Managers': 'Gerentes',
  'per day': 'por día',
  'Net': 'Neto',
  'In-Game Profit': 'Beneficio en el Juego',
  'per day: employees only, as the Workforce panel shows it': 'por día: solo empleados, tal como lo muestra el panel de Fuerza Laboral',
  'production points per day': 'puntos de producción por día',
  'Lowest-Tax Countries': 'Países con Menores Impuestos',
  'has a company here': 'tiene empresa aquí',
  'Best Products Right Now': 'Mejores Productos Ahora Mismo',
  'BEST PRODUCTS RIGHT NOW': 'MEJORES PRODUCTOS AHORA MISMO',
  'LOWEST-TAX COUNTRIES': 'PAÍSES CON MENORES IMPUESTOS',
  'OUTPUT, LAST 14 DAYS': 'PRODUCCIÓN, ÚLTIMOS 14 DÍAS',
  'DAILY BALANCE': 'BALANCE DIARIO',
  ' Daily Balance': ' Balance Diario',
  'Daily Balance': 'Balance Diario',
  'MANAGER': 'GERENTE',
  'ACTIVE': 'ACTIVO',
  'INACTIVE': 'INACTIVO',
  'NONE': 'NINGUNO',
  'None': 'Ninguno',
  'Hiring': 'Contratando',
  'no bonus': 'sin bono',
  'Storage full': 'Almacenamiento lleno',
  'Idle': 'Inactiva',
  'No output in this period.': 'Sin producción en este período.',
  'Losing money': 'Perdiendo dinero',
  'Costs exceed the value of the output.': 'Los costos superan el valor de la producción.',
  'Raw costs more': 'Materia prima más cara',
  'Empty the storage so new output has room.': 'Vacía el almacenamiento para que quepa nueva producción.',
  'Manager inactive': 'Gerente inactivo',
  'The manager is not active, so the bonus may not apply.': 'El gerente está inactivo, por lo que su bono podría no aplicarse.',
  'No manager': 'Sin gerente',
  'A manager would add a bonus to every employee.': 'Un gerente añadiría un bono de producción a cada empleado.',
  'High income tax': 'Impuesto a la renta alto',
  'Feeds own factory': 'Abastece fábrica propia',
  'Own raw supply': 'Materia prima propia',
  'EMPLOYEES': 'EMPLEADOS',
  'Employees': 'Empleados',
  'Engine': 'Motor',
  'Self': 'Propio',
  'Self-work': 'Autotrabajo',
  'Total': 'Total',
  'Worth': 'Valor',
  'Wages': 'Salarios',
  'OUTPUT / DAY': 'PRODUCCIÓN / DÍA',
  'Output / Day': 'Producción / Día',
  'BY EMPLOYEES': 'POR EMPLEADOS',
  'By Employees': 'Por Empleados',
  'COSTS / DAY': 'COSTOS / DÍA',
  'Costs / Day': 'Costos / Día',
  'NET / DAY': 'NETO / DÍA',
  'Net / Day': 'Neto / Día',
  'Output': 'Producción',
  'In-game employee profit': 'Beneficio de empleados en el juego',
  'To own factories': 'A fábricas propias',
  'Raw from own companies': 'Materia prima de empresas propias',
  'Goods value': 'Valor de bienes',
  'Employee wages': 'Salarios de empleados',
  'Manager': 'Gerente',
  'NET': 'NETO',
  "With today's self-work": 'Con el autotrabajo de hoy',
  'Bonus to employees': 'Bono a empleados',
  'Wage': 'Salario',
  'Earned so far': 'Ganado hasta ahora',
  'Contract': 'Contrato',
  'can be ended': 'puede terminarse',
  'Looking for a manager': 'Buscando gerente',
  'Supply own factories': 'Abastecer fábricas propias',
  'Reset simulation': 'Restablecer simulación',
  'NAME': 'NOMBRE',
  'Name': 'Nombre',
  'PRODUCTION': 'PRODUCCIÓN',
  'Production': 'Producción',
  'BONUS': 'BONO',
  'Bonus': 'Bono',
  'HAPPINESS': 'FELICIDAD',
  'Happiness': 'Felicidad',
  'PTS/DAY': 'PTS/DÍA',
  'Pts/Day': 'Pts/Día',
  'WAGE/DAY': 'SALARIO/DÍA',
  'Wage/Day': 'Salario/Día',
  'NET/DAY': 'NETO/DÍA',
  'Net/Day': 'Neto/Día',
  'IN GAME': 'EN JUEGO',
  'In Game': 'En Juego',
  'Simulate': 'Simular',
  'Done editing': 'Terminar edición',
  'Edit Production and bonus': 'Editar Producción y bono',
  'Activate': 'Activar',
  'Deactivate': 'Desactivar',
  'Remove': 'Eliminar',
  'WHAT IF...': '¿QUÉ PASARÍA SI...?',
  'What if…': '¿Qué pasaría si…?',
  'simulate an employee, a manager or another product': 'simular un empleado, un gerente u otro producto',
  'Hire an employee': 'Contratar un empleado',
  'Wage expectation': 'Expectativa salarial',
  'Apply to this company': 'Aplicar a esta empresa',
  'The break room is full: deactivate or move an employee first.': 'El Break Room está lleno: desactiva o mueve a un empleado primero.',
  'Your manager': 'Tu gerente',
  'Hire a manager': 'Contratar un gerente',
  'Pay per point': 'Pago por punto',
  'A manager only boosts employees, and this company has no employee output yet.': 'Un gerente solo impulsa a los empleados, y esta empresa aún no tiene producción de empleados.',
  "Before the country's manager tax.": 'Antes del impuesto de gerente del país.',
  'Make another product': 'Fabricar otro producto',
  'Product': 'Producto',
  'This company has no output to compare yet.': 'Esta empresa aún no tiene producción para comparar.',
  'Ignores the switching cost and the specialization employees lose on a new good.': 'Ignora el costo de cambio y la especialización que pierden los empleados en un nuevo bien.',
  'Level': 'Nivel',
  'Applies to the whole portfolio at once: daily output, goods value, and raw material supply transfers.': 'Se aplica a todo el portafolio a la vez: producción diaria, valor de bienes y suministro de materias primas.',
  'This company has no employees right now. Use "What if…" below to simulate hiring.': 'Esta empresa no tiene empleados ahora mismo. Usa "¿Qué pasaría si…?" abajo para simular contrataciones.',
  'No work recorded yet for this company.': 'Aún no hay trabajo registrado en esta empresa.',
  'Add employee': 'Añadir empleado',
  'Set manager': 'Asignar gerente',
  'Change product': 'Cambiar producto',
  'Reset': 'Restablecer',
  'Need materials': 'Requiere materiales',
  'Buy on market': 'Comprar en mercado',
  'Produced by yourself': 'Producido por ti mismo',
  'Refresh Live Data': 'Actualizar Datos en Vivo',
  'companies': 'empresas',
  'output / day': 'producción / día',
  'goods value / day': 'valor bienes / día',
  'wages / day': 'salarios / día',
  'managers / day': 'gerentes / día',
  'net / day': 'neto / día',
  'employees': 'empleados',
  'avg bonus': 'bono prom.',
  'with working employees ·': 'con empleados activos ·',
  'with a manager': 'con gerente',
  'Active Manager': 'Gerente Activo',

  // Citizen Audit Modal & Workforce Tabs
  'Personal Fiscal Ledger & Workforce Audit': 'Libro Fiscal Personal y Auditoría de Empresas',
  'Workforce & Companies (v0.27)': 'Fuerza Laboral y Empresas (v0.27)',
  'Skill Tree & SP Audit': 'Árbol de Habilidades y Auditoría SP',
  'Receipts & Ledger': 'Recibos y Libro Mayor',
  'Close': 'Cerrar',
  'Military Unit Donations (Cashflow Outflow)': 'Donaciones a Unidad Militar (Egreso de Caja)',
  'Donor (Military Unit)': 'Donante (Unidad Militar)',
  '- Country Treasury Donations:': '- Donaciones al Tesoro Nacional:',
  '- Military Unit Donations (Cashflow Only):': '- Donaciones a Unidad Militar (Solo Flujo de Caja):',
  '- Journalism Tips Sent:': '- Propinas de Periodismo Enviadas:',

  // Watchlist, Policy, Snapshot & Backup Modals
  'Under Surveillance': 'Bajo Vigilancia',
  'Combined Contributions': 'Contribuciones Combinadas',
  'Total combined assets of watched citizens': 'Activos totales combinados de ciudadanos vigilados',
  'Historical donations from watched group': 'Donaciones históricas del grupo en vigilancia',
  'Search watched citizen or note...': 'Buscar ciudadano vigilado o nota...',
  'Add Citizen to Watch': 'Añadir Ciudadano a Vigilancia',
  'Surveillance Dossier / Note': 'Expediente / Nota de Vigilancia',
  'Style': 'Estilo',
  'Added Date': 'Fecha Añadido',
  'No citizens currently on watch. Click "Add Citizen to Watch" or click the Eye button on any citizen in the Citizen Radar.':
    'No hay ciudadanos en vigilancia. Haz clic en "Añadir Ciudadano a Vigilancia" o en el icono de Ojo en el Radar.',
  'Citizen Respec & Playstyle Shifts': 'Cambios de Build y Respec Ciudadano',
  'Dismiss': 'Descartar',
  'Place under sovereign economic surveillance': 'Colocar bajo vigilancia económica soberana',
  'Select Active Citizen': 'Seleccionar Ciudadano Activo',
  'Reason for Surveillance': 'Motivo de Vigilancia',
  'Cancel': 'Cancelar',
  'Confirm Watch': 'Confirmar Vigilancia',
  'Sovereign Backup & Storage Safeguards': 'Respaldo Soberano y Seguridad de Almacenamiento',
  'Offline-first database persistence & disaster recovery': 'Persistencia local de base de datos y recuperación ante desastres',
  'Crucial Daily Protocol Recommendation': 'Recomendación Crucial de Protocolo Diario',
  'Export Daily Backup': 'Exportar Respaldo Diario',
  'Download Backup (.json)': 'Descargar Respaldo (.json)',
  'Exporting...': 'Exportando...',
  'Restore Sovereign Data': 'Restaurar Datos Soberanos',
  'Restore from File (.json)': 'Restaurar desde Archivo (.json)',
  'JSON standard archive': 'Archivo estándar JSON',
  'Sovereign Policy & Leech Calibration': 'Calibración de Políticas Soberanas y Leeches',
  'Toggle Policy Guide & Rules': 'Mostrar/Ocultar Guía de Políticas y Reglas',
  'Hide Guide': 'Ocultar Guía',
  'Policy Guide': 'Guía de Políticas',
  'How Policy Calibration Works in War Era': 'Cómo Funciona la Calibración de Políticas en War Era',
  'Income Quotas (%):': 'Cuotas de Ingreso (%):',
  'Set the minimum percentage of weekly BTC earnings a citizen must donate to earn each tier. For example, a Patriot quota of 15% means a citizen earning 1,000 BTC must donate ≥150 BTC to receive Model Patriot status.':
    'Define el porcentaje mínimo de ingresos semanales en BTC que un ciudadano debe donar para alcanzar cada nivel. Por ejemplo, una cuota Patriota del 15% significa que un ciudadano que gana 1,000 BTC debe donar ≥150 BTC para recibir el estatus de Patriota Modelo.',
  'Playstyle Roles:': 'Roles por Estilo de Juego:',
  'Veteran Grace Floor:': 'Piso de Gracia para Veteranos:',
  "Citizens ranked in the nation's Top Lifetime Donors who meet this lifetime contribution floor are honored as Historical Pillars and protected from Critical Leech designation during active military campaigns.":
    'Los ciudadanos ubicados en el Top de Donantes Históricos de la nación que alcancen este piso acumulado son honrados como Pilares Históricos y protegidos de ser clasificados como Leeches Críticos durante campañas militares activas.',
  'Immediate Effect:': 'Efecto Inmediato:',
  'Saving your policy updates recalculates citizen audits and contribution ratios instantly!':
    '¡Guardar tus cambios de política recalcula las auditorías ciudadanas y las tasas de contribución al instante!',
  'Invalid Quota Hierarchy:': 'Jerarquía de Cuotas Inválida:',
  'Patriot > Moderate > Low Contributor': 'Patriota > Moderado > Bajo Contribuyente',
  'Analysis Period Window (Days)': 'Ventana del Período de Análisis (Días)',
  'Timeframe over which citizen BTC income growth is audited (default: 7 days / 1 week).':
    'Período de tiempo sobre el cual se audita el crecimiento de ingresos en BTC del ciudadano (predeterminado: 7 días / 1 semana).',
  '1 Day': '1 Día',
  '3 Days': '3 Días',
  '14 Days': '14 Días',
  'General Default Income Quotas (%)': 'Cuotas Generales de Ingreso por Defecto (%)',
  'Patriot ≥': 'Patriota ≥',
  'Moderate ≥': 'Moderado ≥',
  'Low Contributor ≥': 'Bajo Contribuyente ≥',
  '⚔️ War Mode Quotas (Frontline Combatants)': '⚔️ Cuotas Modo War (Combatientes del Frente)',
  'Spends on munitions & combat': 'Gasta en municiones y combate',
  'War Patriot ≥': 'Patriota War ≥',
  'War Moderate ≥': 'Moderado War ≥',
  'War Low ≥': 'Bajo War ≥',
  '🌾 Eco Mode Quotas (Industrialists & Companies)': '🌾 Cuotas Modo Eco (Industriales y Empresas)',
  'Higher passive margins': 'Mayores márgenes pasivos',
  'Eco Patriot ≥': 'Patriota Eco ≥',
  'Eco Moderate ≥': 'Moderado Eco ≥',
  'Eco Low ≥': 'Bajo Eco ≥',
  'Historical Big Contributor Grace Floor (BTC)': 'Piso de Gracia para Grandes Contribuyentes Históricos (BTC)',
  'Historical Pillars': 'Pilares Históricos',
  'Top Lifetime Donors Hall of Fame Protection (Rank)': 'Protección Salón de la Fama Top Donantes Históricos (Rango)',
  'National Wealth Percentile Floor for Critical Leech': 'Piso de Percentil de Riqueza Nacional para Leech Crítico',
  'Top 50% (Median)': 'Top 50% (Mediana)',
  'Top 25% (P75 - Default)': 'Top 25% (P75 - Predeterminado)',
  'Top 20% (P80)': 'Top 20% (P80)',
  'Top 10% (P90)': 'Top 10% (P90)',
  'Convert Battlefield Damage to Defense Credit': 'Convertir Daño en Campo de Batalla a Crédito de Defensa',
  'Awards frontline warriors who deal massive combat damage (even with 0 direct BTC donations) with defense contribution credit, recognizing them as Combat Heroes instead of leeches.':
    'Otorga a los guerreros de primera línea que infligen un daño masivo en combate (incluso con 0 donaciones directas en BTC) crédito de contribución a la defensa, reconociéndolos como Héroes de Combate en lugar de leeches.',
  'Conversion Rate (BTC per 1,000 damage dealt):': 'Tasa de Conversión (BTC por cada 1,000 de daño infligido):',
  'Playstyle Gating:': 'Filtro por Estilo de Juego:',
  'Applied to active frontline warriors (Pure-War & Hybrid). Pure-Eco industrialists receive 0 BTC credit to prevent tax evasion through incidental warfare.':
    'Se aplica a guerreros activos de primera línea (Pure-War y Hybrid). Los industriales Pure-Eco reciben 0 crédito en BTC para prevenir la evasión fiscal mediante combates incidentales.',
  'Include Raw Resource Wealth (Commodities, excluding equipment)':
    'Incluir Riqueza en Recursos Brutos (Materias Primas, excluyendo equipamiento)',
  'Counts resource stockpiles (iron, lead, oil, bread, narcotics) in donation capacity calculations, as displayed in player stats.':
    'Contabiliza las reservas de recursos (hierro, plomo, petróleo, pan, narcóticos) en los cálculos de capacidad de donación, tal como se muestra en las estadísticas del jugador.',
  'Reset to Country Defaults': 'Restablecer a Valores del País',
  'Reset all thresholds to live country API-calculated defaults':
    'Restablecer todos los umbrales a los valores predeterminados del país',
  'Save & Apply Policy': 'Guardar y Aplicar Política',
  'Patriot & Hero Diplomatic Commendation': 'Condecoración Diplomática a Patriota y Héroe',
  'Over-Donation Burnout & Solvency Advisory': 'Aviso de Sobredonación y Solvencia',
  'Dynamic Diplomatic Treasury Nudge': 'Notificación Diplomática Dinámica del Tesoro',
  'Reset to Recommended': 'Restablecer a Recomendado',
  'Treasury Nudge': 'Solicitud del Tesoro',
  'Request fair BTC contribution': 'Solicitar aporte justo en BTC',
  'Patriot Commendation': 'Condecoración Patriótica',
  'Congratulate donors, heroes & pillars': 'Felicitar a donantes, héroes y pilares',
  'Over-Donation Warning': 'Aviso de Sobredonación',
  'Protect citizen growth & ammo': 'Proteger crecimiento y munición del ciudadano',
  'Idle Liquid Cash': 'Efectivo Líquido Inactivo',
  'Weekly Cashflow': 'Flujo de Caja Semanal',
  'Weekly Cashflow Step-Up': 'Incremento sobre Flujo Semanal',
  'Higher weekly BTC from 7D output': 'Mayor aporte semanal según flujo 7D',
  'Idle Liquid BTC Hoarder': 'Acaparador de BTC Líquido Inactivo',
  'One-time lump sum from idle cash': 'Aporte único del efectivo inactivo',
  'Resource Stockpiler': 'Acumulador de Recursos',
  'Sell 10%–15% excess above 3.5x shield': 'Vender 10%–15% del excedente sobre escudo 3.5x',
  '★ Recommended': '★ Recomendado',
  'Suggested Donation Amount (BTC):': 'Monto de Donación Sugerido (BTC):',
};

/**
 * Pattern-based replacements for dynamic strings in Spanish mode
 * Carefully preserves "Leadership", "Eco", "War", "Hybrid", "Break Room".
 */
const REGEX_REPLACEMENTS_ES: Array<[RegExp, string]> = [
  [/^(\d+)\s+countries\s+\(Alphabetical\)$/i, '$1 países (Alfabético)'],
  [/^(\d+)\s+Verified Receipts$/i, '$1 Recibos Verificados'],
  [/^(\d+)\s+Active Citizens\s+\(Lvl 10\+\)$/i, '$1 Ciudadanos Activos (Nvl 10+)'],
  [/^(\d+)\s+Active\s+\(Lvl 10\+\)$/i, '$1 Activos (Nvl 10+)'],
  [/^All Fiscal Standings\s+\((.+)\)$/i, 'Todos los Estados Fiscales ($1)'],
  [/^🚨 Needs Attention \/ Leeches\s+\((.+)\)$/i, '🚨 Requiere Atención / Leeches ($1)'],
  [/^⚠️ Zero Contributions\s+\((.+)\)$/i, '⚠️ Cero Contribuciones ($1)'],
  [/^🔵 Fair \/ Moderate Donors$/i, '🔵 Donantes Justos / Moderados'],
  [/^🟢 Model Patriots & Pillars$/i, '🟢 Patriotas Modelo y Pilares'],
  [/^>7d Inactive\s+\((.+)\)$/i, '>7d Inactivos ($1)'],
  [/^(\d+)D Audit Active$/i, 'Auditoría $1D Activa'],
  [/^Force refresh (\d+)-day income growth audit$/i, 'Forzar actualización de auditoría de ingresos de $1 días'],
  [/^Sovereign Citizen & Leech Radar — (.+)$/i, 'Radar Soberano de Ciudadanos y Leeches — $1'],
  [/^Real-time income growth audits, patriotic quotas, and diplomatic treasury alerts for (.+)\.$/i, 'Auditorías de crecimiento de ingresos en tiempo real, cuotas patrióticas y alertas diplomáticas del tesoro para $1.'],
  [/^Customizable income donation ratios by playstyle for (.+)$/i, 'Proporciones personalizables de donación de ingresos según estilo de juego para $1'],
  [/^Only citizens in the upper wealth brackets of (.+) \(e\.g\. Top 25% \/ 75th percentile\) can be classified as Critical Leeches if donating 0\. Working-class and modest-wealth citizens are protected as Low Contributors\.$/i,
    'Solo los ciudadanos en los tramos superiores de riqueza de $1 (ej. Top 25% / percentil 75) pueden ser clasificados como Leeches Críticos si donan 0. Los ciudadanos de clase trabajadora y patrimonio modesto están protegidos como Bajos Contribuyentes.'],
  [/^Formula: \(Battlefield Damage ÷ 1,000\) × ([\d.]+) BTC$/i, 'Fórmula: (Daño en Campo de Batalla ÷ 1,000) × $1 BTC'],
  [/^(.+) Ministry of Economy$/i, 'Ministerio de Economía de $1'],
  [/^(.+) Treasury$/i, 'Tesoro de $1'],
  [/^Inter-State Transfers\s*\((\d+)\)$/i, 'Transferencias Interestatales ($1)'],
  [/^Assets in (.+)$/i, 'Activos en $1'],
  [/^\((\d+) patrons • (\d+) zero-contrib\)$/i, '($1 patrones • $2 sin aporte)'],
  [/^([\d,.]+)\s+BTC\s+\((\d+)D Flow\)$/i, '$1 BTC (Flujo $2D)'],
  [/^Gross economic turnover across (\d+) days$/i, 'Volumen económico bruto durante $1 días'],
  [/^Contributing under ([\d.]+)% of BTC income growth \((\d+)D window\)$/i, 'Aportando menos del $1% del ingreso BTC (ventana $2D)'],
  [/^100% Truth-Based: All (\d+) active citizens verified via live personal receipts$/i, '100% Verificado: Los $1 ciudadanos activos auditados con recibos reales'],
  [/^🔒 (\d+) updated row\(s\) pinned in current filter view$/i, '🔒 $1 fila(s) actualizada(s) fijada(s) en la vista actual'],
  [/^No citizens match the active filters in (.+)\.$/i, 'Ningún ciudadano coincide con los filtros activos en $1.'],
  [/^(\d+) Verified Citizen Audits Ready$/i, '$1 Auditorías Ciudadanas Verificadas Listas'],
  [/^(\d+) Verified Updates Ready$/i, '$1 Actualizaciones Verificadas Listas'],
  [/^Apply (\d+) Verified Updates to Table$/i, 'Aplicar $1 Actualizaciones Verificadas a la Tabla'],
  [/^Apply (\d+) Verified Updates$/i, 'Aplicar $1 Actualizaciones Verificadas'],
  [/^(\d+)\s*\/\s*(\d+)\s+citizens verified\s*(.*)$/i, '$1 / $2 ciudadanos verificados $3'],
  [/^(\d+)\s*\/\s*(\d+)\s+Citizens\s+\((\d+)%\)$/i, '$1 / $2 Ciudadanos ($3%)'],
  [/^🔒 Row Positions Locked While Browsing \((\d+) Staged\)$/i, '🔒 Orden de Filas Bloqueado al Navegar ($1 en Espera)'],
  [/^Background audit complete — (\d+) verified row updates staged\.$/i, 'Auditoría en segundo plano completada — $1 actualizaciones verificadas listas.'],
  [/^Retry (\d+) Deferred$/i, 'Reintentar $1 Diferidos'],
  [/^Retry (\d+) Failed Citizens$/i, 'Reintentar $1 Ciudadanos Fallidos'],
  [/^Sync (\d+) Pending Citizens Now$/i, 'Sincronizar $1 Ciudadanos Pendientes Ahora'],
  [/^\((\d+) timed out after 3 retries\)$/i, '($1 excedieron el tiempo tras 3 reintentos)'],
  [/^([\d,.]+)%\s+citizen turnout\s+\(lvl 10\+\)$/i, '$1% participación ciudadana (nvl 10+)'],
  [/^Mean:\s*([\d,.]+)\s*BTC$/i, 'Media: $1 BTC'],
  [/^Arithmetic Mean:\s*([\d,.]+)\s*BTC$/i, 'Media Aritmética: $1 BTC'],
  [/^([\d,.]+)%\s+of all\s+(daily|weekly|monthly|custom|all-time)\s+donations$/i, '$1% de las donaciones del período'],
  [/^Showing all (\d+) contributing citizens for (.+)$/i, 'Mostrando los $1 ciudadanos contribuyentes $2'],
  [/^No citizens found matching "(.+)"$/i, 'No se encontraron ciudadanos que coincidan con "$1"'],
  [/^Syncing Citizen #(.+)\.\.\.$/i, 'Sincronizando Ciudadano #$1...'],
  [/^(\d+)\s+verified individual donations$/i, '$1 donaciones individuales verificadas'],
  [/^(\d+)m ago$/i, 'hace $1m'],
  [/^(\d+)h ago$/i, 'hace $1h'],
  [/^(\d+)d ago$/i, 'hace $1d'],
  [/^([\d,.]+)%\s+of period funds$/i, '$1% de los fondos del período'],
  [/^(\d+)\s+receipts$/i, '$1 recibos'],
  [/^([\d,.]+)\s+life$/i, '$1 hist.'],
  [/^\+([\d,.]+)\s+BTC war$/i, '+$1 BTC war'],
  [/^·\s*Lvl\s*(\d+)$/i, '· Nvl $1'],
  [/^Lvl\s*(\d+)$/i, 'Nvl $1'],
  [/^Level\s*(\d+)\s*·\s*(.+)$/i, 'Nivel $1 · $2'],
  [/^Citizen ID:\s*(.+)$/i, 'ID de Ciudadano: $1'],
  [/^·\s*Active for (\d+)d \(Cooldown cleared\)$/i, '· Activa por $1d (Cooldown finalizado)'],
  [/^Active for (\d+)d \(Cooldown cleared\)$/i, 'Activo por $1d (Cooldown finalizado)'],
  [/^Active for (.+)$/i, 'Activo por $1'],
  [/^(🌾 Eco|⚔️ War|⚖️ Hybrid) Build\s*·\s*Active for (\d+)d \(Cooldown cleared\)$/i, '$1 Build · Activa por $2d (Cooldown finalizado)'],
  [/^(🌾 Eco|⚔️ War|⚖️ Hybrid) Build\s*·\s*Recently switched \((.+?) ago\)$/i, '$1 Build · Cambiada recientemente (hace $2)'],
  [/^(?:Concurrent Threads|Concurrent Workers|Workers Concurrentes)\s*\((.+?)\s+Active\):?$/i, 'Hilos Concurrentes ($1 Activos):'],
  [/^(?:Concurrent Threads|Concurrent Workers|Workers Concurrentes)\s*\((.+?)\s+Activos\):?$/i, 'Hilos Concurrentes ($1 Activos):'],
  [/^Audit Baseline:?$/i, 'Línea Base de Auditoría:'],
  [/^Audit Baseline:\s*(.+)$/i, 'Línea Base de Auditoría: $1'],
  [/^([\d,.]+)%\s+ratio\s+de\s+contribución/i, '$1% tasa de contribución'],
  [/^([\d,.]+)%\s+ratio\b/i, '$1% tasa'],
  [/^Inflow & Net \((\d+)D\)$/i, 'Ingreso y Neto ($1D)'],
  [/^Donated \((\d+)D\)$/i, 'Donado ($1D)'],
  [/^Line-Item Transaction Ledger \((\d+)\)$/i, 'Libro Mayor de Transacciones ($1)'],
  [/^Loaded (\d+) verified in-game receipts \((\d+) wage slips, (\d+) market sales across (\d+)D\)\.$/i, 'Cargados $1 recibos verificados del juego ($2 recibos de salario, $3 ventas de mercado en $4D).'],
  [/^Streaming Personal Receipts: Page (\d+) \((\d+) receipts verified\)\.\.\.$/i, 'Transmitiendo Recibos Personales: Página $1 ($2 recibos verificados)...'],
  [/^Gross Cash Inflow \((\d+)D\)$/i, 'Ingreso Bruto de Caja ($1D)'],
  [/^Net Cashflow \((\d+)D\)$/i, 'Flujo de Caja Neto ($1D)'],
  [/^([\d,.]+)%\s+contribution ratio\s*·\s*([\d,.]+)\s+BTC lifetime$/i, '$1% tasa de contribución · $2 BTC histórico'],
  [/^([\d,.]+)%\s+contribution ratio$/i, '$1% tasa de contribución'],
  [/^(\d+)\s+work shifts completed\. Earned from daily labor contracts\.$/i, '$1 turnos de trabajo completados. Ganado por contratos laborales diarios.'],
  [/^(\d+)\s+payroll disbursements to hired factory workers\.$/i, '$1 pagos de nómina a trabajadores contratados en fábricas.'],
  [/^(\d+)\s+filled orders\. Converted manufactured goods \(lead, steel, ammo\) & gear into liquid BTC\.$/i, '$1 órdenes completadas. Bienes manufacturados (plomo, acero, munición) y equipo convertidos en BTC líquido.'],
  [/^(\d+)\s+filled purchase orders\. BTC spent buying resources or equipment\.$/i, '$1 órdenes de compra completadas. BTC gastado comprando recursos o equipamiento.'],
  [/^Tips:\s*\+([\d,.]+)\s*BTC\s*·\s*Crafting\/cases:\s*-([\d,.]+)\s*BTC$/i, 'Propinas: +$1 BTC · Fabricación/cajas: -$2 BTC'],
  [/^Balance Sheet Portfolio \(Total Net Worth:\s*([\d,.]+)\s*BTC\)$/i, 'Portafolio de Balance General (Patrimonio Neto Total: $1 BTC)'],
  [/^(\d+)\s+companies owned$/i, '$1 empresas en propiedad'],
  [/^(\d+)D Verified Receipts$/i, 'Recibos Verificados ($1D)'],
  [/^All \((\d+)\)$/i, 'Todas ($1)'],
  [/^Wages \((\d+)\)$/i, 'Salarios ($1)'],
  [/^Trading Commodities \((\d+)\)$/i, 'Comercio de Bienes ($1)'],
  [/^Item Market \((\d+)\)$/i, 'Mercado de Equipo ($1)'],
  [/^Donations \((\d+)\)$/i, 'Donaciones ($1)'],
  [/^Tips & Fees \((\d+)\)$/i, 'Propinas y Tarifas ($1)'],
  [/^Page (\d+) \((\d+) txs\)$/i, 'Página $1 ($2 txs)'],
  [/^Live streaming and verifying in-game receipts \((\d+) receipts verified for (\d+)D window\)\.\.\.$/i, 'Transmitiendo y verificando recibos del juego en vivo ($1 recibos verificados para ventana $2D)...'],
  [/^No receipts found within the active (\d+)-day timeframe\. Click "Stream Live In-Game Receipts" to refresh history\.$/i, 'No se encontraron recibos dentro de la ventana activa de $1 días. Haz clic en "Transmitir Recibos del Juego en Vivo" para actualizar.'],
  [/^Worker:\s*(.+)$/i, 'Trabajador: $1'],
  [/^Company:\s*(.+)$/i, 'Empresa: $1'],
  [/^Seller:\s*(.+)$/i, 'Vendedor: $1'],
  [/^Buyer:\s*(.+)$/i, 'Comprador: $1'],
  [/^Military Unit:\s*(.+)$/i, 'Unidad Militar: $1'],
  [/^(\d+)\s+transfer\(s\)\s*·\s*Deducted from Net Cashflow only \(excluded from country leaderboard & citizen classification\)\.$/i,
    '$1 transferencia(s) · Deducido solo del Flujo de Caja Neto (excluido del ranking nacional y clasificación ciudadana).'],
  [/^Successfully verified (\d+) receipts \((\d+) wage shifts, (\d+) market sales across (\d+)D\)!$/i,
    '¡Verificados con éxito $1 recibos ($2 turnos de salario, $3 ventas de mercado en $4D)!'],
  [/^\+(\d+)%\s+Output$/i, '+$1% Producción'],
  [/^(\d+)\s+Live API Record\(s\)$/i, '$1 Registro(s) API en Vivo'],
  [/^Calibrated at ([\d.]+) BTC per 1,000 DMG$/i, 'Calibrado a $1 BTC por 1,000 DMG'],
  [/^Calculation Methodology & Mathematical Reconciliation \((\d+)-Day Window\)$/i, 'Metodología de Cálculo y Reconciliación Matemática (Ventana de $1 Días)'],
  [/^Why is this ([\d,.-]+) BTC when their wallet has ([\d,.-]+) BTC\?$/i, '¿Por qué es $1 BTC cuando su billetera tiene $2 BTC?'],
  [/^([\d.]+)% of Gross Inflow$/i, '$1% del Ingreso Bruto'],
  [/^Verified market sales completed: (\d+) orders$/i, 'Ventas de mercado verificadas completadas: $1 órdenes'],
  [/^Verified buy orders executed: (\d+) orders$/i, 'Órdenes de compra verificadas ejecutadas: $1 órdenes'],
  [/^High-efficiency v0\.27 Eco Build \(Lvl (\d+)\): Leadership \((\d+)\), Management \(\+(\d+)%\), Energy \((\d+) cap\), Companies \((\d+)\)\.$/i,
    'Build Eco v0.27 de alta eficiencia (Nvl $1): Leadership ($2), Gestión (+$3%), Energía (cap. $4), Empresas ($5).'],
  [/^Management Level (\d+) is granting a \+(\d+)% production boost across all hired bot employees\.$/i,
    'El Nivel $1 de Gestión otorga un impulso de producción de +$2% a todos los empleados bot contratados.'],
  [/^BuhDeuce Eco Protocol: Run 1 week all-out Energy \(train 3 employees in all 12 companies daily\), then balance 1:1 with Production and Energy\.$/i,
    'Protocolo Eco BuhDeuce: Ejecuta 1 semana 100% Energía (entrena 3 empleados en las 12 empresas a diario) y luego equilibra 1:1 entre Producción y Energía.'],
  [/^Scale toward 12 active companies with Level 3 Breakrooms \(3 employees per company = 36 total bot workers\)\.$/i,
    'Escala hacia 12 empresas activas con Break Room Nivel 3 (3 empleados por empresa = 36 trabajadores bot en total).'],
  [/^Energy and Management have equal value in Eco: add Management SP \(\+2% bot output per level\) alongside Energy\.$/i,
    'Energía y Gestión tienen igual valor en Eco: añade SP en Gestión (+2% producción bot por nivel) junto con Energía.'],
  [/^Following Phase 2 Eco cycle: 1:1 ratio with Production and Energy after training employees\.$/i,
    'Siguiendo Fase 2 del ciclo Eco: proporción 1:1 entre Producción y Energía tras entrenar empleados.'],
  [/^Optimal Wartime Spec \(Lvl (\d+)\): Combat-focused with (\d+) Companies SP and (\d+) Luck SP\.$/i,
    'Spec de Guerra Óptima (Nvl $1): Enfocada en combate con $2 SP en Empresas y $3 SP en Suerte.'],
  [/^BuhDeuce War Rule: No extra SP in Eco is needed during active war apart from Companies and Luck\.$/i,
    'Regla War BuhDeuce: No se requiere SP extra en Eco durante guerra activa aparte de Empresas y Suerte.'],
  [/^Ensure your pre-trained bot employees stay above 30 happiness so they continue producing passively while you fight\.$/i,
    'Asegúrate de que tus empleados bot preentrenados se mantengan sobre 30 de felicidad para que sigan produciendo pasivamente mientras combates.'],
  [/^ALLIED PER-STATE BREAKDOWN \((\d+)\)$/i, 'DESGLOSE POR ESTADO ALIADO ($1)'],
  [/^OPPONENT PER-STATE BREAKDOWN \((\d+)\)$/i, 'DESGLOSE POR ESTADO OPONENTE ($1)'],
  [/^HOW (.+)'S METRICS WERE CALCULATED$/i, 'CÓMO SE CALCULARON LAS MÉTRICAS DE $1'],
  [/^Inspect Tier-5 Industrial Citizens \((\d+)\)$/i, 'Inspeccionar Ciudadanos Industriales Tier-5 ($1)'],
  [/^Inspect War-Ready Lvl 25\+ Roster \((\d+)\)$/i, 'Inspeccionar Ciudadanos Nvl 25+ Listos para Guerra ($1)'],
  [/^Output, last (\d+) days$/i, 'Producción, últimos $1 días'],
  [/^Daily output for the last (\d+) days$/i, 'Producción diaria de los últimos $1 días'],
  [/^max ([\d,.]+) pts$/i, 'máx $1 pts'],
  [/^([\d,.]+) pts · ([\d,.]+) units$/i, '$1 pts · $2 unidades'],
  [/^([+−-]?[\d,.]+) w\/ self$/i, '$1 c/ propio'],
  [/^What the companies screen shows: employee points × the value of a point \((.+?)\), minus their wages\. Leaves out the engine, self-work and market prices\.$/i,
    'Lo que muestra la pantalla de empresas: puntos de empleados × el valor de un punto ($1), menos sus salarios. Excluye el motor, el autotrabajo y los precios de mercado.'],
  [/^What the companies screen shows: points × the point value − wage$/i,
    'Lo que muestra la pantalla de empresas: puntos × el valor del punto − salario'],
  [/^(\d+) with working employees · (\d+) with a manager$/i, '$1 con empleados activos · $2 con gerente'],
  [/^Management (\d+) pts · \+(\d+)%$/i, 'Gestión $1 pts · +$2%'],
  [/^Engine (\d+)$/i, 'Motor $1'],
  [/^Storage (\d+)$/i, 'Almacenamiento $1'],
  [/^Break room (\d+) · up to (\d+) employees?$/i, 'Break Room $1 · hasta $2 empleado(s)'],
  [/^(\d+) of (\d+)$/i, '$1 de $2'],
  [/^management (\d+)$/i, 'gestión $1'],
  [/^([\d.]+) per 100 pts$/i, '$1 por 100 pts'],
  [/^([\d.]+)\/day at this output$/i, '$1/día a esta producción'],
  [/^([\d.]+) per 100 pts · ([\d.]+)\/day at this output$/i, '$1 por 100 pts · $2/día a esta producción'],
  [/^income ([\d.]+)% · market ([\d.]+)%$/i, 'ingreso $1% · mercado $2%'],
  [/^income ([\d.]+)% · manager ([\d.]+)% · market ([\d.]+)%$/i, 'ingreso $1% · gerente $2% · mercado $3%'],
  [/^(.+) tax · income ([\d.]+)% · manager ([\d.]+)% · market ([\d.]+)%$/i, 'Impuesto $1 · ingreso $2% · gerente $3% · mercado $4%'],
  [/^wages ([\d.]+) · mgr ([\d.]+)$/i, 'salarios $1 · ger. $2'],
  [/^([\d.]+) pts · engine (\d+)$/i, '$1 pts · motor $2'],
  [/^value ([\d.]+)$/i, 'valor $1'],
  [/^up to ([\d.]+)\/h$/i, 'hasta $1/h'],
  [/^Pays ([\d.]+)\/h per Management point · up to ([\d.]+)\/h\.$/i, 'Paga $1/h por punto de Gestión · hasta $2/h.'],
  [/^locked until (.+) UTC$/i, 'bloqueado hasta $1 UTC'],
  [/^can be ended$/i, 'puede finalizarse'],
  [/^Level (\d+) · (\d+) pts\/day$/i, 'Nivel $1 · $2 pts/día'],
  [/^Off \(0 pts\/day\)$/i, 'Apagado (0 pts/día)'],
  [/^Back to level (\d+)$/i, 'Volver al nivel $1'],
  [/^— Or Pick Audited Citizen \((\d+)\) —$/i, '— O Elegir Ciudadano Auditado ($1) —'],
  [/^the game's estimate for the (\d+) current employees?; engine from the average of the last (\d+) full days? under v0\.27$/i,
    'la estimación del juego para $1 empleado(s) actual(es); motor según el promedio de los últimos $2 día(s) completos en v0.27'],
  [/^the game's estimate for the (\d+) current employees?; engine from the (.+)$/i,
    'la estimación del juego para $1 empleado(s) actual(es); motor según $2'],
  [/^average of the last (\d+) full days? under v0\.27$/i,
    'el promedio de los últimos $1 día(s) completos en v0.27'],
  [/^(\d+) h since the v0\.27 launch, scaled to a day$/i,
    '$1 h desde el lanzamiento de v0.27, escalado a 24 h'],
  [/^engine level (\d+) \((\d+) pts\/day\)$/i, 'motor nivel $1 ($2 pts/día)'],
  [/^no work recorded yet$/i, 'sin trabajo registrado aún'],
  [/^([\d,.]+) units, not sold$/i, '$1 unidades, no vendidas'],
  [/^([\d,.]+) units, not bought$/i, '$1 unidades, no compradas'],
  [/^\(([\d,.]+) of ([\d,.]+) units\/day\)$/i, '($1 de $2 unidades/día)'],
  [/^Buying the raw materials costs more than the (.+) sells for\.$/i, 'Comprar las materias primas cuesta más de lo que vale vender $1.'],
  [/^(.+) taxes income at ([\d.]+)%: employees lose 1 happiness per 1%, so −([\d.]+)% output here\.$/i,
    '$1 aplica $2% de impuesto a la renta: los empleados pierden 1 de felicidad por cada 1%, restando −$3% de producción aquí.'],
  [/^([\d,.]+) units\/day go to the player's own factories\.$/i, '$1 unidades/día van a las fábricas propias del jugador.'],
  [/^([\d,.]+) raw units\/day come from the player's own companies\.$/i, '$1 unidades/día de materia prima provienen de las empresas propias del jugador.'],
  [/^Official v0\.27 rules: an employee makes Production ÷ 4 points per hour, plus your \+([\d.]+)% bonus\s*(.+)\.$/i,
    'Reglas oficiales v0.27: un empleado genera Producción ÷ 4 puntos por hora, más tu bono de +$1% $2.'],
  [/^([\d,.]+) pts\/day → worth ([\d,.]+) · wage ([\d,.]+)$/i, '$1 pts/día → valor $2 · salario $3'],
  [/^Point value: ([\d,.]+); this product is worth ([\d,.]+) a point\.$/i, 'Valor del punto: $1; este producto vale $2 por punto.'],
  [/^\+([\d,.]+)% → \+([\d,.]+) pts\/day, worth ([\d,.]+) · pay ([\d,.]+)$/i, '+$1% → +$2 pts/día, valor $3 · pago $4'],
  [/^Same ([\d,.]+) pts\/day as (.+) → worth ([\d,.]+) \(now ([\d,.]+)\)$/i, 'Mismos $1 pts/día como $2 → valor $3 (actual $4)'],
  [/^Sim employee (\d+)$/i, 'Empleado sim $1'],
  [/^Simulated \(\+([\d.]+)% owner\/manager\/home bonus\)$/i, 'Simulado (+$1% bono dueño/gerente/país)'],
  [/^Move to (.+)$/i, 'Mover a $1'],
  // AuditProgressDock & auditStreamService dynamic messages
  [/^Audit pass finished \((\d+) verified, (\d+) need retry\)$/i, 'Pase de auditoría finalizado ($1 verificados, $2 requieren reintento)'],
  [/^Auditing (\d+) citizens\.\.\.$/i, 'Auditando $1 ciudadanos...'],
  [/^Auditing (.+)\.\.\.$/i, 'Auditando a $1...'],
  [/^Auditing (.+)$/i, 'Auditando $1'],
  [/^Audit Status — (.+)$/i, 'Estado de Auditoría — $1'],
  [/^Verified (.+) \((\d+) receipts\)$/i, 'Verificado $1 ($2 recibos)'],
  [/^Retrying (.+) \(attempt (\d+)\/(\d+)\)\.\.\.$/i, 'Reintentando $1 (intento $2/$3)...'],
  [/^API rate limit reached on (.+)\. Cooling down\.\.\.$/i, 'Límite API alcanzado en $1. Enfriando...'],
  [/^Deferred (.+) after (\d+) retries$/i, 'Diferido $1 tras $2 reintentos'],
  [/^(\d+) citizen\(s\) timed out on API$/i, '$1 ciudadano(s) agotaron tiempo en API'],
  [/^Retry (\d+) Failed$/i, 'Reintentar $1 Fallidos'],
  [/^Concurrent (?:Threads|Workers) \(1 Active\):$/i, 'Hilos Concurrentes (1 Activo):'],
  [/^Concurrent (?:Threads|Workers) \((\d+) Active\):$/i, 'Hilos Concurrentes ($1 Activos):'],
  [/^(\d+)-(?:Thread|Worker) Priority Delta Sync Active$/i, 'Sinc Delta Prioritaria de $1 Hilos Activa'],
  [/^(\d+)-(?:Thread|Worker) Delta Receipt Verification:$/i, 'Verificación Delta de Recibos ($1 Hilos):'],
  [/^Why per-citizen receipt streaming takes time & how (\d+)-(?:Thread|Worker) Delta Sync accelerates it$/i,
    'Por qué la transmisión de recibos por ciudadano toma tiempo y cómo la Sinc Delta de $1 Hilos la acelera'],
  [/^(\d+) parallel (?:threads|workers)$/i, '$1 hilos paralelos'],
];

// Precomputed Case-Insensitive Dictionaries for O(1) Lookup regardless of source casing
const LOWER_EXACT_PHRASE_ES: Record<string, string> = {};
for (const [k, v] of Object.entries(EXACT_PHRASE_ES)) {
  LOWER_EXACT_PHRASE_ES[k.toLowerCase()] = v;
}

const LOWER_COMMODITY_ES_MAP: Record<string, string> = {};
for (const [k, v] of Object.entries(WARERA_COMMODITY_ES_MAP)) {
  LOWER_COMMODITY_ES_MAP[k.toLowerCase()] = v;
}

const LOWER_SKILL_ES_MAP: Record<string, string> = {};
for (const [k, v] of Object.entries(WARERA_SKILL_ES_MAP)) {
  LOWER_SKILL_ES_MAP[k.toLowerCase()] = v;
}

// CamelCase API Breakdown Keys & 29 Canonical Trait Code Translations (ES)
const BREAKDOWN_SOURCE_ES_MAP: Record<string, string> = {
  management: 'gestión',
  coreregion: 'región núcleo',
  homeregion: 'región natal',
  homecountry: 'país natal',
  happiness: 'felicidad',
  specialization: 'especialización',
  specialized: 'especialización',
  tool: 'herramienta',
  tools: 'herramientas',
  breakroom: 'Break Room',
  incometax: 'imp. renta',
  tax: 'impuesto',
  manager: 'gerente',
  base: 'base',
  traits: 'rasgos',
  trait: 'rasgo',
  politicalstability: 'estabilidad pol.',
  countrybonus: 'bono país',
  regionbonus: 'bono región',
  partybonus: 'bono partido',
  militarybonus: 'bono militar',
};

const TRAIT_CODE_ES_MAP: Record<string, string> = {
  craftsman: 'Artesano',
  laborer: 'Obrero',
  workaholic: 'Adicto al Trabajo',
  perfectionist: 'Perfeccionista',
  stoic: 'Estoico',
  unflappable: 'Imperturbable',
  frugal: 'Frugal',
  modest: 'Modesto',
  loyal: 'Leal',
  minimalist: 'Minimalista',
  optimist: 'Optimista',
  jolly: 'Alegre',
  content: 'Contento',
  quickstudy: 'Aprendiz Rápido',
  prodigy: 'Prodigio',
  gifted: 'Dotado',
  resourceful: 'Ingenioso',
  handyman: 'Manitas',
  tinkerer: 'Inventor',
  mentor: 'Mentor',
  motivator: 'Motivador',
  teamplayer: 'Jugador de Equipo',
  recruiter: 'Reclutador',
  mediator: 'Mediador',
  cheerleader: 'Animador',
  comic: 'Cómico',
  peacemaker: 'Pacificador',
  anchor: 'Ancla',
  zen: 'Zen',
  rival: 'Rival',
};

const UTC_DAY_ES_MAP: Record<string, string> = {
  MON: 'LUN',
  TUE: 'MAR',
  WED: 'MIÉ',
  THU: 'JUE',
  FRI: 'VIE',
  SAT: 'SÁB',
  SUN: 'DOM',
};

const UTC_MONTH_ES_MAP: Record<string, string> = {
  JAN: 'ENE',
  FEB: 'FEB',
  MAR: 'MAR',
  APR: 'ABR',
  MAY: 'MAY',
  JUN: 'JUN',
  JUL: 'JUL',
  AUG: 'AGO',
  SEP: 'SEP',
  OCT: 'OCT',
  NOV: 'NOV',
  DEC: 'DIC',
};

export function translateRawStringEs(raw: string): string {
  const trimmed = raw.trim();
  if (!trimmed) return raw;

  const lower = trimmed.toLowerCase();

  // 1. Check exact match (case-sensitive then case-insensitive)
  if (EXACT_PHRASE_ES[trimmed]) {
    return raw.replace(trimmed, EXACT_PHRASE_ES[trimmed]);
  }
  if (LOWER_EXACT_PHRASE_ES[lower]) {
    return raw.replace(trimmed, LOWER_EXACT_PHRASE_ES[lower]);
  }

  // 2. Check commodity exact match (case-sensitive then case-insensitive)
  if (WARERA_COMMODITY_ES_MAP[trimmed]) {
    return raw.replace(trimmed, WARERA_COMMODITY_ES_MAP[trimmed]);
  }
  if (LOWER_COMMODITY_ES_MAP[lower]) {
    return raw.replace(trimmed, LOWER_COMMODITY_ES_MAP[lower]);
  }

  // 3. Check skill exact match (keeps Leadership in English!)
  if (WARERA_SKILL_ES_MAP[trimmed]) {
    return raw.replace(trimmed, WARERA_SKILL_ES_MAP[trimmed]);
  }
  if (LOWER_SKILL_ES_MAP[lower]) {
    return raw.replace(trimmed, LOWER_SKILL_ES_MAP[lower]);
  }

  // 4. Check punctuation-wrapped exact match (e.g., "Audit Baseline:" or "— Table row order...")
  if (trimmed.endsWith(':')) {
    const core = trimmed.slice(0, -1).trim();
    const coreMatch = EXACT_PHRASE_ES[core] || LOWER_EXACT_PHRASE_ES[core.toLowerCase()];
    if (coreMatch) {
      return raw.replace(trimmed, `${coreMatch}:`);
    }
  }
  if (trimmed.startsWith('— ')) {
    const core = trimmed.slice(2).trim();
    const coreMatch = EXACT_PHRASE_ES[core] || LOWER_EXACT_PHRASE_ES[core.toLowerCase()];
    if (coreMatch) {
      return raw.replace(trimmed, `— ${coreMatch}`);
    }
  }

  // 5. Check UTC Chart Header Date (e.g. "SAT, 24 OCT" or "MON, 26 OCT · TODAY SO FAR")
  const utcDateMatch = trimmed.match(
    /^(MON|TUE|WED|THU|FRI|SAT|SUN),\s*(\d+)\s+(JAN|FEB|MAR|APR|MAY|JUN|JUL|AUG|SEP|OCT|NOV|DEC)(\s*·\s*TODAY SO FAR)?$/i
  );
  if (utcDateMatch) {
    const dayEs = UTC_DAY_ES_MAP[utcDateMatch[1].toUpperCase()] || utcDateMatch[1];
    const num = utcDateMatch[2];
    const monEs = UTC_MONTH_ES_MAP[utcDateMatch[3].toUpperCase()] || utcDateMatch[3];
    const todaySuffix = utcDateMatch[4] ? ' · HOY HASTA AHORA' : '';
    return raw.replace(trimmed, `${dayEs}, ${num} ${monEs}${todaySuffix}`);
  }

  // 6. Check compound employee bonus/production/happiness breakdown strings
  // e.g. "management +12.0% · coreRegion +15.0% · happiness +6.0%"
  if (/^[a-zA-Z]+\s+[+−-]?[\d.]+%?(\s*·\s*[a-zA-Z]+\s+[+−-]?[\d.]+%?)*$/.test(trimmed)) {
    const parts = trimmed.split(/\s*·\s*/);
    let changed = false;
    const localizedParts = parts.map((part) => {
      const m = part.match(/^([a-zA-Z]+)\s+([+−-]?[\d.]+%?)$/);
      if (!m) return part;
      const srcEs = BREAKDOWN_SOURCE_ES_MAP[m[1].toLowerCase()];
      if (srcEs) {
        changed = true;
        return `${srcEs} ${m[2]}`;
      }
      return part;
    });
    if (changed) {
      return raw.replace(trimmed, localizedParts.join(' · '));
    }
  }

  // 7. Check comma-separated camelCase employee trait codes (e.g. "quickStudy", "comic, recruiter, rival")
  if (/^[a-zA-Z]+(,\s*[a-zA-Z]+)*$/.test(trimmed)) {
    const tokens = trimmed.split(/,\s*/);
    if (tokens.every((t) => Boolean(TRAIT_CODE_ES_MAP[t.toLowerCase()]))) {
      const localizedTraits = tokens.map((t) => TRAIT_CODE_ES_MAP[t.toLowerCase()]).join(', ');
      return raw.replace(trimmed, localizedTraits);
    }
  }

  // 8. Check regex patterns
  for (const [pattern, replacement] of REGEX_REPLACEMENTS_ES) {
    if (pattern.test(trimmed)) {
      return raw.replace(trimmed, trimmed.replace(pattern, replacement));
    }
  }

  return raw;
}

function translateTextNodeValue(raw: string): string {
  return translateRawStringEs(raw);
}

export const I18nProvider: React.FC<{ children: React.ReactNode }> = ({ children }) => {
  const [lang, setLangState] = useState<AppLanguage>(() => {
    try {
      const saved = localStorage.getItem(LANG_STORAGE_KEY);
      if (saved === 'es' || saved === 'en') {
        return saved;
      }
    } catch {
      // ignore storage errors
    }
    return 'en'; // Default is strictly English
  });

  const originalTextMapRef = useRef<WeakMap<Node, string>>(new WeakMap());
  const lastTranslatedMapRef = useRef<WeakMap<Node, string>>(new WeakMap());
  const originalAttrMapRef = useRef<WeakMap<Element, Record<string, string>>>(new WeakMap());

  const setLang = useCallback((nextLang: AppLanguage) => {
    setLangState(nextLang);
    try {
      localStorage.setItem(LANG_STORAGE_KEY, nextLang);
    } catch {
      // ignore storage errors
    }
  }, []);

  const tx = useCallback(
    (en: string, es: string) => {
      return lang === 'es' ? es : en;
    },
    [lang]
  );

  const translateSkill = useCallback(
    (skillName: string) => {
      if (!skillName || lang === 'en') return skillName;
      // Never translate Leadership
      if (skillName.toLowerCase() === 'leadership') return 'Leadership';
      return WARERA_SKILL_ES_MAP[skillName] || skillName;
    },
    [lang]
  );

  const translateCommodity = useCallback(
    (itemName: string) => {
      if (!itemName || lang === 'en') return itemName;
      return (
        WARERA_COMMODITY_ES_MAP[itemName] ||
        LOWER_COMMODITY_ES_MAP[itemName.toLowerCase()] ||
        itemName
      );
    },
    [lang]
  );

  // Reversible DOM Text & Attribute Localizer so deep static labels, select options, and tooltips
  // are seamlessly localized in Spanish and restored 1:1 when switching back to English,
  // while strictly ignoring elements marked data-no-dom-i18n="true" or dynamic React states.
  useEffect(() => {
    if (typeof document === 'undefined') return;

    let isApplying = false;

    const isExempt = (node: Node | null): boolean => {
      if (!node) return false;
      const el = node.nodeType === Node.ELEMENT_NODE ? (node as Element) : node.parentElement;
      return Boolean(el && el.closest && el.closest('[data-no-dom-i18n="true"]'));
    };

    const processTree = (root: Node) => {
      if (isApplying) return;
      if (isExempt(root)) return;
      isApplying = true;
      try {
        const walker = document.createTreeWalker(root, NodeFilter.SHOW_TEXT | NodeFilter.SHOW_ELEMENT);
        let node: Node | null = walker.currentNode;
        while (node) {
          if (node.nodeType === Node.TEXT_NODE) {
            const parent = node.parentElement;
            const parentTag = parent?.tagName;
            if (
              parentTag !== 'SCRIPT' &&
              parentTag !== 'STYLE' &&
              parentTag !== 'TEXTAREA' &&
              !isExempt(node)
            ) {
              const currentVal = node.nodeValue || '';
              if (lang === 'es') {
                const baseEn = originalTextMapRef.current.get(node) ?? currentVal;
                const translated = translateTextNodeValue(baseEn);
                if (translated !== currentVal) {
                  if (!originalTextMapRef.current.has(node)) {
                    originalTextMapRef.current.set(node, currentVal);
                  }
                  lastTranslatedMapRef.current.set(node, translated);
                  node.nodeValue = translated;
                }
              } else {
                const orig = originalTextMapRef.current.get(node);
                const lastTrans = lastTranslatedMapRef.current.get(node);
                // Only restore if this exact node currently holds our translated string
                if (orig !== undefined && lastTrans !== undefined && currentVal === lastTrans) {
                  node.nodeValue = orig;
                }
              }
            }
          } else if (node.nodeType === Node.ELEMENT_NODE) {
            const el = node as Element;
            if (!isExempt(el)) {
              const attrsToCheck = ['placeholder', 'title', 'aria-label'];
              for (const attr of attrsToCheck) {
                const val = el.getAttribute(attr);
                if (val) {
                  let savedAttrs = originalAttrMapRef.current.get(el);
                  if (!savedAttrs) {
                    savedAttrs = {};
                    originalAttrMapRef.current.set(el, savedAttrs);
                  }
                  if (lang === 'es') {
                    const baseAttr = savedAttrs[attr] ?? val;
                    const translatedAttr = translateTextNodeValue(baseAttr);
                    if (translatedAttr !== val) {
                      if (savedAttrs[attr] === undefined) {
                        savedAttrs[attr] = val;
                      }
                      el.setAttribute(attr, translatedAttr);
                    }
                  } else if (savedAttrs[attr] !== undefined && savedAttrs[attr] !== val) {
                    el.setAttribute(attr, savedAttrs[attr]);
                  }
                }
              }
            }
          }
          node = walker.nextNode();
        }
      } finally {
        isApplying = false;
      }
    };

    processTree(document.body);

    if (lang === 'es') {
      const observer = new MutationObserver((mutations) => {
        if (isApplying) return;
        for (const m of mutations) {
          if (m.type === 'childList') {
            m.addedNodes.forEach((added) => processTree(added));
          } else if (m.type === 'characterData' && m.target) {
            const targetNode = m.target;
            if (isExempt(targetNode)) continue;
            const currentVal = targetNode.nodeValue || '';
            const lastTrans = lastTranslatedMapRef.current.get(targetNode);
            // If the mutation was our own write, ignore
            if (currentVal === lastTrans) continue;
            const translated = translateTextNodeValue(currentVal);
            if (translated !== currentVal) {
              isApplying = true;
              originalTextMapRef.current.set(targetNode, currentVal);
              lastTranslatedMapRef.current.set(targetNode, translated);
              targetNode.nodeValue = translated;
              isApplying = false;
            }
          }
        }
      });

      observer.observe(document.body, {
        childList: true,
        subtree: true,
        characterData: true,
      });

      return () => observer.disconnect();
    } else {
      // In English mode, clear the caches so stale values from prior sessions never leak into new data
      originalTextMapRef.current = new WeakMap();
      lastTranslatedMapRef.current = new WeakMap();
      originalAttrMapRef.current = new WeakMap();
    }
  }, [lang]);

  return (
    <I18nContext.Provider value={{ lang, setLang, tx, translateSkill, translateCommodity }}>
      {children}
    </I18nContext.Provider>
  );
};

export function useI18n(): I18nContextValue {
  return useContext(I18nContext);
}
