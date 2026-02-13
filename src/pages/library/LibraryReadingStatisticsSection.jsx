import React, { useEffect, useMemo, useState } from "react";
import { Link } from "react-router-dom";
import {
  BookOpen,
  CircleHelp,
  Clock3,
  FileText,
  Flame,
  Sparkles,
  Target,
  Timer,
} from "lucide-react";

const DAY_MS = 24 * 60 * 60 * 1000;
const READING_STATS_PREFS_KEY = "library-reading-statistics-preferences";
const DEFAULT_WEEKLY_CHALLENGE_SECONDS = 5 * 3600;

const TIME_RANGE_OPTIONS = [
  { value: "7d", label: "Last 7 days" },
  { value: "30d", label: "Last 30 days" },
  { value: "90d", label: "Last 90 days" },
  { value: "all", label: "All time" }
];

const LAYOUT_OPTIONS = [
  { value: "dashboard", label: "Dashboard" },
  { value: "books", label: "Books focus" },
  { value: "habits", label: "Habits focus" }
];

const ACTIVITY_VIEWS = [
  { value: "bars", label: "Bars" },
  { value: "line", label: "Line" }
];

const statusColorClasses = {
  "To read": "bg-amber-500",
  "In progress": "bg-blue-500",
  "Finished": "bg-emerald-500",
  "Not started": "bg-slate-400"
};

const statusToneClasses = {
  "To read": "border-amber-200 bg-amber-50 text-amber-700",
  "In progress": "border-blue-200 bg-blue-50 text-blue-700",
  "Finished": "border-emerald-200 bg-emerald-50 text-emerald-700",
  "Not started": "border-gray-200 bg-gray-100 text-gray-700"
};

const normalizeNumber = (value) => {
  const parsed = Number(value);
  if (!Number.isFinite(parsed)) return 0;
  return parsed;
};

const clampProgress = (value) => Math.max(0, Math.min(100, Math.round(normalizeNumber(value))));

const toLocalDateKey = (dateLike) => {
  const date = dateLike instanceof Date ? dateLike : new Date(dateLike);
  if (!Number.isFinite(date.getTime())) return "";
  const year = date.getFullYear();
  const month = String(date.getMonth() + 1).padStart(2, "0");
  const day = String(date.getDate()).padStart(2, "0");
  return `${year}-${month}-${day}`;
};

const fromLocalDateKey = (key) => {
  const [year, month, day] = String(key).split("-").map(Number);
  if (!year || !month || !day) return null;
  return new Date(year, month - 1, day);
};

const getSessionEndMs = (session) => {
  const endMs = new Date(session?.endAt || session?.startAt || 0).getTime();
  if (!Number.isFinite(endMs)) return null;
  return endMs;
};

const getTimeRangeStartMs = (range) => {
  if (range === "all") return null;
  const now = Date.now();
  const days = range === "7d" ? 7 : range === "30d" ? 30 : 90;
  return now - (days * DAY_MS);
};

const getRangeDays = (range) => {
  if (range === "7d") return 7;
  if (range === "30d") return 30;
  if (range === "90d") return 90;
  return null;
};

const getChartDayCount = (range) => {
  if (range === "7d") return 7;
  if (range === "30d") return 30;
  if (range === "90d") return 45;
  return 14;
};

const buildLastNDays = (count) => {
  const days = [];
  const today = new Date();
  today.setHours(0, 0, 0, 0);

  for (let index = count - 1; index >= 0; index -= 1) {
    const day = new Date(today.getTime() - (index * DAY_MS));
    days.push({
      key: toLocalDateKey(day),
      dayLabel: day.toLocaleDateString(undefined, { weekday: "short" }).slice(0, 1),
      fullLabel: day.toLocaleDateString(undefined, { month: "short", day: "numeric" }),
      seconds: 0,
      pages: 0,
      bookTitles: []
    });
  }

  return days;
};

const getBookStatus = (book) => {
  const progress = clampProgress(book?.progress);
  if (progress >= 100) return "Finished";
  if (progress > 0) return "In progress";
  if (book?.isToRead) return "To read";
  return "Not started";
};

const formatDuration = (seconds, { short = false } = {}) => {
  const safeSeconds = Math.max(0, normalizeNumber(seconds));
  if (!safeSeconds) return short ? "0m" : "0 min";
  const minutes = Math.max(1, Math.round(safeSeconds / 60));
  const hours = Math.floor(minutes / 60);
  const remainder = minutes % 60;

  if (short) {
    if (hours <= 0) return `${minutes}m`;
    if (remainder === 0) return `${hours}h`;
    return `${hours}h ${remainder}m`;
  }

  if (hours <= 0) return `${minutes} min`;
  if (remainder === 0) return `${hours}h`;
  return `${hours}h ${remainder} min`;
};

