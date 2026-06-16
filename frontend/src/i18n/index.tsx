import { createContext, ReactNode, useContext, useEffect, useMemo, useState } from 'react';

type Language = 'en' | 'es' | 'fr';

type Dictionary = Record<string, string>;

const STORAGE_KEY = 'oryn-language';

const dictionaries: Record<Language, Dictionary> = {
  en: {
    'nav.home': 'Home',
    'nav.markets': 'Markets',
    'nav.create': 'Create',
    'nav.liquidity': 'Liquidity',
    'nav.about': 'About',
    'nav.leaderboard': 'Leaderboard',
    'nav.analytics': 'Analytics',
    'nav.reports': 'Reports',
    'nav.governance': 'Governance',
    'nav.menu': 'Menu',
    'language.label': 'Language',
    'markets.trending': 'Trending Markets',
    'markets.discover': 'Discover Markets',
    'markets.cached': 'Cached',
    'markets.offline': 'Offline',
    'markets.refresh': 'Refresh',
    'markets.subtitle': 'Browse and trade on {count} prediction markets',
    'markets.search': 'Search by question or #tag...',
    'markets.sort': 'Sort:',
    'markets.endingSoon': 'Ending Soon',
    'markets.noMarkets': 'No markets available',
    'markets.noResults': 'No markets found matching your criteria',
    'markets.clearFilters': 'Clear filters',
    'market.back': 'Back to Markets',
    'market.trending': 'Trending',
    'market.liquidityImbalance': 'Liquidity Imbalance: {side} heavy',
    'market.yesPrice': 'YES Price',
    'market.noPrice': 'NO Price',
    'market.performance': 'Market Performance',
    'market.recentTrades': 'Recent Trades',
    'market.buy': 'Buy',
    'market.sell': 'Sell',
    'market.amount': 'Amount (USDC)',
    'market.receive': 'You receive',
    'market.pricePerToken': 'Price per token',
    'market.priceImpact': 'Est. price impact',
    'market.fee': 'Est. fee',
    'market.filled': 'Filled',
    'market.remaining': 'Remaining',
    'market.confirming': 'Confirming...',
    'market.tradingDisabled': 'Offline - Trading Disabled',
    'market.connectWallet': 'Connect Wallet',
    'market.settlement': 'Est. settlement: ~5 seconds',
    'market.txStatus': 'Transaction Status',
    'market.sellPrompt': 'Connect wallet to view your positions to sell',
    'market.info': 'Market Info',
    'market.volume': 'Total Volume',
    'market.traders': 'Traders',
    'market.created': 'Created',
    'market.expires': 'Expires',
    'market.resolutionSource': 'Resolution Source',
    'market.creator': 'Creator',
    'create.title': 'Create a Market',
    'create.subtitle': 'Launch your own prediction market and earn fees on every trade. Anyone can participate once your market goes live.',
    'create.question': 'Market Question *',
    'create.questionPlaceholder': 'Will Bitcoin exceed $150,000 by December 31, 2025?',
    'create.characters': '{count}/{max} characters',
    'create.category': 'Category *',
    'create.selectCategory': 'Select a category',
    'create.resolution': 'Resolution Source & Criteria *',
    'create.resolutionPlaceholder': 'This market will resolve to YES if the official Bitcoin price on CoinGecko exceeds $150,000 at any point before the expiration date...',
    'create.resolutionHelp': 'Be specific about what data source and conditions will determine the outcome',
    'create.endDate': 'Market End Date *',
    'create.pickDate': 'Pick a date',
    'create.liquidity': 'Initial Liquidity (USDC) *',
    'create.liquidityHelp': 'Minimum 50 USDC. Higher liquidity = better trading experience',
    'create.tradingFee': 'Trading Fee',
    'create.feeHelp': 'You earn this fee on every trade. Higher fees = more earnings but less trading volume',
    'create.preview': 'Market Preview',
    'create.previewQuestion': 'Your market question will appear here...',
    'create.ends': 'Ends: {date}',
    'create.notSet': 'Not set',
    'create.costs': 'Estimated Costs',
    'create.initialLiquidity': 'Initial Liquidity',
    'create.networkFee': 'Network Fee',
    'create.total': 'Total',
    'create.important': 'Important',
    'create.warning': 'Once created, markets cannot be edited. Make sure all information is accurate before proceeding.',
    'create.status': 'Transaction Status',
    'create.creating': 'Creating Market...',
    'create.connect': 'Connect Wallet to Create',
    'create.submit': 'Create Market',
  },
  es: {
    'nav.home': 'Inicio',
    'nav.markets': 'Mercados',
    'nav.create': 'Crear',
    'nav.liquidity': 'Liquidez',
    'nav.about': 'Acerca de',
    'nav.leaderboard': 'Clasificacion',
    'nav.analytics': 'Analitica',
    'nav.reports': 'Reportes',
    'nav.governance': 'Gobernanza',
    'nav.menu': 'Menu',
    'language.label': 'Idioma',
    'markets.trending': 'Mercados en tendencia',
    'markets.discover': 'Descubrir mercados',
    'markets.cached': 'En cache',
    'markets.offline': 'Sin conexion',
    'markets.refresh': 'Actualizar',
    'markets.subtitle': 'Explora y opera en {count} mercados de prediccion',
    'markets.search': 'Buscar por pregunta o #etiqueta...',
    'markets.sort': 'Ordenar:',
    'markets.endingSoon': 'Terminan pronto',
    'markets.noMarkets': 'No hay mercados disponibles',
    'markets.noResults': 'No hay mercados que coincidan con tus criterios',
    'markets.clearFilters': 'Limpiar filtros',
    'market.back': 'Volver a mercados',
    'market.trending': 'Tendencia',
    'market.liquidityImbalance': 'Desequilibrio de liquidez: {side} dominante',
    'market.yesPrice': 'Precio SI',
    'market.noPrice': 'Precio NO',
    'market.performance': 'Rendimiento del mercado',
    'market.recentTrades': 'Operaciones recientes',
    'market.buy': 'Comprar',
    'market.sell': 'Vender',
    'market.amount': 'Cantidad (USDC)',
    'market.receive': 'Recibes',
    'market.pricePerToken': 'Precio por token',
    'market.priceImpact': 'Impacto est. en precio',
    'market.fee': 'Comision est.',
    'market.filled': 'Ejecutado',
    'market.remaining': 'Restante',
    'market.confirming': 'Confirmando...',
    'market.tradingDisabled': 'Sin conexion - Trading desactivado',
    'market.connectWallet': 'Conectar wallet',
    'market.settlement': 'Liquidacion est.: ~5 segundos',
    'market.txStatus': 'Estado de transaccion',
    'market.sellPrompt': 'Conecta tu wallet para ver posiciones a vender',
    'market.info': 'Info del mercado',
    'market.volume': 'Volumen total',
    'market.traders': 'Traders',
    'market.created': 'Creado',
    'market.expires': 'Expira',
    'market.resolutionSource': 'Fuente de resolucion',
    'market.creator': 'Creador',
    'create.title': 'Crear un mercado',
    'create.subtitle': 'Lanza tu propio mercado de prediccion y gana comisiones en cada operacion. Cualquiera puede participar cuando este activo.',
    'create.question': 'Pregunta del mercado *',
    'create.questionPlaceholder': 'Bitcoin superara $150,000 antes del 31 de diciembre de 2025?',
    'create.characters': '{count}/{max} caracteres',
    'create.category': 'Categoria *',
    'create.selectCategory': 'Selecciona una categoria',
    'create.resolution': 'Fuente y criterios de resolucion *',
    'create.resolutionPlaceholder': 'Este mercado resolvera SI si el precio oficial de Bitcoin en CoinGecko supera $150,000 antes de la fecha de expiracion...',
    'create.resolutionHelp': 'Especifica que fuente de datos y condiciones determinaran el resultado',
    'create.endDate': 'Fecha de cierre *',
    'create.pickDate': 'Elegir fecha',
    'create.liquidity': 'Liquidez inicial (USDC) *',
    'create.liquidityHelp': 'Minimo 50 USDC. Mas liquidez = mejor experiencia de trading',
    'create.tradingFee': 'Comision de trading',
    'create.feeHelp': 'Ganas esta comision en cada operacion. Comisiones mas altas = mas ingresos pero menos volumen',
    'create.preview': 'Vista previa',
    'create.previewQuestion': 'Tu pregunta aparecera aqui...',
    'create.ends': 'Termina: {date}',
    'create.notSet': 'No definido',
    'create.costs': 'Costos estimados',
    'create.initialLiquidity': 'Liquidez inicial',
    'create.networkFee': 'Comision de red',
    'create.total': 'Total',
    'create.important': 'Importante',
    'create.warning': 'Una vez creados, los mercados no se pueden editar. Verifica todo antes de continuar.',
    'create.status': 'Estado de transaccion',
    'create.creating': 'Creando mercado...',
    'create.connect': 'Conectar wallet para crear',
    'create.submit': 'Crear mercado',
  },
  fr: {
    'nav.home': 'Accueil',
    'nav.markets': 'Marches',
    'nav.create': 'Creer',
    'nav.liquidity': 'Liquidite',
    'nav.about': 'A propos',
    'nav.leaderboard': 'Classement',
    'nav.analytics': 'Analytique',
    'nav.reports': 'Rapports',
    'nav.governance': 'Gouvernance',
    'nav.menu': 'Menu',
    'language.label': 'Langue',
    'markets.trending': 'Marches tendance',
    'markets.discover': 'Decouvrir les marches',
    'markets.cached': 'En cache',
    'markets.offline': 'Hors ligne',
    'markets.refresh': 'Actualiser',
    'markets.subtitle': 'Parcourez et tradez sur {count} marches de prediction',
    'markets.search': 'Rechercher par question ou #tag...',
    'markets.sort': 'Trier:',
    'markets.endingSoon': 'Bientot termines',
    'markets.noMarkets': 'Aucun marche disponible',
    'markets.noResults': 'Aucun marche ne correspond a vos criteres',
    'markets.clearFilters': 'Effacer les filtres',
    'market.back': 'Retour aux marches',
    'market.trending': 'Tendance',
    'market.liquidityImbalance': 'Desequilibre de liquidite: {side} dominant',
    'market.yesPrice': 'Prix OUI',
    'market.noPrice': 'Prix NON',
    'market.performance': 'Performance du marche',
    'market.recentTrades': 'Trades recents',
    'market.buy': 'Acheter',
    'market.sell': 'Vendre',
    'market.amount': 'Montant (USDC)',
    'market.receive': 'Vous recevez',
    'market.pricePerToken': 'Prix par token',
    'market.priceImpact': 'Impact prix est.',
    'market.fee': 'Frais est.',
    'market.filled': 'Execute',
    'market.remaining': 'Restant',
    'market.confirming': 'Confirmation...',
    'market.tradingDisabled': 'Hors ligne - Trading desactive',
    'market.connectWallet': 'Connecter wallet',
    'market.settlement': 'Reglement est.: ~5 secondes',
    'market.txStatus': 'Statut de transaction',
    'market.sellPrompt': 'Connectez votre wallet pour voir vos positions a vendre',
    'market.info': 'Infos marche',
    'market.volume': 'Volume total',
    'market.traders': 'Traders',
    'market.created': 'Cree',
    'market.expires': 'Expire',
    'market.resolutionSource': 'Source de resolution',
    'market.creator': 'Createur',
    'create.title': 'Creer un marche',
    'create.subtitle': 'Lancez votre propre marche de prediction et gagnez des frais sur chaque trade. Tout le monde peut participer une fois le marche actif.',
    'create.question': 'Question du marche *',
    'create.questionPlaceholder': 'Bitcoin depassera-t-il 150 000 $ avant le 31 decembre 2025 ?',
    'create.characters': '{count}/{max} caracteres',
    'create.category': 'Categorie *',
    'create.selectCategory': 'Choisir une categorie',
    'create.resolution': 'Source et criteres de resolution *',
    'create.resolutionPlaceholder': 'Ce marche sera resolu OUI si le prix officiel du Bitcoin sur CoinGecko depasse 150 000 $ avant la date limite...',
    'create.resolutionHelp': 'Precisez la source de donnees et les conditions qui determineront le resultat',
    'create.endDate': 'Date de fin *',
    'create.pickDate': 'Choisir une date',
    'create.liquidity': 'Liquidite initiale (USDC) *',
    'create.liquidityHelp': 'Minimum 50 USDC. Plus de liquidite = meilleure experience de trading',
    'create.tradingFee': 'Frais de trading',
    'create.feeHelp': 'Vous gagnez ces frais sur chaque trade. Frais plus eleves = plus de revenus mais moins de volume',
    'create.preview': 'Apercu du marche',
    'create.previewQuestion': 'Votre question apparaitra ici...',
    'create.ends': 'Fin: {date}',
    'create.notSet': 'Non defini',
    'create.costs': 'Couts estimes',
    'create.initialLiquidity': 'Liquidite initiale',
    'create.networkFee': 'Frais reseau',
    'create.total': 'Total',
    'create.important': 'Important',
    'create.warning': 'Une fois crees, les marches ne peuvent pas etre modifies. Verifiez tout avant de continuer.',
    'create.status': 'Statut de transaction',
    'create.creating': 'Creation du marche...',
    'create.connect': 'Connecter wallet pour creer',
    'create.submit': 'Creer le marche',
  },
};

