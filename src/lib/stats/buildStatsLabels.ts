import { getTranslations } from 'next-intl/server'

export type StatsLabels = {
  ranking: string
  rankingSubtitle: string
  rankingMembers: string
  topGames: string
  topGamesSubtitle: string
  playDays: string
  leaguesPanel: string
  leaguesSubtitle: string
  missions: string
  missionsEmpty: string
  gamesFrequency: string
  gamesFrequencyEmpty: string
  headToHead: string
  headToHeadTooMany: string
  headToHeadBest: string
  headToHeadWorst: string
  streaks: string
  recentForm: string
  recentFormWon: string
  recentFormLost: string
  recentFormNone: string
  scoreRecords: string
  scoreRecordsHighest: string
  scoreRecordsHighestLoss: string
  scoreRecordsAvgWinner: string
  winTrend: string
  winTrendSubtitle: string
  gamesTable: string
  gamesTableWinner: string
  gamesTableEmpty: string
  gamesTableHeaderGame: string
  gamesTableHeaderDate: string
  gamesTableHeaderPlayers: string
  gamesTableHeaderResult: string
  resultWon: string
  resultLost: string
  empty: string
  emptyLeagues: string
  recencyToday: string
  recencyYesterday: string
  recencyOneWeek: string
  recencyNever: string
  prev: string
  next: string
  rangeWeek: string
  rangeMonth: string
  rangeYear: string
  rangeAll: string
  rangeCustom: string
  rangeApply: string
  rangeFrom: string
  rangeTo: string
}

export type StatsFormatters = {
  missionsTop: (count: number) => string
  streaksCurrent: (count: number) => string
  streaksLongest: (count: number) => string
  wins: (count: number) => string
  winRatio: (ratio: number) => string
  playCount: (count: number) => string
  playCountSessies: (count: number) => string
  playerCount: (count: number) => string
  totalPrefix: (count: number) => string
  recencyDays: (count: number) => string
  recencyWeeks: (count: number) => string
  recencyMonths: (count: number) => string
  pagination: (page: number, total: number) => string
  paginationPerPage: (count: number) => string
  gamesTableTotal: (count: number, page: number, totalPages: number) => string
}

export async function buildStatsLabels(
  locale: 'nl' | 'en'
): Promise<{ labels: StatsLabels; formatters: StatsFormatters }> {
  const t = await getTranslations({ locale, namespace: 'app.stats' })
  const labels: StatsLabels = {
    ranking: t('ranking'),
    rankingSubtitle: t('rankingSubtitle'),
    rankingMembers: t('rankingMembers'),
    topGames: t('topGames'),
    topGamesSubtitle: t('topGamesSubtitle'),
    playDays: t('playDays'),
    leaguesPanel: t('leaguesPanel'),
    leaguesSubtitle: t('leaguesSubtitle'),
    missions: t('missions'),
    missionsEmpty: t('missionsEmpty'),
    gamesFrequency: t('gamesFrequency'),
    gamesFrequencyEmpty: t('gamesFrequencyEmpty'),
    headToHead: t('headToHead'),
    headToHeadTooMany: t('headToHeadTooMany'),
    headToHeadBest: t('headToHeadBest'),
    headToHeadWorst: t('headToHeadWorst'),
    streaks: t('streaks'),
    recentForm: t('recentForm'),
    recentFormWon: t('recentFormWon'),
    recentFormLost: t('recentFormLost'),
    recentFormNone: t('recentFormNone'),
    scoreRecords: t('scoreRecords'),
    scoreRecordsHighest: t('scoreRecordsHighest'),
    scoreRecordsHighestLoss: t('scoreRecordsHighestLoss'),
    scoreRecordsAvgWinner: t('scoreRecordsAvgWinner'),
    winTrend: t('winTrend'),
    winTrendSubtitle: t('winTrendSubtitle'),
    gamesTable: t('gamesTable'),
    gamesTableWinner: t('gamesTableWinner'),
    gamesTableEmpty: t('gamesTableEmpty'),
    gamesTableHeaderGame: t('gamesTableHeaderGame'),
    gamesTableHeaderDate: t('gamesTableHeaderDate'),
    gamesTableHeaderPlayers: t('gamesTableHeaderPlayers'),
    gamesTableHeaderResult: t('gamesTableHeaderResult'),
    resultWon: t('resultWon'),
    resultLost: t('resultLost'),
    empty: t('empty'),
    emptyLeagues: t('emptyLeagues'),
    recencyToday: t('recencyToday'),
    recencyYesterday: t('recencyYesterday'),
    recencyOneWeek: t('recencyOneWeek'),
    recencyNever: t('recencyNever'),
    prev: t('prev'),
    next: t('next'),
    rangeWeek: t('rangeWeek'),
    rangeMonth: t('rangeMonth'),
    rangeYear: t('rangeYear'),
    rangeAll: t('rangeAll'),
    rangeCustom: t('rangeCustom'),
    rangeApply: t('rangeApply'),
    rangeFrom: t('rangeFrom'),
    rangeTo: t('rangeTo'),
  }
  const formatters: StatsFormatters = {
    missionsTop: (count) => t('missionsTop', { count }),
    streaksCurrent: (count) => t('streaksCurrent', { count }),
    streaksLongest: (count) => t('streaksLongest', { count }),
    wins: (count) => t('wins', { count }),
    winRatio: (ratio) => t('winRatio', { ratio }),
    playCount: (count) => t('playCount', { count }),
    playCountSessies: (count) => t('playCountSessies', { count }),
    playerCount: (count) =>
      count === 1 ? t('playerCount', { count }) : t('playerCountPlural', { count }),
    totalPrefix: (count) => t('totalPrefix', { count }),
    recencyDays: (count) => t('recencyDays', { count }),
    recencyWeeks: (count) => t('recencyWeeks', { count }),
    recencyMonths: (count) => t('recencyMonths', { count }),
    pagination: (page, total) => t('pagination', { page, total }),
    paginationPerPage: (count) => t('paginationPerPage', { count }),
    gamesTableTotal: (count, page, totalPages) =>
      t('gamesTableTotal', { count, page, totalPages }),
  }
  return { labels, formatters }
}