const formatHours = (seconds) => {
  const safeSeconds = Math.max(0, normalizeNumber(seconds));
  if (!safeSeconds) return "0h";
  const hours = safeSeconds / 3600;
  if (hours >= 10) return `${Math.round(hours)}h`;
  return `${Math.round(hours * 10) / 10}h`;
};

const readStoredPreferences = () => {
  const fallback = {
    timeRange: "30d",
    layoutMode: "dashboard",
    activityView: "bars"
  };
  if (typeof window === "undefined") return fallback;

  try {
    const raw = window.localStorage.getItem(READING_STATS_PREFS_KEY);
    if (!raw) return fallback;
    const parsed = JSON.parse(raw);
    const timeRange = TIME_RANGE_OPTIONS.some((option) => option.value === parsed?.timeRange) ? parsed.timeRange : fallback.timeRange;
    const layoutMode = LAYOUT_OPTIONS.some((option) => option.value === parsed?.layoutMode) ? parsed.layoutMode : fallback.layoutMode;
    const activityView = ACTIVITY_VIEWS.some((option) => option.value === parsed?.activityView) ? parsed.activityView : fallback.activityView;
    return { timeRange, layoutMode, activityView };
  } catch {
    return fallback;
  }
};

const getWeekStart = () => {
  const now = new Date();
  const day = (now.getDay() + 6) % 7;
  const monday = new Date(now);
  monday.setHours(0, 0, 0, 0);
  monday.setDate(monday.getDate() - day);
  return monday.getTime();
};

const getBarFillStyle = (isDarkLibraryTheme, intensity) => {
  if (intensity <= 0) {
    return {
      background: isDarkLibraryTheme
        ? "linear-gradient(180deg, rgba(51,65,85,0.9) 0%, rgba(30,41,59,0.9) 100%)"
        : "linear-gradient(180deg, rgba(226,232,240,0.9) 0%, rgba(226,232,240,0.9) 100%)"
    };
  }
  const topAlpha = 0.38 + (intensity * 0.46);
  const bottomAlpha = 0.56 + (intensity * 0.36);
  return {
    background: `linear-gradient(180deg, rgba(96,165,250,${topAlpha}) 0%, rgba(37,99,235,${bottomAlpha}) 100%)`
  };
};

const MetricTitle = ({ text, tooltip, isDarkLibraryTheme }) => (
  <div className="flex items-center gap-1.5">
    <span className={`text-xs font-semibold uppercase tracking-[0.14em] ${isDarkLibraryTheme ? "text-slate-400" : "text-gray-500"}`}>
      {text}
    </span>
    {tooltip ? (
      <span title={tooltip} className={`inline-flex ${isDarkLibraryTheme ? "text-slate-500" : "text-gray-400"}`}>
        <CircleHelp size={12} />
      </span>
    ) : null}
  </div>
);

const SkeletonCard = ({ className = "" }) => (
  <div className={`animate-pulse rounded-2xl border border-gray-200 bg-white/70 ${className}`} />
);