const languageNames: Record<Language, string> = {
  en: 'English',
  es: 'Espanol',
  fr: 'Francais',
};

interface I18nContextValue {
  language: Language;
  languages: Language[];
  languageNames: Record<Language, string>;
  setLanguage: (language: Language) => void;
  t: (key: string, values?: Record<string, string | number>) => string;
}

const I18nContext = createContext<I18nContextValue | undefined>(undefined);

function isLanguage(value: string | null): value is Language {
  return value === 'en' || value === 'es' || value === 'fr';
}

export function I18nProvider({ children }: { children: ReactNode }) {
  const [language, setLanguageState] = useState<Language>(() => {
    if (typeof window === 'undefined') return 'en';
    const storedLanguage = window.localStorage.getItem(STORAGE_KEY);
    return isLanguage(storedLanguage) ? storedLanguage : 'en';
  });

  useEffect(() => {
    window.localStorage.setItem(STORAGE_KEY, language);
    document.documentElement.lang = language;
  }, [language]);

  const value = useMemo<I18nContextValue>(() => {
    const translate = (key: string, values: Record<string, string | number> = {}) => {
      const template = dictionaries[language][key] ?? dictionaries.en[key] ?? key;
      return Object.entries(values).reduce(
        (result, [name, replacement]) => result.replaceAll(`{${name}}`, String(replacement)),
        template
      );
    };

    return {
      language,
      languages: ['en', 'es', 'fr'],
      languageNames,
      setLanguage: setLanguageState,
      t: translate,
    };
  }, [language]);

  return <I18nContext.Provider value={value}>{children}</I18nContext.Provider>;
}

export function useI18n() {
  const context = useContext(I18nContext);
  if (!context) {
    throw new Error('useI18n must be used within I18nProvider');
  }
  return context;
}
