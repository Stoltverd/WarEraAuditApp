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
  "Designed and made by Colombia's Ministry of Economy": 'Diseñado y desarrollado por el Ministerio de Economía de Colombia',
  'Resource Stockpiler (Excess Above 3.5x Growth Buffer)': 'Acumulador de Recursos (Excedente sobre Escudo de Crecimiento 3.5x)',
  'Resource Stockpiler (Tax Only Excess Above 3.5x Growth Buffer)': 'Acumulador de Recursos (Solo Grava Excedente sobre Escudo 3.5x)',
  'Idle Liquid BTC Hoarder (Lump-Sum)': 'Acaparador de BTC Líquido Inactivo (Suma Única)',
  'Tailored in-game telegram for': 'Telegrama personalizado en el juego para',
  'Reset to Auto-Recommended Mode': 'Restablecer al Modo Auto-Recomendado',
  'country median': 'mediana del país',
  'Nudge Profile & Growth-Protected Suggested Donation': 'Perfil de Notificación y Donación Sugerida con Protección de Crecimiento',
  'Which Archetype Should I Choose?': '¿Qué Arquetipo Debo Elegir?',
  '7D Projection & 3.5x Growth Shield Audit': 'Proyección 7D y Auditoría de Escudo de Crecimiento 3.5x',
  '7-Day Recipe Production + 3.5x Speculation & Economic Growth Shield Audit': 'Producción por Receta de 7 Días + Auditoría de Escudo de Especulación y Crecimiento 3.5x',
  '7D Company Net Output': 'Producción Neta de Empresas (7D)',
  '7D Trade (75% Tax Base)': 'Comercio 7D (Base 75%)',
  'Protected Growth Reserve': 'Reserva de Crecimiento Protegida',
  '3.5x Median / 1.5x Input + CapEx Buffer': '3.5x Mediana / 1.5x Insumos + Buffer CapEx',
  'Taxable Excess Hoard': 'Excedente Gravable Acumulado',
  'Item-Specific Recipe Production Valuation (Strict Live Market Prices):': 'Valoración de Producción por Receta (Precios Reales de Mercado):',
  'Quick Presets:': 'Ajustes Rápidos:',
  'RECOMMENDED': 'RECOMENDADO',
  '📈 Extreme Speculative Hoard (>3.5x Growth Buffer)': '📈 Acaparamiento Especulativo Extremo (>3.5x Escudo de Crecimiento)',
  '🏗️ Verified Company Construction CapEx (45% Grace Applied)': '🏗️ CapEx de Construcción de Empresas Verificado (45% de Gracia Aplicado)',
  '🌱 Healthy Growth Speculation Shielded (≤3.5x Buffer)': '🌱 Especulación de Crecimiento Saludable Protegida (≤3.5x Escudo)',
  '✅ Solvent — "Update Made Me Broke" Disarmed': '✅ Solvente — Capacidad de Contribución Verificada',
  'Solvent / Full Contribution Capacity': 'Solvente / Capacidad Plena de Contribución',
  'Taxes recurring 7-day earning power (recipe-valued company item output at live market prices + 75% of net trading margin + wages, leaving 25% trade margin for compounding).':
    'Grava el poder de ganancia recurrente de 7 días (producción de empresas valorada por receta a precios de mercado + 75% del margen neto de comercio + salarios, dejando 25% del margen para reinversión).',
  'Targets uninvested cash sitting idle in the citizen’s wallet above the national median. Different from Stockpiler because it only looks at liquid BTC, not warehouse items.':
    'Apunta al efectivo no invertido que permanece inactivo en la billetera del ciudadano por encima de la mediana nacional. Se diferencia del Acumulador porque solo evalúa BTC líquido, no inventario.',
  'Protects a 3.5x Growth & Speculation Buffer so citizens can trade and grow their economy; only taxes extreme hoards above that buffer (like 35x stockpilers).':
    'Protege un Escudo de Crecimiento y Especulación de 3.5x para que el ciudadano comercie y expanda su economía; solo grava acumulaciones extremas por encima de ese escudo.',
  'Custom Merit-Based Patriot Commendation Archetype': 'Arquetipo de Condecoración Patriótica por Mérito',
  'Active Historical Pillar': 'Pilar Histórico Activo',
  'Active Historical Pillar (Still Giving)': 'Pilar Histórico Activo (Sigue Aportando)',
  'Historical National Pillar': 'Pilar Histórico Nacional',
  'All-time foundation pillar who keeps giving (BTC or Damage)': 'Pilar histórico fundamental que sigue aportando (BTC o Daño)',
  'Honors top lifetime donors who refuse to rest on their historical laurels and continue serving the country in the current period through fresh BTC tithes, frontline combat damage, or both.':
    'Honra a los mayores donantes históricos que continúan sirviendo al país en el período actual mediante nuevas donaciones en BTC, daño en el frente de batalla, o ambos.',
  'Sovereign Treasury Patriot': 'Patriota del Tesoro Soberano',
  'Exemplary period BTC donor funding the state': 'Donante ejemplar de BTC del período que financia al Estado',
  'Commends economic and hybrid citizens who meet or exceed their playstyle’s Patriot treasury quota through consistent direct BTC donations.':
    'Felicita a los ciudadanos económicos e híbridos que cumplen o superan la cuota Patriota de su estilo de juego mediante donaciones directas de BTC.',
  'Battlefield Frontline Hero': 'Héroe de Primera Línea en Batalla',
  'Heavy combat damage dealer & munitions spender': 'Gran infligidor de daño en combate y consumidor de munición',
  'Salutes frontline warriors and illiquid combatants who pour their wealth into weapons, ammunition, and combat consumables to defend the nation’s borders.':
    'Saluda a los guerreros de primera línea y combatientes ilíquidos que invierten su patrimonio en armas, municiones y consumibles para defender las fronteras de la nación.',
  'Dual-Crown Vanguard': 'Vanguardia de Doble Corona',
  'Dual-Crown Vanguard (Treasury + Battlefield)': 'Vanguardia de Doble Corona (Tesoro + Campo de Batalla)',
  'Elite contributor in both Treasury BTC & Combat Damage': 'Contribuyente de élite tanto en BTC al Tesoro como en Daño de Combate',
  'Celebrates rare all-around citizens who simultaneously finance the national treasury with BTC donations and deal heavy damage on the battlefield.':
    'Celebra a los ciudadanos integrales de élite que financian simultáneamente el tesoro nacional con BTC e infligen un alto daño en el campo de batalla.',
  'Over-Donation Burnout & Economic Self-Harm Protection': 'Protección contra Desgaste por Sobredonación y Daño Económico Propio',
  'Company & Economic Growth Strain': 'Tensión en Empresas y Crecimiento Económico',
  'Company CapEx & Economic Growth Strain Warning': 'Aviso de Tensión en CapEx de Empresas y Crecimiento Económico',
  'Protect capital for factory upgrades & market growth': 'Proteger capital para mejoras de fábricas y crecimiento comercial',
  'Advises citizens who are donating >35% of their weekly earning power (or draining low cash reserves) to pause tithes and reinvest in their own factories and trading capital so they do not fall behind.':
    'Aconseja a los ciudadanos que donan >35% de su capacidad semanal (o drenan bajas reservas de efectivo) pausar sus aportes y reinvertir en sus propias fábricas y capital comercial.',
  'Frontline Munitions & Gear Strain': 'Tensión en Municiones y Equipo de Combate',
  'Frontline Munitions & Gear Strain Warning': 'Aviso de Tensión en Municiones y Equipo de Frente',
  'Retain BTC for ammunition, armor & combat buffs': 'Retener BTC para munición, armadura y consumibles de combate',
  'Advises active warriors who are over-donating BTC at the expense of their personal war chest to keep their liquid BTC for ammunition, weapon durability, and frontline consumables.':
    'Aconseja a los guerreros activos que están sobredonando BTC a expensas de su reserva militar personal que conserven su BTC líquido para munición, armamento y consumibles.',
  'Copy Telegram': 'Copiar Telegrama',
  'Copied!': '¡Copiado!',
  'Suggested:': 'Sugerido:',
  'Conservative 10% liquidation above 3.5x growth buffer': 'Liquidación conservadora del 10% sobre el escudo de crecimiento 3.5x',
  'Balanced 12.5% liquidation above 3.5x growth buffer': 'Liquidación equilibrada del 12.5% sobre el escudo de crecimiento 3.5x',
  'Upper 15% excess stockpile sale': 'Venta superior del 15% del excedente de reserva',
  'Wartime emergency stockpile liquidation': 'Liquidación de emergencia de reservas en tiempo de guerra',
  'Light 10% excess cash contribution': 'Aporte ligero del 10% del efectivo excedente',
  'Recommended 15% excess liquid cash': 'Aporte recomendado del 15% del efectivo líquido excedente',
  'Strong 25% excess cash mobilization': 'Movilización fuerte del 25% del efectivo excedente',
  'Major sovereign reserve injection': 'Inyección mayor a la reserva soberana',
  'Match national median donor contribution': 'Igualar el aporte mediano nacional de donantes',
  'Above-quota leadership contribution': 'Aporte de liderazgo superior a la cuota',
  // API Token Modal, App.tsx API Banners & Diagnostics Inspector
  'War Era API Token': 'Token API de War Era',
  'Directly powers state warehouses & citizen audits': 'Impulsa directamente los almacenes estatales y las auditorías ciudadanas',
  'Your Private API Token': 'Tu Token API Privado',
  'Test Token': 'Probar Token',
  'Testing...': 'Probando...',
  'Paste your War Era API token here...': 'Pega tu token API de War Era aquí...',
  'Please paste your token first before testing.': 'Por favor pega tu token primero antes de probarlo.',
  'API Token successfully saved! Updating queries...': '¡Token API guardado con éxito! Actualizando consultas...',
  'Where do I find my API key?': '¿Dónde encuentro mi clave API?',
  'Clear Token': 'Borrar Token',
  'Save & Connect': 'Guardar y Conectar',
  'Unlock True Daily (24h) & Weekly (7d) Transaction Logs': 'Desbloquea Registros Reales de Transacciones Diarias (24h) y Semanales (7d)',
  'Currently viewing public all-time cumulative sums. To view exact individual donation receipts (e.g. 10 BTC) and accurate daily totals, connect your War Era API Token.':
    'Actualmente viendo sumas acumuladas históricas públicas. Para ver recibos individuales exactos de donación (ej. 10 BTC) y totales diarios precisos, conecta tu Token API de War Era.',
  'Offline Mode:': 'Modo Sin Conexión:',
  'Viewing cached donation records from local storage.': 'Viendo registros de donaciones en caché desde el almacenamiento local.',
  'Cached locally': 'En caché local',
  'War Era API Diagnostics Inspector': 'Inspector de Diagnóstico API de War Era',
  'Real-time outbound header tracking, tRPC procedure auditor, and token health':
    'Seguimiento de encabezados salientes en tiempo real, auditor de procedimientos tRPC y estado del token',
  'Active Token:': 'Token Activo:',
  'None configured': 'Ninguno configurado',
  'Transmitted via X-API-Key and Authorization: Bearer on every outbound query.':
    'Transmitido mediante X-API-Key y Authorization: Bearer en cada consulta saliente.',
  'No token set. Endpoints requiring player authentication will be rejected upstream.':
    'Sin token configurado. Los endpoints que requieren autenticación de jugador serán rechazados.',
  'Testing API...': 'Probando API...',
  'Test Connection': 'Probar Conexión',
  'Edit Key': 'Editar Clave',
  'Live API Outbound Request Log': 'Registro de Solicitudes Salientes API en Vivo',
  'Clear Log': 'Limpiar Registro',
  'No outbound API requests recorded in this session': 'No se registraron solicitudes API salientes en esta sesión',
  'Make an audit query or click "Test Connection" above to capture live network traces.':
    'Realiza una consulta de auditoría o haz clic en "Probar Conexión" arriba para capturar trazas de red en vivo.',
  'Key Attached': 'Clave Adjunta',
  'No Key': 'Sin Clave',
  'Target Request URL:': 'URL de Solicitud Destino:',
  'Headers Sent:': 'Encabezados Enviados:',
  'Diagnostic State:': 'Estado de Diagnóstico:',
  'Documentation:': 'Documentación:',
  'Close Inspector': 'Cerrar Inspector',
  'War Era API rate limit reached (HTTP 429). Please wait a few seconds and try again.':
    'Límite de tasa de la API de War Era alcanzado (HTTP 429). Espera unos segundos e inténtalo de nuevo.',
  "It's watching you.": 'Te vigila.',
  'Dormant Pillar (Honor + Reactivation)': 'Pilar Inactivo (Honor + Reactivación)',
  'Salute lifetime Pillar record & gently invite period return':
    'Honra su récord histórico de Pilar e invita cordialmente a reactivar su aporte',
  'Designed for Historical Pillars with 0 or below-quota period donations: celebrates their all-time treasury foundation first while warmly inviting a voluntary period contribution.':
    'Diseñado para Pilares Históricos con 0 o baja donación en el período: celebra primero su legado histórico en la tesorería mientras invita cordialmente a un aporte voluntario.',
  'Dormant Historical Pillar — Honor & Gentle Reactivation (English)':
    'Pilar Histórico Inactivo — Honor y Reactivación Cordial (Inglés)',
  'Pilar Histórico Inactivo — Honor y Reactivación Cordial (Español)':
    'Pilar Histórico Inactivo — Honor y Reactivación Cordial (Español)',
  'Historical Pillar — Stockpile Contribution Invitation (English)':
    'Pilar Histórico — Invitación de Aporte de Stock (Inglés)',
  'Historical Pillar — Liquidity Reactivation Invitation (English)':
    'Pilar Histórico — Invitación de Aporte de Liquidez (Inglés)',
  'Historical Pillar — Period Quota Step-Up Invitation (English)':
    'Pilar Histórico — Invitación de Cuota del Período (Inglés)',
  'Switch to Secondary (Treasury Nudge)': 'Cambiar a Secundaria (Solicitud del Tesoro)',
  'Switch to Primary (Patriot Commendation)': 'Cambiar a Principal (Condecoración)',
  '★ Primary Rec.': '★ Rec. Principal',
  '⚡ Secondary Rec.': '⚡ Rec. Secundaria',
  'Dormant (0 BTC)': 'Inactivo (0 BTC)',
  'Dormant Period': 'Período Inactivo',
  'Explain Fiscal Standing & Classification': 'Explicar Estado Fiscal y Clasificación',
  'What This Standing Means': 'Qué Significa Este Estado Fiscal',
  'Why Classified This Way (vs. Country Medians)': 'Por Qué Tiene Esta Clasificación (vs. Medianas del País)',
  'Open Full Audit': 'Abrir Auditoría Completa',
  'Diplomatic Nudge': 'Notificación Diplomática',
  'Explain Tags': 'Explicar Etiquetas',
  'Hide Tag Guide': 'Ocultar Guía',
  'Forensic Audit Tag & Classification Guide — How Tags & Medians Work':
    'Guía de Etiquetas y Clasificación Forense — Cómo Funcionan las Etiquetas y Medianas',
  '1. Master Fiscal Standing Badge': '1. Insignia de Estado Fiscal Principal',
  '2. Dormant Pillar Tag (🏛️ + ⚠️)': '2. Etiqueta de Pilar Inactivo (🏛️ + ⚠️)',
  '3. Special Context & Median Shield': '3. Contexto Especial y Escudo por Mediana',
  '4. Build Mode & Policy Quotas': '4. Modo de Build y Cuotas de Política',
  'Synced 100% with the Overview table and Diplomatic Nudge modal. Evaluates period donation ratio against playstyle quotas (Patriot / Moderate / Low) and national wealth/lifetime medians.':
    'Sincronizado al 100% con la tabla general y la notificación diplomática. Evalúa la tasa de donación del período frente a las cuotas por estilo de juego (Patriota / Moderado / Bajo) y las medianas nacionales.',
  'Top-10 lifetime donors who meet the Policy Grace Floor retain their revered Historical Pillar honor even when period donations are 0 or below quota. The amber warning indicates a Dual Recommendation (Honor + Gentle Reactivation).':
    'Los Top-10 donantes históricos que alcanzan el Piso de Gracia conservan su honor de Pilar Histórico incluso con 0 o baja donación en el período. El aviso ámbar indica Doble Recomendación (Honor + Reactivación Cordial).',
  'Protects proven citizens from unfair Critical Leech labels using live country medians: Above-Median Veteran Donors on pause, War Veterans temporarily farming in Eco mode for weapons, and citizens who dismantled companies for war/treasury support.':
    'Protege a ciudadanos probados contra etiquetas injustas de Leech Crítico usando medianas reales del país: Donantes Veteranos sobre la mediana en pausa, Veteranos de Guerra farmeando en Eco para armas, y quienes desmantelaron empresas por la patria.',
  'Pure-War combatants have lower cash quotas and earn combat damage credits; Pure-Eco industrialists have higher cash quotas due to passive factory margins; CapEx company builders receive a 45% grace discount.':
    'Los combatientes Pure-War tienen cuotas de efectivo menores y ganan crédito por daño; los industriales Pure-Eco tienen cuotas mayores por sus márgenes pasivos; constructores CapEx reciben 45% de descuento.',
  'Top-10 all-time national treasury builder who meets the Policy Grace Floor. Honored permanently as a foundational pillar; if period donations are 0 or below quota, a Dormant Period notice and Dual Recommendation are shown.':
    'Constructor histórico Top-10 del tesoro nacional que cumple el Piso de Gracia. Honrado como pilar fundamental; si su donación del período es 0 o baja, se muestra aviso de Período Inactivo y Doble Recomendación.',
  'Exemplary citizen whose period donations (or combined combat + treasury output) meet or exceed the patriotic quota for their playstyle.':
    'Ciudadano ejemplar cuyas donaciones del período (o aporte combinado de combate + tesoro) cumplen o superan la cuota patriótica de su estilo de juego.',
  'Active frontline fighter whose battlefield damage expenditure (ammo, weapons, durability) defends the nation and satisfies their sovereign contribution.':
    'Combatiente activo de primera línea cuyo gasto de daño en batalla (munición, armas, durabilidad) defiende la nación y cumple su contribución soberana.',
  'Consistent citizen meeting the fair/moderate contribution quota for their playstyle, or an above-median historical veteran donor currently on a temporary period pause.':
    'Ciudadano constante que cumple la cuota justa/moderada de su estilo de juego, o donante veterano por encima de la mediana nacional actualmente en pausa temporal.',
  'Working-class or modest-wealth citizen below the period quota, or a protected special case (e.g. War Veteran temporarily farming in Eco mode to buy gear, or citizen rebuilding after dismantling companies).':
    'Ciudadano de patrimonio modesto por debajo de la cuota del período, o caso especial protegido (ej. Veterano de Guerra farmeando temporalmente en modo Eco para comprar equipo, o reconstruyendo tras sacrificar empresas).',
  'Upper-wealth citizen (above the national wealth percentile floor) with 0 or negligible period donations, no qualifying battlefield damage, and no veteran/sacrifice protection.':
    'Ciudadano de alto patrimonio (sobre el percentil de riqueza nacional) con 0 o mínima donación en el período, sin daño de combate calificable ni protección de veterano o sacrificio.',
  'Supreme Sacrifice & Rebuild Salute': 'Saludo al Sacrificio Supremo y Reconstrucción',
  'Dismantled/burned companies for war or treasury — boost morale':
    'Desmanteló/quemó empresas por la guerra o el tesoro — elevar moral',
  'Honors selfless patriots who liquidated or dismantled their own companies to fund war campaigns or emergency state donations. Sends a high-morale tribute with zero tax pressure while they rebuild.':
    'Honra a los patriotas abnegados que liquidaron o desmantelaron sus propias empresas para financiar campañas de guerra o donaciones de emergencia. Envía un tributo de alta moral sin presión fiscal mientras reconstruyen.',
  'Verified Veteran Donor — Milestone & Reactivation Check-In (English)':
    'Donante Veterano Verificado — Saludo y Consulta de Meta/Reactivación (Inglés)',
  'Donante Veterano Verificado — Saludo y Consulta de Meta/Reactivación (Español)':
    'Donante Veterano Verificado — Saludo y Consulta de Meta/Reactivación (Español)',
  'War Veteran in Eco Mode — Gear & Re-Armament Check-In (English)':
    'Veterano de Guerra en Modo Eco — Consulta de Equipamiento y Rearme (Inglés)',
  'Veterano de Guerra en Modo Eco — Consulta de Equipamiento y Rearme (Español)':
    'Veterano de Guerra en Modo Eco — Consulta de Equipamiento y Rearme (Español)',
  'Supreme Industrial & War Sacrifice — Morale & Rebuild Salute (English)':
    'Sacrificio Supremo Industrial y de Guerra — Tributo de Moral y Reconstrucción (Inglés)',
  'Sacrificio Supremo Industrial y de Guerra — Tributo de Moral y Reconstrucción (Español)':
    'Sacrificio Supremo Industrial y de Guerra — Tributo de Moral y Reconstrucción (Español)',
  'Scope Notice: This leaderboard & its Audit receipts show confirmed donations to this country strictly within the selected time window. Click "Audit" on any citizen to view both their Period Receipts and their All-Time Lifetime Country Total.':
    'Aviso de Alcance: Esta tabla y sus recibos de Auditoría muestran las donaciones confirmadas a este país estrictamente dentro de la ventana de tiempo seleccionada. Haz clic en "Auditoría" en cualquier ciudadano para ver tanto sus Recibos del Período como su Total Histórico del País.',
  'Audit Scope — All-Time Country Ledger:': 'Alcance de Auditoría — Libro Histórico del País:',
  'All-Time Country Total': 'Total Histórico del País',
  'Permanent Build-Tenure History (Non-Deletable)': 'Historial Permanente de Build (No Eliminable)',
  'Acknowledge': 'Reconocer',
  'Management (0.27.3)': 'Gestión (0.27.3)',
  'Fused w/ Leadership': 'Fusionada c/ Leadership',
  'Hotfix 0.27.3 & Piraterers Standard': 'Estándar Hotfix 0.27.3 y Piraterers',
  'Hotfix 0.27.3 Standard': 'Estándar Hotfix 0.27.3',
  '🌟 Lvl 26–50 Eco Meta': '🌟 Meta Eco Nvl 26–50',
  'Mgmt + Energy + High Prod': 'Gestión + Energía + Alta Prod',
  '🛠️ Lvl 26–50 Self-Work': '🛠️ Autotrabajo Nvl 26–50',
  'Max Prod + Energy (Low Mgmt)': 'Máx Prod + Energía (Baja Gestión)',
  'Missing Management / Energy': 'Falta Gestión / Energía',
  'v0.27.3 Player Skill Builds & Level 50 + Prestige Math': 'Builds de Habilidades v0.27.3 y Matemática Nivel 50 + Prestigio',
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
  [/^([A-Za-zÀ-ÿ\s-]+) Ministry of Economy$/i, 'Ministerio de Economía de $1'],
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
  [/^·\s*Active for (\d+)d \(Cooldown cleared\)$/i, '· Activa por $1d (Enfriamiento finalizado)'],
  [/^Active for (\d+)d \(Cooldown cleared\)$/i, 'Activa por $1d (Enfriamiento finalizado)'],
  [/^Active for (.+)$/i, 'Activa por $1'],
  [/^🌾 Eco Build\s*·\s*Active for (\d+)d \(Cooldown cleared\)$/i, '🌾 Build Eco · Activa por $1d (Enfriamiento finalizado)'],
  [/^⚔️ War Build\s*·\s*Active for (\d+)d \(Cooldown cleared\)$/i, '⚔️ Build Militar · Activa por $1d (Enfriamiento finalizado)'],
  [/^⚖️ Hybrid Build\s*·\s*Active for (\d+)d \(Cooldown cleared\)$/i, '⚖️ Build Híbrida · Activa por $1d (Enfriamiento finalizado)'],
  [/^(🌾 Eco|⚔️ War|⚖️ Hybrid) Build\s*·\s*Active for (\d+)d \(Cooldown cleared\)$/i, '$1 Build · Activa por $2d (Enfriamiento finalizado)'],
  [/^(🌾 Eco|⚔️ War|⚖️ Hybrid) Build\s*·\s*Active for ≤ 7d \(Recent Switch\)$/i, '$1 Build · Activa por ≤ 7d (Cambio Reciente)'],
  [/^(🌾 Eco|⚔️ War|⚖️ Hybrid) Build\s*·\s*Reset date unverified$/i, '$1 Build · Fecha de respec no verificada'],
  [/^(🌾 Eco|⚔️ War|⚖️ Hybrid) Build\s*·\s*Recently switched \((.+?) ago\)$/i, '$1 Build · Cambiada recientemente (hace $2)'],
  [/^Detected via v0\.27\.3 skill points \((\d+) Eco SP \/ (\d+) War SP,\s*(.+)\)\. Sets the standard quota at (\d+)% and Model Patriot quota at (\d+)% of (\d+)D gross inflow\.$/i,
    'Detectado por puntos de habilidad v0.27.3 ($1 Eco SP / $2 War SP, $3). Fija la cuota estándar en $4% y la cuota Patriota Modelo en $5% del flujo bruto de $6D.'],
  [/^v0\.27\.3 Skill Build — (.+)$/i, 'Build de Habilidades v0.27.3 — $1'],
  [/^\+(\d+)%\s+Output\s*&\s*Training$/i, '+$1% Prod. y Entrenamiento'],
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
  // Diplomatic Treasury Nudge Modal & Watchlist Modal dynamic strings
  [/^\(Level (\d+) • pure eco\)$/i, '(Nivel $1 • pure eco)'],
  [/^\(Level (\d+) • pure war\)$/i, '(Nivel $1 • pure war)'],
  [/^\(Level (\d+) • hybrid\)$/i, '(Nivel $1 • hybrid)'],
  [/^\(Level (\d+) • (.+)\)$/i, '(Nivel $1 • $2)'],
  [/^★ Recommended Action:\s*Treasury Nudge — Resource Stockpiler \(Tax Only Excess Above 3\.5x Growth Buffer\)(.*)$/i,
    '★ Acción Recomendada: Solicitud del Tesoro — Acumulador de Recursos (Solo Grava Excedente sobre Escudo 3.5x)$1'],
  [/^★ Recommended Action:\s*Treasury Nudge — Idle Liquid BTC Hoarder \(Lump-Sum\)(.*)$/i,
    '★ Acción Recomendada: Solicitud del Tesoro — Acaparador de BTC Líquido Inactivo (Suma Única)$1'],
  [/^★ Recommended Action:\s*Treasury Nudge — Weekly Cashflow Step-Up(.*)$/i,
    '★ Acción Recomendada: Solicitud del Tesoro — Incremento sobre Flujo Semanal$1'],
  [/^★ Recommended Action:\s*Patriot Commendation — (.+)$/i, '★ Acción Recomendada: Condecoración Patriótica — $1'],
  [/^★ Recommended Action:\s*Over-Donation Burnout Warning — (.+)$/i, '★ Acción Recomendada: Aviso de Sobredonación — $1'],
  [/^★ Recommended Action:\s*(.+)$/i, '★ Acción Recomendada: $1'],
  [/^([\d,.]+) BTC Target$/i, 'Meta: $1 BTC'],
  [/^([\d,.]+)% of 7D Output$/i, '$1% de Producción 7D'],
  [/^★ Recommended for (.+):\s*Resource Stockpiler \(Tax Only Excess Above 3\.5x Growth Buffer\)$/i,
    '★ Recomendado para $1: Acumulador de Recursos (Solo Grava Excedente sobre Escudo 3.5x)'],
  [/^★ Recommended for (.+):\s*Idle Liquid BTC Hoarder \(Lump-Sum\)$/i,
    '★ Recomendado para $1: Acaparador de BTC Líquido Inactivo (Suma Única)'],
  [/^★ Recommended for (.+):\s*Weekly Cashflow Step-Up$/i,
    '★ Recomendado para $1: Incremento sobre Flujo Semanal'],
  [/^★ Recommended for (.+)$/i, '★ Recomendado para $1'],
  [/^★ Recommended Merit for (.+)$/i, '★ Mérito Recomendado para $1'],
  [/^★ Recommended Advisory for (.+)$/i, '★ Aviso Recomendado para $1'],
  [/^Why the 3 Donation Archetypes Differ & Recommendation for (.+)$/i,
    'Por qué Difieren los 3 Arquetipos de Donación y Recomendación para $1'],
  [/^([\d,.]+)x country median$/i, '$1x mediana del país'],
  [/^median \(Buffer:\s*([\d,.]+) BTC\)$/i, 'mediana (Escudo: $1 BTC)'],
  [/^([\d,.]+)x median \(Shield:\s*([\d,.]+)\)$/i, '$1x mediana (Escudo: $2)'],
  [/^Lifetime:\s*([\d,.]+) BTC$/i, 'Histórico: $1 BTC'],
  [/^Gross:\s*([\d,.]+) \| Inputs:\s*-([\d,.]+)$/i, 'Bruto: $1 | Insumos: -$2'],
  [/^25% Reinvest Shield:\s*([\d,.]+) BTC$/i, 'Escudo Reinversión 25%: $1 BTC'],
  [/^Stock above ([\d,.]+) BTC shield$/i, 'Reserva sobre escudo de $1 BTC'],
  [/^10% Taxable Excess:\s*([\d,.]+) BTC$/i, '10% Excedente Gravable: $1 BTC'],
  [/^12\.5% Target \(Rec\.\):\s*([\d,.]+) BTC$/i, '12.5% Meta (Rec.): $1 BTC'],
  [/^15% Taxable Excess:\s*([\d,.]+) BTC$/i, '15% Excedente Gravable: $1 BTC'],
  [/^20% Mobilization:\s*([\d,.]+) BTC$/i, '20% Movilización: $1 BTC'],
  [/^10% Idle Excess:\s*([\d,.]+) BTC$/i, '10% Efectivo Excedente: $1 BTC'],
  [/^15% Lump-Sum \(Rec\.\):\s*([\d,.]+) BTC$/i, '15% Suma Única (Rec.): $1 BTC'],
  [/^25% Treasury Boost:\s*([\d,.]+) BTC$/i, '25% Impulso al Tesoro: $1 BTC'],
  [/^35% War Chest:\s*([\d,.]+) BTC$/i, '35% Fondo de Guerra: $1 BTC'],
  [/^Moderate \(([\d.]+)%\):\s*([\d,.]+) BTC$/i, 'Moderado ($1%): $2 BTC'],
  [/^Patriot \(([\d.]+)% Rec\.\):\s*([\d,.]+) BTC$/i, 'Patriota ($1% Rec.): $2 BTC'],
  [/^Country Median:\s*([\d,.]+) BTC$/i, 'Mediana Nacional: $1 BTC'],
  [/^1\.5x Patriot Boost:\s*([\d,.]+) BTC$/i, '1.5x Impulso Patriota: $1 BTC'],
  [/^✓ (\d+) \/ 492 chars \(excl\. name\)$/i, '✓ $1 / 492 caract. (sin nombre)'],
  [/^(.+) holds ([\d,.]+) BTC in commodities \(([\d,.]+)x country median\)\. Even after shielding ([\d,.]+) BTC \(3\.5x Growth & Speculation Reserve so they can expand their economy and buy war gear\), they still hold ([\d,.]+) BTC in extreme excess stockpile\. Selling 12\.5% of that excess yields ([\d,.]+) BTC without hurting their growth\.$/i,
    '$1 posee $2 BTC en materias primas ($3x la mediana del país). Incluso después de proteger $4 BTC (Reserva de Crecimiento y Especulación 3.5x para expandir su economía y comprar equipo militar), aún mantiene $5 BTC en reserva excedente extrema. Vender el 12.5% de ese excedente genera $6 BTC sin afectar su crecimiento.'],
  [/^Holds ([\d,.]+) BTC in commodities \(([\d,.]+)x country median\)\. After shielding ([\d,.]+) BTC \(3\.5x Growth & Speculation Reserve\), selling 10%–15% of their ([\d,.]+) BTC extreme excess stockpile yields ~([\d,.]+)–([\d,.]+) BTC without hurting factory operations or economic growth\.$/i,
    'Posee $1 BTC en materias primas ($2x la mediana del país). Tras proteger $3 BTC (Reserva de Crecimiento y Especulación 3.5x), vender entre 10% y 15% de su reserva excedente extrema de $4 BTC genera ~$5–$6 BTC sin perjudicar la operación de sus fábricas ni su crecimiento económico.'],
  [/^Holds ([\d,.]+) BTC in commodities, which is within the ([\d,.]+) BTC \(3\.5x\) Protected Growth Reserve\. If requesting a voluntary stockpile liquidation, ([\d,.]+) BTC is a light 12\.5% target\.$/i,
    'Posee $1 BTC en materias primas, dentro de la Reserva de Crecimiento Protegida de $2 BTC (3.5x). Si se solicita una liquidación voluntaria de inventario, $3 BTC es una meta ligera del 12.5%.'],
  [/^(.+) is sitting on ([\d,.]+) BTC in uninvested liquid cash \(([\d,.]+)x country median of ([\d,.]+) BTC\)\. A one-time 15% lump-sum from their excess cash \(([\d,.]+) BTC\) mobilizes idle currency immediately while leaving ([\d,.]+) BTC in their wallet\.$/i,
    '$1 mantiene $2 BTC en efectivo líquido sin invertir ($3x la mediana nacional de $4 BTC). Un aporte único del 15% sobre su efectivo excedente ($5 BTC) moviliza liquidez inactiva de inmediato dejando $6 BTC en su billetera.'],
  [/^Holds ([\d,.]+) BTC in idle liquid cash \(([\d,.]+)x country median of ([\d,.]+) BTC\)\. A lump-sum contribution of 15% of excess idle cash \(([\d,.]+) BTC\) leaves ample working liquidity\.$/i,
    'Posee $1 BTC en efectivo líquido inactivo ($2x la mediana nacional de $3 BTC). Un aporte único del 15% del efectivo inactivo excedente ($4 BTC) deja amplia liquidez operativa.'],
  [/^(.+)'s ([\d,.]+) BTC commodity inventory is shielded inside the ([\d,.]+) BTC \(3\.5x\) Growth & Speculation Buffer so they can grow their economy\. We therefore recommend a modest Weekly Cashflow Step-Up \(([\d,.]+) BTC\) based on their 7-day earning power\.$/i,
    'El inventario de materias primas de $1 ($2 BTC) está protegido dentro del Escudo de Crecimiento y Especulación de $3 BTC (3.5x) para que pueda expandir su economía. Por tanto, recomendamos un Incremento sobre Flujo Semanal ($4 BTC) basado en su capacidad de ganancia de 7 días.'],
  [/^(.+)'s strongest capacity comes from active 7-day production & trading cashflow \(([\d,.]+) BTC\/wk projected, with 25% of trade profit shielded for compounding\)\. Requesting ([\d,.]+) BTC aligns them with the ([\d.]+)% (.+) quota(.*)$/i,
    'La mayor capacidad de $1 proviene de su flujo activo de producción y comercio de 7 días ($2 BTC/sem proyectados, con 25% de ganancia comercial protegida para reinversión). Solicitar $3 BTC lo alinea con la cuota $5 del $4%$6'],
  [/^Growth-Adjusted 7D Earning Power is ([\d,.]+) BTC \(([\d,.]+) BTC company recipe output \+ ([\d,.]+) BTC taxable trade margin \[25% shielded for growth\] \+ ([\d,.]+) BTC wages\), with ([\d,.]+) BTC donated\. Stepping up by \+([\d,.]+) BTC aligns them with the ([\d.]+)% (.+) quota(.*)$/i,
    'El Poder de Ganancia 7D Ajustado al Crecimiento es de $1 BTC ($2 BTC producción de empresas + $3 BTC margen comercial gravable [25% protegido] + $4 BTC salarios), con $5 BTC donados. Incrementar +$6 BTC lo alinea con la cuota $8 del $7%$9'],
  [/^Citizen bought ([\d,.]+) BTC and sold ([\d,.]+) BTC of Iron\/Steel while holding ([\d,.]+) BTC in commodities\. We protect their first ([\d,.]+) BTC \(3\.5x Growth & Speculation Shield\) so they can compound their economy, and only tax the ([\d,.]+) BTC excess hoard above the buffer\.$/i,
    'El ciudadano compró $1 BTC y vendió $2 BTC de Hierro/Acero mientras mantiene $3 BTC en materias primas. Protegemos sus primeros $4 BTC (Escudo de Crecimiento y Especulación 3.5x) y solo gravamos el excedente de $5 BTC por encima del escudo.'],
  [/^Citizen holds ([\d,.]+) BTC in commodities \(([\d,.]+)x country median\)\. While we protect a ([\d,.]+) BTC \(3\.5x\) Growth & Speculation Reserve for economic expansion and war gear, the remaining ([\d,.]+) BTC is extreme idle hoarding\.$/i,
    'El ciudadano posee $1 BTC en materias primas ($2x la mediana nacional). Aunque protegemos una Reserva de Crecimiento y Especulación de $3 BTC (3.5x) para expansión económica y equipo militar, los $4 BTC restantes constituyen acumulación inactiva extrema.'],
  [/^Verified CapEx Reinvestment: Citizen holds low liquid cash \(([\d,.]+) BTC\), has open\/upgrading company capacity \((\d+)\/(\d+) slots, ([\d,.]+) BTC company equity\), and spent ([\d,.]+) BTC on construction materials \(including ([\d,.]+) BTC Concrete\/Limestone and ([\d,.]+) BTC Iron\/Steel\) with 0 BTC resold\. Suggested cashflow quota is discounted by 45%\.$/i,
    'Reinversión CapEx Verificada: El ciudadano tiene bajo efectivo líquido ($1 BTC), capacidad de empresas en expansión ($2/$3 espacios, $4 BTC en capital de empresas) y gastó $5 BTC en materiales de construcción (incluyendo $6 BTC en Concreto/Caliza y $7 BTC en Hierro/Acero) con 0 BTC revendidos. La cuota sugerida tiene un descuento del 45%.'],
  [/^Citizen holds ([\d,.]+) BTC in commodities, which is within their ([\d,.]+) BTC \(3\.5x\) Protected Growth & Speculation Buffer\. Moderate market speculation and inventory building are 100% shielded from stockpile liquidation taxes so the citizen can grow their economy and buy better war equipment\.$/i,
    'El ciudadano posee $1 BTC en materias primas, dentro de su Escudo de Crecimiento y Especulación Protegido de $2 BTC (3.5x). La especulación moderada y el inventario están 100% protegidos para que pueda hacer crecer su economía y adquirir mejor equipamiento militar.'],
  [/^7-Day Projected Earning Power is ([\d,.]+) BTC\/wk \(([\d,.]+) BTC company output at live item prices \+ ([\d,.]+) BTC net trade margin \+ ([\d,.]+) BTC wages\), backed by ([\d,.]+) BTC liquid cash, ([\d,.]+) BTC commodities, and ([\d,.]+) BTC gear\/weapons\.$/i,
    'El Poder de Ganancia Proyectado a 7 Días es de $1 BTC/sem ($2 BTC producción de empresas a precios actuales + $3 BTC margen neto de comercio + $4 BTC salarios), respaldado por $5 BTC en efectivo líquido, $6 BTC en materias primas y $7 BTC en equipamiento/armas.'],
  [/^([\d.]+)% of ([\d,.]+) BTC Growth-Adjusted 7D Output(.*) − ([\d,.]+) BTC Donated$/i,
    '$1% de $2 BTC Producción 7D Ajustada$3 − $4 BTC Donados'],
  [/^15% × \(([\d,.]+) BTC Liquid − ([\d,.]+) BTC Country Median\)$/i,
    '15% × ($1 BTC Líquido − $2 BTC Mediana Nacional)'],
  [/^12\.5% × \(([\d,.]+) BTC Stock − ([\d,.]+) BTC 3\.5x Growth Shield\)$/i,
    '12.5% × ($1 BTC Reserva − $2 BTC Escudo 3.5x)'],
  [/^Shielded \(Stock ([\d,.]+) BTC ≤ ([\d,.]+) BTC 3\.5x Buffer\)$/i,
    'Protegido (Reserva $1 BTC ≤ $2 BTC Escudo 3.5x)'],
  [/^Select the commendation honor that best matches (.+)'s service record \(Historic Pillars that keep giving, Sovereign Treasury Patriots, Battlefield Heroes, or Dual-Crown Vanguards\):$/i,
    'Selecciona el honor de condecoración que mejor corresponda al historial de servicio de $1 (Pilares Históricos activos, Patriotas del Tesoro, Héroes del Campo de Batalla o Vanguardias de Doble Corona):'],
  [/^(.+) has donated ([\d.]+)% of their 7D earning power\. Sustainable Patriot Ceiling: ([\d,.]+) BTC\/wk\.$/i,
    '$1 ha donado el $2% de su capacidad de ganancia de 7 días. Techo Patriota Sostenible: $3 BTC/sem.'],
  [/^-- Choose citizen from (.+) --$/i, '-- Elegir ciudadano de $1 --'],
  [/^(.+) \(Net Worth: ([\d,.]+) BTC · Donated: ([\d,.]+) BTC\)$/i, '$1 (Patrimonio: $2 BTC · Donado: $3 BTC)'],
  [/^\+([\d,.]+) BTC War Credit$/i, '+$1 BTC Créd. Guerra'],
  [/^([\d,.]+)% \/ ([\d,.]+)% Quota \(([\d,.]+)% Patriot\)$/i, '$1% / $2% Cuota ($3% Patriota)'],
  [/^Successfully authenticated with War Era API! Live transaction stream verified \((\d+) live records received in (\d+)ms\)\.$/i,
    '¡Autenticado con éxito en la API de War Era! Transmisión en vivo verificada ($1 registros recibidos en $2ms).'],
  [/^War Era API returned HTTP 401 Unauthorized\. Key was rejected \("(.+)"\)\.$/i,
    'La API de War Era devolvió HTTP 401 No Autorizado. La clave fue rechazada ("$1").'],
  [/^War Era API returned HTTP (\d+): (.+)$/i,
    'La API de War Era devolvió HTTP $1: $2'],
  [/^Failed to contact api2\.warera\.io: (.+)$/i,
    'Error al contactar api2.warera.io: $1'],
  [/^(\d+) live records$/i, '$1 registros en vivo'],
  [/^(\d+) requests$/i, '$1 solicitudes'],
  [/^Public Endpoint \(getAllCountries\): (.+)$/i, 'Endpoint Público (getAllCountries): $1'],
  [/^Authenticated Endpoint \(inventory\.getInventory\): (.+)$/i, 'Endpoint Autenticado (inventory.getInventory): $1'],
  [/^⚠️ Dormant \(0 BTC\)$/i, '⚠️ Inactivo (0 BTC)'],
  [/^⚠️ Low \(([\d.]+)%\)$/i, '⚠️ Bajo ($1%)'],
  [/^Dormant \(0 BTC\)$/i, 'Inactivo (0 BTC)'],
  [/^Low \(([\d.]+)%\)$/i, 'Bajo ($1%)'],
  [/^⚡ Secondary Recommendation:\s*Treasury Nudge — (.+)$/i, '⚡ Recomendación Secundaria: Solicitud del Tesoro — $1'],
  [/^⚡ Secondary Recommendation:\s*(.+)$/i, '⚡ Recomendación Secundaria: $1'],
  [/^★ Primary Rec\. for (.+)$/i, '★ Rec. Principal para $1'],
  [/^⚡ Secondary Rec\. for (.+)$/i, '⚡ Rec. Secundaria para $1'],
  [/^🏛️⚠️ Historical Pillar • (.+)$/i, '🏛️⚠️ Pilar Histórico • $1'],
  [/^🔥🏭 War\/Treasury Sacrifice • (.+)$/i, '🔥🏭 Sacrificio Guerra/Tesoro • $1'],
  [/^🔥🏭 War\/Treasury Sacrifice$/i, '🔥🏭 Sacrificio Guerra/Tesoro'],
  [/^🎖️⚠️ Veteran \(([\d,.]+) BTC life\) • Hoarding \(([\d,.]+) BTC\)$/i, '🎖️⚠️ Veterano ($1 BTC hist.) • Acumulando ($2 BTC)'],
  [/^🎖️⚠️ Veteran \(([\d,.]+) BTC life\) • 0 BTC in Period$/i, '🎖️⚠️ Veterano ($1 BTC hist.) • 0 BTC en Período'],
  [/^🎖️⚠️ Veteran \(([\d,.]+) BTC life\) • Low \(([\d.]+)%\)$/i, '🎖️⚠️ Veterano ($1 BTC hist.) • Bajo ($2%)'],
  [/^🎖️⚠️ Veteran \(([\d,.]+) BTC life\) • (.+)$/i, '🎖️⚠️ Veterano ($1 BTC hist.) • $2'],
  [/^⚔️🔄 War Vet in Eco • Farming\/Hoarding \(([\d,.]+) BTC\)$/i, '⚔️🔄 Vet. Guerra en Eco • Farmeando/Acumulando ($1 BTC)'],
  [/^⚔️🔄 War Vet in Eco • 0 BTC • Farming Gear$/i, '⚔️🔄 Vet. Guerra en Eco • 0 BTC • Farmeando Equipo'],
  [/^⚔️🔄 War Vet in Eco • Low \(([\d.]+)%\)$/i, '⚔️🔄 Vet. Guerra en Eco • Bajo ($1%)'],
  [/^⚔️🔄 War Vet in Eco • (.+)$/i, '⚔️🔄 Vet. Guerra en Eco • $1'],
  [/^⚔️🔄 War Vet in Eco \((.+)\) • (.+)$/i, '⚔️🔄 Vet. Guerra en Eco ($1) • $2'],
  [/^Hoarding \(([\d,.]+) BTC\)$/i, 'Acumulando ($1 BTC)'],
  [/^Farming\/Hoarding \(([\d,.]+) BTC\)$/i, 'Farmeando/Acumulando ($1 BTC)'],
  [/^0 BTC in Period$/i, '0 BTC en Período'],
  [/^0 BTC • Farming Gear$/i, '0 BTC • Farmeando Equipo'],
  [/^Dual-Index Alert \(Idle Liquid Hoarder\): Holds ([\d,.]+) BTC liquid cash \(([\d,.]+)x country median\) with only ([\d.]+)% flow contribution \(target: ([\d.]+)%\)\.$/i,
    'Alerta de Doble Índice (Acumulador de Liquidez Inactiva): Posee $1 BTC en efectivo líquido ($2x la mediana del país) con solo $3% de contribución sobre flujo (meta: $4%).'],
  [/^Dual-Index Alert \(Resource Stockpiler\): Holds ([\d,.]+) BTC in commodities \(([\d,.]+)x country median\) with only ([\d.]+)% flow contribution \(target: ([\d.]+)%\)\.$/i,
    'Alerta de Doble Índice (Acumulador de Recursos): Posee $1 BTC en materias primas ($2x la mediana del país) con solo $3% de contribución sobre flujo (meta: $4%).'],
  [/^Dual-Index Alert \(Upper-Quartile Evader\): Top wealth bracket \(([\d,.]+) BTC vs country cutoff ([\d,.]+) BTC\) contributing ([\d.]+)% of wealth \(([\d.]+)% vs ([\d.]+)% quota\)\.$/i,
    'Alerta de Doble Índice (Evasor del Cuartil Superior): Tramo superior de riqueza ($1 BTC vs corte nacional de $2 BTC) aportando el $3% de su patrimonio ($4% vs $5% de cuota).'],
  [/^Dual-Index Sovereign Patriot: (.+) \(([\d.]+)% of period cashflow\), meeting or exceeding national (.+) Patriot quota \(([\d.]+)%\)\.$/i,
    'Patriota Soberano de Doble Índice: $1 ($2% del flujo del período), cumpliendo o superando la cuota Patriota nacional de $3 ($4%).'],
  [/^Standard Contributor: (.+) \(([\d.]+)% of period cashflow vs ([\d.]+)% quota target\)\.$/i,
    'Contribuyente Estándar: $1 ($2% del flujo del período vs meta de cuota del $3%).'],
  [/^Subsistence \/ Developing Citizen: Below country median wealth \(([\d,.]+) BTC\) and liquid cash; protected from Critical Leech classification\.$/i,
    'Ciudadano en Desarrollo / Subsistencia: Por debajo de la mediana nacional de riqueza ($1 BTC) y liquidez; protegido de la clasificación Leech Crítico.'],
  [/^Low Weekly Contributor: (.+) \(([\d.]+)% of period cashflow vs ([\d.]+)% quota target\)\.$/i,
    'Bajo Contribuyente Semanal: $1 ($2% del flujo del período vs meta de cuota del $3%).'],
  [/^Low Weekly Contributor: Below target cashflow quota \(([\d.]+)% vs ([\d.]+)% target\), but below country wealth cutoff\.$/i,
    'Bajo Contribuyente Semanal: Por debajo de la cuota de flujo objetivo ($1% vs meta del $2%), pero bajo el corte nacional de riqueza.'],
  [/^Critical Leech: High capacity relative to country peers \(([\d,.]+) BTC\) with ([\d.]+)% period contribution \(target: ([\d.]+)%\)\.$/i,
    'Leech Crítico: Alta capacidad frente a sus pares del país ($1 BTC) con $2% de contribución en el período (meta: $3%).'],
  [/^Sovereign Patriot: (.+) in period, exceeding country median contribution benchmarks\.$/i,
    'Patriota Soberano: $1 en el período, superando las referencias medianas de contribución del país.'],
  [/^Active Upper-Bracket Contributor: (.+) in period\.$/i,
    'Contribuyente Activo del Tramo Superior: $1 en el período.'],
  [/^Idle Liquid Hoarder: Holds ([\d,.]+) BTC unused liquid cash \(([\d,.]+)x country median\) with (.+)\.$/i,
    'Acumulador de Liquidez Inactiva: Posee $1 BTC de efectivo líquido sin usar ($2x la mediana del país) con $3.'],
  [/^Resource Stockpiler: Holds ([\d,.]+) BTC in commodity stockpiles \(([\d,.]+)x country median\) with (.+)\.$/i,
    'Acumulador de Recursos: Posee $1 BTC en reservas de materias primas ($2x la mediana del país) con $3.'],
  [/^Upper-Bracket Non-Donor: Net worth \(([\d,.]+) BTC\) exceeds country cutoff \(([\d,.]+) BTC\) with token period contributions\.$/i,
    'No Donante del Tramo Superior: Su patrimonio neto ($1 BTC) supera el corte nacional ($2 BTC) con aportes mínimos en el período.'],
  [/^Below Country Median Wealth \(([\d,.]+) BTC\): Protected from whale-skewed penalties\.$/i,
    'Bajo la Mediana de Riqueza del País ($1 BTC): Protegido contra penalizaciones sesgadas por grandes fortunas.'],
  [/^Historical Pillar \((.+) Lifetime Donor: ([\d,.]+) BTC lifetime protected by Veteran Grace Floor ≥([\d,.]+) BTC\), currently Dormant in active period \(([\d,.]+) BTC \/ ([\d.]+)% vs ([\d.]+)% quota\)\. Eligible for Primary Commendation \+ Secondary Treasury Nudge\.$/i,
    'Pilar Histórico (Donante Histórico $1: $2 BTC acumulados protegidos por el Piso de Gracia ≥$3 BTC), actualmente Inactivo en el período ($4 BTC / $5% vs $6% de cuota). Elegible para Condecoración Principal + Solicitud Secundaria del Tesoro.'],
  [/^Historical Pillar \((.+) Lifetime Donor in Country\): ([\d,.]+) BTC lifetime contributions preserved by national charter \(([\d,.]+) BTC active period credit\)\.$/i,
    'Pilar Histórico (Donante Histórico $1 del País): $2 BTC en contribuciones históricas protegidas por estatuto nacional ($3 BTC de crédito en el período activo).'],
  [/^National Combat Hero \((.+) Heavy Hitter in Country\): Frontline combat leader dealing top-tier battlefield damage for the nation\.$/i,
    'Héroe Nacional de Combate ($1 en Daño del País): Líder de primera línea que inflige daño de élite en el campo de batalla por la nación.'],
  [/^Verified Industrial Sacrifice: Company equity is depleted \(([\d,.]+) BTC vs\. ([\d,.]+) BTC country median\) alongside ([\d,.]+) BTC lifetime donated and ([\d,.]+) career combat damage\. Protected from Leech classification—eligible for Morale & Rebuild Commendation\.$/i,
    'Sacrificio Industrial Verificado: Capital de empresas agotado ($1 BTC vs. $2 BTC mediana del país) junto con $3 BTC donados de por vida y $4 de daño histórico en combate. Protegido de clasificación Leech — elegible para Condecoración de Moral y Reconstrucción.'],
  [/^Verified Career War Veteran in (Eco|Hybrid) Mode: Recorded ([\d,.]+) career combat damage \(exceeding country (?:P75|benchmark) of ([\d,.]+) dmg\), currently farming capital \(([\d,.]+) BTC liquid \/ ([\d,.]+) BTC stock\) with ([\d,.]+) BTC donated this period\. Protected from Critical Leech\.$/i,
    'Veterano de Guerra Verificado en Modo $1: Registra $2 de daño histórico en combate (superando la referencia nacional de $3 de daño), actualmente farmeando capital ($4 BTC líquidos / $5 BTC en stock) con $6 BTC donados en este período. Protegido de Leech Crítico.'],
  [/^Proven Above-Median Veteran Donor: Contributed ([\d,.]+) BTC lifetime \((?:(\d+)x donations, )?vs\. ([\d,.]+) BTC country lifetime median & ([\d,.]+) BTC P75\), currently at ([\d,.]+) BTC in the active window \(([\d,.]+) BTC liquid cash\)\. Protected from Critical Leech—use Encouraging Veteran Nudge\.$/i,
    'Donante Veterano Sobre la Mediana: Aportó $1 BTC de por vida ($2 donaciones, vs. $3 BTC mediana histórica del país y $4 BTC P75), actualmente con $5 BTC en la ventana activa ($6 BTC en efectivo líquido). Protegido de Leech Crítico — usar Nudge de Aliento a Veterano.'],
  [/^Identified Slacker \/ Evader: Upper wealth\/stock bracket of (.+) \(([\d,.]+) BTC net worth\) with token period contributions \(([\d,.]+) BTC, ([\d.]+)% of wealth\)\.$/i,
    'Evasor Identificado: Tramo superior de riqueza/reservas de $1 ($2 BTC de patrimonio neto) con aportes mínimos en el período ($3 BTC, $4% de su patrimonio).'],
  [/^Identified Slacker: Upper wealth\/stockpile bracket of (.+) \(([\d,.]+) BTC\) with token contributions \(([\d,.]+) BTC, ([\d.]+)% of wealth\)\.$/i,
    'Evasor Identificado: Tramo superior de riqueza/reservas de $1 ($2 BTC) con aportes mínimos ($3 BTC, $4% de su patrimonio).'],
  [/^Model Patriot: Contributed ([\d,.]+) BTC in period \(([\d.]+)% ratio\), meeting or exceeding national target\.$/i,
    'Patriota Modelo: Aportó $1 BTC en el período ($2% de ratio), cumpliendo o superando la meta nacional.'],
  [/^Subsistence Worker: Working citizen with wealth and liquidity below national median \(([\d,.]+) BTC\)\. Exempted from taxation\.$/i,
    'Trabajador de Subsistencia: Ciudadano trabajador con riqueza y liquidez bajo la mediana nacional ($1 BTC). Exento de presión fiscal.'],
  [/^Illiquid Combatant: High asset equity \(([\d,.]+) BTC\) locked in gear and factories, active on the front lines\.$/i,
    'Combatiente Ilíquido: Alto capital en activos ($1 BTC) inmovilizado en equipamiento y fábricas, activo en el frente de batalla.'],
  [/^Active Citizen: Contributes at standard national rate \(([\d.]+)% ratio\)\.$/i,
    'Ciudadano Activo: Contribuye a la tasa estándar nacional ($1% de ratio).'],
  [/^Active Window:\s*(.+)$/i, 'Ventana Activa: $1'],
  [/^Window:\s*(.+)$/i, 'Ventana: $1'],
  [/^All-Time Rank #(\d+)$/i, 'Rango Histórico #$1'],
  [/^Lifetime Rank #(\d+) in (.+)$/i, 'Rango Histórico #$1 en $2'],
  [/^Confirmed lifetime total for (.+)$/i, 'Total histórico confirmado para $1'],
  [/^Period Donated \((.+)\)$/i, 'Donado en el Período ($1)'],
  [/^Audit Scope — Selected Period \((.+)\):$/i, 'Alcance de Auditoría — Período Seleccionado ($1):'],
  [/^Showing official cumulative lifetime confirmed donations to (.+)\. Switch the timeframe filter \(24h, 7d, 30d, or Custom\) to inspect period-scoped itemized receipts\.$/i,
    'Mostrando el total acumulado histórico oficial de donaciones confirmadas a $1. Cambia el filtro de tiempo (24h, 7d, 30d o Personalizado) para inspeccionar recibos detallados del período.'],
  [/^Itemized receipts and primary totals below strictly show confirmed donations to (.+) within the selected (.+) window \((.+)\)\. For full historical context, this citizen's All-Time Lifetime Country Total is also shown below\.$/i,
    'Los recibos detallados y totales principales de abajo muestran estrictamente las donaciones confirmadas a $1 dentro de la ventana seleccionada de $2 ($3). Para contexto histórico completo, también se muestra abajo el Total Histórico del País de este ciudadano.'],
  [/^Period Donated:\s*([\d,.]+) BTC \(([\d.]+)% vs\. ([\d.]+)% Patriot \/ ([\d.]+)% Moderate quota\)\.\s*Lifetime:\s*([\d,.]+) BTC \(Country Median:\s*([\d,.]+) BTC\)\.\s*Liquid:\s*([\d,.]+) BTC • Stock:\s*([\d,.]+) BTC\.$/i,
    'Donado en Período: $1 BTC ($2% vs. cuota $3% Patriota / $4% Moderado). Histórico: $5 BTC (Mediana País: $6 BTC). Líquido: $7 BTC • Stock: $8 BTC.'],
  [/^(.+) is a revered Historical Pillar \(([\d,.]+) BTC lifetime donated(.*)\) who is currently dormant this period \(([\d,.]+) BTC donated, ([\d.]+)% vs\. ([\d.]+)% policy quota\)\. Primary recommendation honors their lifetime pillar status with a warm reactivation salute, while a Secondary Treasury Nudge \(([\d,.]+) BTC\) is ready below if you wish to request a period contribution\.$/i,
    '$1 es un venerado Pilar Histórico ($2 BTC donados de por vida$3) que se encuentra inactivo en este período ($4 BTC donados, $5% vs. $6% de cuota). La recomendación principal honra su estatus de Pilar con un cordial saludo de reactivación, mientras que una Solicitud Secundaria del Tesoro ($7 BTC) está lista abajo si desea pedir un aporte en este período.'],
  [/^Because (.+) contributed ([\d,.]+) BTC in the active window \(([\d.]+)% vs\. ([\d.]+)% quota\) while holding ([\d,.]+) BTC liquid cash and ([\d,.]+) BTC in commodities, a Secondary Treasury Nudge \(([\d,.]+) BTC\) is also recommended\.$/i,
    'Dado que $1 aportó $2 BTC en la ventana activa ($3% vs. $4% de cuota) mientras mantiene $5 BTC en efectivo líquido y $6 BTC en materias primas, también se recomienda una Solicitud Secundaria del Tesoro ($7 BTC).'],
  [/^While (.+) earned Frontline Hero standing via ([\d,.]+) combat damage, they also hold significant idle reserves \(([\d,.]+) BTC liquid \/ ([\d,.]+) BTC stock\) with 0 BTC direct treasury donations this period\.$/i,
    'Aunque $1 obtuvo el rango de Héroe del Frente mediante $2 de daño en combate, también posee importantes reservas inactivas ($3 BTC líquidos / $4 BTC en stock) con 0 BTC donados directamente a la tesorería en este período.'],
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