export default function LibraryReadingStatisticsSection({
  isDarkLibraryTheme,
  books,
  buildReaderPath,
  onOpenBook,
  onBrowseLibrary
}) {
  const safeBooks = Array.isArray(books) ? books : [];
  const [preferences, setPreferences] = useState(() => readStoredPreferences());
  const [isCalculating, setIsCalculating] = useState(true);
  const { timeRange, layoutMode, activityView } = preferences;

  useEffect(() => {
    if (typeof window !== "undefined") {
      window.localStorage.setItem(READING_STATS_PREFS_KEY, JSON.stringify(preferences));
    }
    setIsCalculating(true);
    const timer = setTimeout(() => setIsCalculating(false), 280);
    return () => clearTimeout(timer);
  }, [preferences, safeBooks.length]);

  const sessionRows = useMemo(() => (
    safeBooks.flatMap((book) => {
      const sessions = Array.isArray(book?.readingSessions) ? book.readingSessions : [];
      const estimatedPages = Math.max(0, Math.round(normalizeNumber(book?.estimatedPages)));
      const progress = clampProgress(book?.progress);
      const readPagesEstimate = estimatedPages > 0 ? Math.round((estimatedPages * progress) / 100) : 0;
      const readingTime = Math.max(0, normalizeNumber(book?.readingTime));
      const pagesPerSecond = readPagesEstimate > 0 && readingTime > 0 ? readPagesEstimate / readingTime : 0;

      return sessions
        .map((session, index) => {
          const endMs = getSessionEndMs(session);
          if (!endMs) return null;
          const seconds = Math.max(0, normalizeNumber(session?.seconds));
          return {
            id: `${book.id}-${index}-${endMs}`,
            bookId: book.id,
            title: book.title || "Untitled",
            seconds,
            pagesEstimate: Math.max(0, seconds * pagesPerSecond),
            endMs,
            endKey: toLocalDateKey(endMs)
          };
        })
        .filter(Boolean);
    })
  ), [safeBooks]);

  const rangeStartMs = useMemo(() => getTimeRangeStartMs(timeRange), [timeRange]);
  const rangeDays = useMemo(() => getRangeDays(timeRange), [timeRange]);

  const sessionsInRange = useMemo(
    () => sessionRows.filter((session) => !rangeStartMs || session.endMs >= rangeStartMs),
    [sessionRows, rangeStartMs]
  );

  const dailyAllMap = useMemo(() => {
    const map = new Map();
    sessionRows.forEach((session) => {
      const current = map.get(session.endKey) || { seconds: 0, pages: 0, titles: new Set() };
      current.seconds += session.seconds;
      current.pages += session.pagesEstimate;
      current.titles.add(session.title);
      map.set(session.endKey, current);
    });
    return map;
  }, [sessionRows]);

  const chartDays = useMemo(() => {
    const days = buildLastNDays(getChartDayCount(timeRange));
    const dayMap = new Map(days.map((day) => [day.key, day]));
    sessionsInRange.forEach((session) => {
      const target = dayMap.get(session.endKey);
      if (!target) return;
      target.seconds += session.seconds;
      target.pages += session.pagesEstimate;
      if (!target.bookTitles.includes(session.title)) {
        target.bookTitles.push(session.title);
      }
    });
    return days;
  }, [sessionsInRange, timeRange]);

  const maxDaySeconds = chartDays.reduce((max, day) => Math.max(max, day.seconds), 0);

  const totalSecondsForRange = useMemo(
    () => sessionsInRange.reduce((sum, session) => sum + session.seconds, 0),
    [sessionsInRange]
  );

  const totalPagesForRange = useMemo(
    () => sessionsInRange.reduce((sum, session) => sum + session.pagesEstimate, 0),
    [sessionsInRange]
  );

  const streakStats = useMemo(() => {
    const keys = Array.from(dailyAllMap.keys())
      .map((key) => fromLocalDateKey(key))
      .filter(Boolean)
      .sort((left, right) => left.getTime() - right.getTime());

    let bestStreak = 0;
    let running = 0;
    let previousMs = null;
    keys.forEach((day) => {
      const currentMs = day.getTime();
      if (previousMs == null || currentMs - previousMs === DAY_MS) {
        running += 1;
      } else {
        running = 1;
      }
      bestStreak = Math.max(bestStreak, running);
      previousMs = currentMs;
    });

    const today = new Date();
    today.setHours(0, 0, 0, 0);
    const yesterday = new Date(today.getTime() - DAY_MS);
    const todayKey = toLocalDateKey(today);
    const yesterdayKey = toLocalDateKey(yesterday);
    const startKey = dailyAllMap.has(todayKey) ? todayKey : (dailyAllMap.has(yesterdayKey) ? yesterdayKey : "");
    let currentStreak = 0;
    if (startKey) {
      let cursor = fromLocalDateKey(startKey);
      while (cursor && dailyAllMap.has(toLocalDateKey(cursor))) {
        currentStreak += 1;
        cursor = new Date(cursor.getTime() - DAY_MS);
      }
    }

    return { currentStreak, bestStreak };
  }, [dailyAllMap]);

  const weeklyChallenge = useMemo(() => {
    const weekStartMs = getWeekStart();
    const weekSeconds = sessionRows
      .filter((session) => session.endMs >= weekStartMs)
      .reduce((sum, session) => sum + session.seconds, 0);
    const percent = Math.max(0, Math.min(100, Math.round((weekSeconds / DEFAULT_WEEKLY_CHALLENGE_SECONDS) * 100)));
    const remaining = Math.max(0, DEFAULT_WEEKLY_CHALLENGE_SECONDS - weekSeconds);
    return { weekSeconds, percent, remaining };
  }, [sessionRows]);

  const personalRecords = useMemo(() => {
    const longestSession = [...sessionRows].sort((a, b) => b.seconds - a.seconds)[0] || null;
    const bestDay = [...dailyAllMap.entries()]
      .map(([key, value]) => ({ key, seconds: value.seconds, pages: value.pages }))
      .sort((a, b) => b.pages - a.pages)[0] || null;
    return { longestSession, bestDay };
  }, [sessionRows, dailyAllMap]);

  const yearSummary = useMemo(() => {
    const now = new Date();
    const yearStart = new Date(now.getFullYear(), 0, 1).getTime();
    const sessionsThisYear = sessionRows.filter((session) => session.endMs >= yearStart);
    const yearSeconds = sessionsThisYear.reduce((sum, session) => sum + session.seconds, 0);
    const yearPages = sessionsThisYear.reduce((sum, session) => sum + session.pagesEstimate, 0);
    const finishedThisYear = safeBooks.filter((book) => {
      if (clampProgress(book?.progress) < 100) return false;
      const lastReadMs = new Date(book?.lastRead || 0).getTime();
      return Number.isFinite(lastReadMs) && lastReadMs >= yearStart;
    }).length;
    return {
      year: now.getFullYear(),
      yearSeconds,
      yearPages,
      finishedThisYear,
      sessionsCount: sessionsThisYear.length
    };
  }, [safeBooks, sessionRows]);

  const statusBreakdown = useMemo(() => {
    const statusCounts = new Map([
      ["To read", 0],
      ["In progress", 0],
      ["Finished", 0],
      ["Not started", 0]
    ]);
    safeBooks.forEach((book) => {
      const status = getBookStatus(book);
      statusCounts.set(status, (statusCounts.get(status) || 0) + 1);
    });
    const total = safeBooks.length || 1;
    return Array.from(statusCounts.entries()).map(([label, count]) => ({
      label,
      count,
      percent: Math.round((count / total) * 100)
    }));
  }, [safeBooks]);

  const topBooks = useMemo(() => {
    const byBook = new Map();
    sessionsInRange.forEach((session) => {
      const current = byBook.get(session.bookId) || 0;
      byBook.set(session.bookId, current + session.seconds);
    });

    return [...safeBooks]
      .map((book) => ({
        ...book,
        trackedSeconds: byBook.get(book.id) || 0
      }))
      .filter((book) => book.trackedSeconds > 0)
      .sort((left, right) => right.trackedSeconds - left.trackedSeconds)
      .slice(0, 6);
  }, [safeBooks, sessionsInRange]);

  const topSessions = useMemo(() => (
    [...sessionsInRange]
      .sort((left, right) => right.seconds - left.seconds)
      .slice(0, 5)
  ), [sessionsInRange]);

  const showActivityPanel = layoutMode !== "books";
  const showStatusPanel = true;
  const showTopBooksPanel = layoutMode !== "habits";
  const showSessionsPanel = layoutMode !== "books";

  const hasAnyBooks = safeBooks.length > 0;
  const hasAnyReadingData = sessionRows.length > 0;

  const yearSummaryText = `${yearSummary.finishedThisYear} books finished · ${formatHours(yearSummary.yearSeconds)} · ${Math.round(yearSummary.yearPages)} pages`;

  const updatePreference = (key, value) => {
    setPreferences((current) => ({ ...current, [key]: value }));
  };

  const resetPreferences = () => {
    setPreferences({
      timeRange: "30d",
      layoutMode: "dashboard",
      activityView: "bars"
    });
  };

  if (isCalculating) {
    return (
      <section
        data-testid="library-reading-statistics-panel"
        className={`mb-4 rounded-2xl border p-5 md:p-7 ${
          isDarkLibraryTheme ? "border-slate-700 bg-slate-900/70" : "border-gray-200 bg-white"
        }`}
      >
        <div className="space-y-4">
          <div className="grid gap-3 lg:grid-cols-[minmax(0,1fr)_220px_180px_170px]">
            <SkeletonCard className="h-[78px]" />
            <SkeletonCard className="h-[78px]" />
            <SkeletonCard className="h-[78px]" />
            <SkeletonCard className="h-[78px]" />
          </div>
          <div className="grid gap-4 sm:grid-cols-2 xl:grid-cols-4">
            <SkeletonCard className="h-[118px]" />
            <SkeletonCard className="h-[118px]" />
            <SkeletonCard className="h-[118px]" />
            <SkeletonCard className="h-[118px]" />
          </div>
          <div className="grid gap-4 xl:grid-cols-[1.45fr_1fr]">
            <SkeletonCard className="h-[290px]" />
            <SkeletonCard className="h-[290px]" />
          </div>
        </div>
      </section>
    );
  }

  return (
    <section
      data-testid="library-reading-statistics-panel"
      className={`mb-4 rounded-2xl border p-5 md:p-7 ${
        isDarkLibraryTheme ? "border-slate-700 bg-slate-900/70" : "border-gray-200 bg-white"
      }`}
    >
      <div className="mb-4 grid gap-3 lg:grid-cols-[minmax(0,1fr)_220px_180px_170px]">
        <div className={`rounded-2xl border px-4 py-3 ${isDarkLibraryTheme ? "border-slate-700 bg-slate-900" : "border-gray-200 bg-white"}`}>
          <div className={`text-[11px] font-semibold uppercase tracking-[0.14em] ${isDarkLibraryTheme ? "text-slate-400" : "text-gray-500"}`}>
            Customize View
          </div>
          <p className={`mt-1 text-xs ${isDarkLibraryTheme ? "text-slate-400" : "text-gray-500"}`}>
            Range, layout, and activity style.
          </p>
        </div>

        <label className={`rounded-2xl border px-3 py-2.5 ${isDarkLibraryTheme ? "border-slate-700 bg-slate-900" : "border-gray-200 bg-white"}`}>
          <span className={`text-[11px] font-semibold uppercase tracking-[0.14em] ${isDarkLibraryTheme ? "text-slate-400" : "text-gray-500"}`}>
            Range
          </span>
          <select
            data-testid="reading-stats-range"
            value={timeRange}
            onChange={(event) => updatePreference("timeRange", event.target.value)}
            className={`mt-1 h-8 w-full rounded-lg border px-2 text-sm font-semibold outline-none focus:ring-2 focus:ring-blue-500 ${
              isDarkLibraryTheme
                ? "border-slate-600 bg-slate-800 text-slate-100"
                : "border-gray-200 bg-white text-slate-700"
            }`}
          >
            {TIME_RANGE_OPTIONS.map((option) => (
              <option key={option.value} value={option.value}>
                {option.label}
              </option>
            ))}
          </select>
        </label>

        <label className={`rounded-2xl border px-3 py-2.5 ${isDarkLibraryTheme ? "border-slate-700 bg-slate-900" : "border-gray-200 bg-white"}`}>
          <span className={`text-[11px] font-semibold uppercase tracking-[0.14em] ${isDarkLibraryTheme ? "text-slate-400" : "text-gray-500"}`}>
            Layout
          </span>
          <select
            data-testid="reading-stats-layout"
            value={layoutMode}
            onChange={(event) => updatePreference("layoutMode", event.target.value)}
            className={`mt-1 h-8 w-full rounded-lg border px-2 text-sm font-semibold outline-none focus:ring-2 focus:ring-blue-500 ${
              isDarkLibraryTheme
                ? "border-slate-600 bg-slate-800 text-slate-100"
                : "border-gray-200 bg-white text-slate-700"
            }`}
          >
            {LAYOUT_OPTIONS.map((option) => (
              <option key={option.value} value={option.value}>
                {option.label}
              </option>
            ))}
          </select>
        </label>

        <label className={`rounded-2xl border px-3 py-2.5 ${isDarkLibraryTheme ? "border-slate-700 bg-slate-900" : "border-gray-200 bg-white"}`}>
          <span className={`text-[11px] font-semibold uppercase tracking-[0.14em] ${isDarkLibraryTheme ? "text-slate-400" : "text-gray-500"}`}>
            Activity view
          </span>
          <select
            data-testid="reading-stats-activity-view"
            value={activityView}
            onChange={(event) => updatePreference("activityView", event.target.value)}
            className={`mt-1 h-8 w-full rounded-lg border px-2 text-sm font-semibold outline-none focus:ring-2 focus:ring-blue-500 ${
              isDarkLibraryTheme
                ? "border-slate-600 bg-slate-800 text-slate-100"
                : "border-gray-200 bg-white text-slate-700"
            }`}
          >
            {ACTIVITY_VIEWS.map((option) => (
              <option key={option.value} value={option.value}>
                {option.label}
              </option>
            ))}
          </select>
          <button
            type="button"
            data-testid="reading-stats-reset-view"
            onClick={resetPreferences}
            className={`mt-2 h-8 w-full rounded-lg border text-xs font-semibold transition ${
              isDarkLibraryTheme
                ? "border-slate-600 text-slate-200 hover:bg-slate-800"
                : "border-gray-200 text-gray-700 hover:bg-gray-50"
            }`}
          >
            Reset view
          </button>
        </label>
      </div>

      {!hasAnyReadingData && (
        <div
          data-testid="reading-stats-empty-state"
          className={`mb-4 rounded-2xl border p-4 ${
            isDarkLibraryTheme ? "border-blue-700 bg-blue-950/25" : "border-blue-200 bg-blue-50/70"
          }`}
        >
          <div className="flex flex-wrap items-start justify-between gap-3">
            <div>
              <h3 className={`text-base font-bold ${isDarkLibraryTheme ? "text-blue-100" : "text-blue-900"}`}>
                Your journey begins here.
              </h3>
              <p className={`mt-1 text-sm ${isDarkLibraryTheme ? "text-blue-200/90" : "text-blue-700"}`}>
                Start your first reading session to unlock trends, records, and yearly insights.
              </p>
            </div>
            {hasAnyBooks ? (
              <Link
                to={buildReaderPath(safeBooks[0].id)}
                onClick={() => onOpenBook?.(safeBooks[0].id)}
                className="inline-flex h-9 items-center rounded-full bg-blue-600 px-4 text-sm font-semibold text-white hover:bg-blue-700"
              >
                Start reading now
              </Link>
            ) : (
              <button
                type="button"
                onClick={() => onBrowseLibrary?.()}
                className="inline-flex h-9 items-center rounded-full bg-blue-600 px-4 text-sm font-semibold text-white hover:bg-blue-700"
              >
                Open library
              </button>
            )}
          </div>
          <div className={`mt-3 rounded-xl border border-dashed p-3 text-xs ${isDarkLibraryTheme ? "border-slate-700 text-slate-300" : "border-blue-200 text-blue-800"}`}>
            Preview: weekly challenge progress, reading velocity, and personal records will appear here as soon as sessions are tracked.
          </div>
        </div>
      )}

      <div className="grid gap-4 sm:grid-cols-1 xl:grid-cols-1">
        <div className={`rounded-2xl border p-4 ${isDarkLibraryTheme ? "border-slate-700 bg-slate-900" : "border-gray-200 bg-white"}`}>
          <div className="flex items-center justify-between">
            <MetricTitle
              text="Reading Time"
              tooltip="Total tracked reading time in the selected range."
              isDarkLibraryTheme={isDarkLibraryTheme}
            />
            <Clock3 size={14} className={isDarkLibraryTheme ? "text-slate-400" : "text-gray-400"} />
          </div>
          <div className={`mt-2 text-3xl font-extrabold tracking-tight ${isDarkLibraryTheme ? "text-slate-100" : "text-[#1A1A2E]"}`}>
            {formatHours(totalSecondsForRange)}
          </div>
          <div className={`mt-1 text-sm ${isDarkLibraryTheme ? "text-slate-400" : "text-gray-500"}`}>
            {TIME_RANGE_OPTIONS.find((option) => option.value === timeRange)?.label}
          </div>
        </div>
      </div>

      <div className="mt-4 grid gap-4 lg:grid-cols-2">
        <div className={`rounded-2xl border p-4 ${isDarkLibraryTheme ? "border-slate-700 bg-slate-900" : "border-gray-200 bg-white"}`}>
          <div className="flex items-center justify-between gap-2">
            <MetricTitle
              text="Weekly challenge"
              tooltip="Goal: read 5 hours this week."
              isDarkLibraryTheme={isDarkLibraryTheme}
            />
            <Target size={15} className={isDarkLibraryTheme ? "text-slate-400" : "text-gray-400"} />
          </div>
          <div className={`mt-2 text-2xl font-extrabold ${isDarkLibraryTheme ? "text-slate-100" : "text-[#1A1A2E]"}`}>
            {formatHours(weeklyChallenge.weekSeconds)}
          </div>
          <div className={`mt-1 text-sm ${isDarkLibraryTheme ? "text-slate-400" : "text-gray-500"}`}>
            {weeklyChallenge.remaining > 0 ? `${formatDuration(weeklyChallenge.remaining)} to complete goal` : "Challenge complete"}
          </div>
          <div className={`mt-3 h-2 rounded-full ${isDarkLibraryTheme ? "bg-slate-800" : "bg-gray-100"}`}>
            <div className="h-full rounded-full bg-emerald-500 transition-all" style={{ width: `${weeklyChallenge.percent}%` }} />
          </div>
        </div>

        <div className={`rounded-2xl border p-4 ${isDarkLibraryTheme ? "border-slate-700 bg-slate-900" : "border-gray-200 bg-white"}`}>
          <div className="flex items-center justify-between gap-2">
            <MetricTitle
              text="Year in review"
              tooltip="Summary of reading progress for the current year."
              isDarkLibraryTheme={isDarkLibraryTheme}
            />
            <Sparkles size={15} className={isDarkLibraryTheme ? "text-slate-400" : "text-gray-400"} />
          </div>
          <div className={`mt-2 text-2xl font-extrabold ${isDarkLibraryTheme ? "text-slate-100" : "text-[#1A1A2E]"}`}>
            {yearSummary.year}
          </div>
          <div className={`mt-1 text-sm ${isDarkLibraryTheme ? "text-slate-400" : "text-gray-500"}`}>
            {yearSummaryText}
          </div>
        </div>
      </div>

      {(showActivityPanel || showStatusPanel) && (
        <div className={`mt-4 grid gap-4 ${showActivityPanel && showStatusPanel ? "xl:grid-cols-[1.45fr_1fr]" : "grid-cols-1"}`}>
          {showActivityPanel && (
            <div className={`rounded-2xl border p-4 ${isDarkLibraryTheme ? "border-slate-700 bg-slate-900" : "border-gray-200 bg-white"}`}>
              <div className="flex items-center justify-between gap-2">
                <div>
                  <h3 className={`text-sm font-bold ${isDarkLibraryTheme ? "text-slate-100" : "text-[#1A1A2E]"}`}>
                    Reading activity
                  </h3>
                  <p className={`mt-1 text-xs ${isDarkLibraryTheme ? "text-slate-400" : "text-gray-500"}`}>
                    Hover points for exact duration + books read
                  </p>
                </div>
                <Flame size={15} className={isDarkLibraryTheme ? "text-slate-400" : "text-gray-400"} />
              </div>

              {activityView === "line" ? (
                <div className={`mt-4 rounded-xl border p-3 ${isDarkLibraryTheme ? "border-slate-700 bg-slate-950/60" : "border-gray-200 bg-gray-50/70"}`}>
                  <svg
                    viewBox={`0 0 ${Math.max(220, chartDays.length * 18)} 100`}
                    preserveAspectRatio="none"
                    className="h-36 w-full"
                    aria-hidden="true"
                  >
                    <polyline
                      fill="none"
                      stroke={isDarkLibraryTheme ? "#60a5fa" : "#2563eb"}
                      strokeWidth="2.5"
                      strokeLinejoin="round"
                      strokeLinecap="round"
                      points={chartDays.map((day, index) => {
                        const width = Math.max(220, chartDays.length * 18);
                        const stepX = chartDays.length > 1 ? width / (chartDays.length - 1) : width;
                        const ratio = maxDaySeconds > 0 ? day.seconds / maxDaySeconds : 0;
                        const x = Number((index * stepX).toFixed(2));
                        const y = Number((90 - (ratio * 72)).toFixed(2));
                        return `${x},${y}`;
                      }).join(" ")}
                    />
                  </svg>
                  <div className={`mt-2 flex items-center justify-between text-[10px] font-semibold ${isDarkLibraryTheme ? "text-slate-400" : "text-gray-500"}`}>
                    <span>{chartDays[0]?.fullLabel || ""}</span>
                    <span>{chartDays[Math.floor(chartDays.length / 2)]?.fullLabel || ""}</span>
                    <span>{chartDays[chartDays.length - 1]?.fullLabel || ""}</span>
                  </div>
                </div>
              ) : (
                <div className="mt-5 grid grid-cols-7 sm:grid-cols-10 md:grid-cols-12 lg:grid-cols-15 gap-2">
                  {chartDays.map((day) => {
                    const intensity = maxDaySeconds > 0 ? day.seconds / maxDaySeconds : 0;
                    const heightPercent = maxDaySeconds > 0 ? Math.max(4, Math.round(intensity * 100)) : 0;
                    const tooltip = `${day.fullLabel}: ${formatDuration(day.seconds)}${day.bookTitles.length ? `\nBooks: ${day.bookTitles.join(", ")}` : ""}`;
                    return (
                      <div key={`bar-${day.key}`} className="flex flex-col items-center gap-1">
                        <div
                          className={`relative h-24 w-full rounded-full ${isDarkLibraryTheme ? "bg-slate-800" : "bg-gray-100"}`}
                          title={tooltip}
                        >
                          <div
                            className="absolute inset-x-0 bottom-0 rounded-full transition-all"
                            style={{
                              height: `${heightPercent}%`,
                              ...getBarFillStyle(isDarkLibraryTheme, intensity)
                            }}
                          />
                        </div>
                        <div className={`text-[10px] font-semibold ${isDarkLibraryTheme ? "text-slate-400" : "text-gray-500"}`}>
                          {day.dayLabel}
                        </div>
                      </div>
                    );
                  })}
                </div>
              )}
            </div>
          )}

          {showStatusPanel && (
            <div className={`rounded-2xl border p-4 ${isDarkLibraryTheme ? "border-slate-700 bg-slate-900" : "border-gray-200 bg-white"}`}>
              <div className="flex items-center justify-between gap-2">
                <div>
                  <h3 className={`text-sm font-bold ${isDarkLibraryTheme ? "text-slate-100" : "text-[#1A1A2E]"}`}>
                    Status distribution
                  </h3>
                  <p className={`mt-1 text-xs ${isDarkLibraryTheme ? "text-slate-400" : "text-gray-500"}`}>
                    Reading pipeline health
                  </p>
                </div>
                <BookOpen size={15} className={isDarkLibraryTheme ? "text-slate-400" : "text-gray-400"} />
              </div>
              <div className="mt-4 space-y-3">
                {statusBreakdown.map((status) => (
                  <div key={status.label}>
                    <div className="mb-1 flex items-center justify-between gap-2">
                      <span className={`inline-flex items-center rounded-full border px-2 py-0.5 text-[11px] font-semibold ${statusToneClasses[status.label]}`}>
                        {status.label}
                      </span>
                      <span className={`text-xs font-semibold ${isDarkLibraryTheme ? "text-slate-300" : "text-gray-600"}`}>
                        {status.count} ({status.percent}%)
                      </span>
                    </div>
                    <div className={`h-2 rounded-full ${isDarkLibraryTheme ? "bg-slate-800" : "bg-gray-100"}`}>
                      <div
                        className={`h-full rounded-full ${statusColorClasses[status.label]}`}
                        style={{ width: `${status.percent}%` }}
                      />
                    </div>
                  </div>
                ))}
              </div>
            </div>
          )}
        </div>
      )}

      {(showTopBooksPanel || showSessionsPanel) && (
        <div className={`mt-4 grid gap-4 ${showTopBooksPanel && showSessionsPanel ? "xl:grid-cols-[1.3fr_1fr]" : "grid-cols-1"}`}>
          {showTopBooksPanel && (
            <div className={`rounded-2xl border p-4 ${isDarkLibraryTheme ? "border-slate-700 bg-slate-900" : "border-gray-200 bg-white"}`}>
              <div className="flex items-center justify-between gap-2">
                <div>
                  <h3 className={`text-sm font-bold ${isDarkLibraryTheme ? "text-slate-100" : "text-[#1A1A2E]"}`}>
                    Top books
                  </h3>
                  <p className={`mt-1 text-xs ${isDarkLibraryTheme ? "text-slate-400" : "text-gray-500"}`}>
                    Ranked by reading time in selected range
                  </p>
                </div>
                <BookOpen size={15} className={isDarkLibraryTheme ? "text-slate-400" : "text-gray-400"} />
              </div>
              {topBooks.length === 0 ? (
                <div className={`mt-3 rounded-xl border border-dashed p-4 text-sm ${isDarkLibraryTheme ? "border-slate-700 text-slate-400" : "border-gray-200 text-gray-500"}`}>
                  No books tracked in this range.
                </div>
              ) : (
                <div className="mt-3 space-y-2.5">
                  {topBooks.map((book) => (
                    <Link
                      key={`stats-book-${book.id}`}
                      to={buildReaderPath(book.id)}
                      onClick={() => onOpenBook?.(book.id)}
                      className={`group flex items-center gap-3 rounded-xl border p-2.5 transition ${
                        isDarkLibraryTheme
                          ? "border-slate-700 bg-slate-900/80 hover:border-blue-500"
                          : "border-gray-200 bg-white hover:border-blue-200"
                      }`}
                    >
                      <div className={`h-12 w-10 shrink-0 overflow-hidden rounded-lg ${isDarkLibraryTheme ? "bg-slate-800" : "bg-gray-100"}`}>
                        {book.cover ? (
                          <img src={book.cover} alt={book.title} className="h-full w-full object-cover" />
                        ) : (
                          <div className={`flex h-full w-full items-center justify-center ${isDarkLibraryTheme ? "text-slate-500" : "text-gray-400"}`}>
                            <BookOpen size={14} />
                          </div>
                        )}
                      </div>
                      <div className="min-w-0 flex-1">
                        <div className={`truncate text-sm font-bold ${isDarkLibraryTheme ? "text-slate-100" : "text-[#1A1A2E]"}`}>
                          {book.title}
                        </div>
                        <div className={`mt-0.5 truncate text-xs ${isDarkLibraryTheme ? "text-slate-400" : "text-gray-500"}`}>
                          {book.author}
                        </div>
                        <div className={`mt-1 text-xs font-semibold ${isDarkLibraryTheme ? "text-blue-300" : "text-blue-600"}`}>
                          {formatDuration(book.trackedSeconds, { short: true })} • {clampProgress(book?.progress)}%
                        </div>
                      </div>
                    </Link>
                  ))}
                </div>
              )}
            </div>
          )}

          {showSessionsPanel && (
            <div className={`rounded-2xl border p-4 ${isDarkLibraryTheme ? "border-slate-700 bg-slate-900" : "border-gray-200 bg-white"}`}>
              <div className="flex items-center justify-between gap-2">
                <div>
                  <h3 className={`text-sm font-bold ${isDarkLibraryTheme ? "text-slate-100" : "text-[#1A1A2E]"}`}>
                    Best sessions
                  </h3>
                  <p className={`mt-1 text-xs ${isDarkLibraryTheme ? "text-slate-400" : "text-gray-500"}`}>
                    Longest sessions in selected range
                  </p>
                </div>
                <Timer size={15} className={isDarkLibraryTheme ? "text-slate-400" : "text-gray-400"} />
              </div>
              {topSessions.length === 0 ? (
                <div className={`mt-3 rounded-xl border border-dashed p-4 text-sm ${isDarkLibraryTheme ? "border-slate-700 text-slate-400" : "border-gray-200 text-gray-500"}`}>
                  No sessions tracked in this range.
                </div>
              ) : (
                <ol className="mt-3 space-y-2.5">
                  {topSessions.map((session, index) => (
                    <li
                      key={session.id}
                      className={`rounded-xl border px-3 py-2.5 ${
                        isDarkLibraryTheme ? "border-slate-700 bg-slate-900/80" : "border-gray-200 bg-white"
                      }`}
                    >
                      <div className="flex items-center justify-between gap-2">
                        <span className={`text-xs font-semibold ${isDarkLibraryTheme ? "text-slate-400" : "text-gray-500"}`}>
                          #{index + 1}
                        </span>
                        <span className={`text-xs font-semibold ${isDarkLibraryTheme ? "text-emerald-300" : "text-emerald-700"}`}>
                          {formatDuration(session.seconds, { short: true })}
                        </span>
                      </div>
                      <div className={`mt-1 truncate text-sm font-semibold ${isDarkLibraryTheme ? "text-slate-100" : "text-[#1A1A2E]"}`}>
                        {session.title}
                      </div>
                    </li>
                  ))}
                </ol>
              )}
            </div>
          )}
        </div>
      )}
    </section>
  );
}
