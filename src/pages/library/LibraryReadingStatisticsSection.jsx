import React, { useEffect, useMemo, useState } from "react";
import { Link } from "react-router-dom";
import {
  BadgeCheck,
  BookOpen,
  CalendarDays,
  ChartNoAxesColumnIncreasing,
  Clock3,
  FileText,
  Flame,
  Timer,
  Trophy,
} from "lucide-react";

const DAY_MS = 24 * 60 * 60 * 1000;

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
const READING_STATS_PREFS_KEY = "library-reading-statistics-preferences";

const normalizeNumber = (value) => {
  const parsed = Number(value);
  if (!Number.isFinite(parsed)) return 0;
  return parsed;
};

const clampProgress = (value) => Math.max(0, Math.min(100, Math.round(normalizeNumber(value))));

const formatDuration = (seconds, { short = false } = {}) => {
  const safeSeconds = Math.max(0, normalizeNumber(seconds));
  if (!safeSeconds) return short ? "0m" : "0 min";

  const minutes = Math.max(1, Math.round(safeSeconds / 60));
  const hours = Math.floor(minutes / 60);
  const remainingMinutes = minutes % 60;

  if (short) {
    if (hours <= 0) return `${minutes}m`;
    if (remainingMinutes === 0) return `${hours}h`;
    return `${hours}h ${remainingMinutes}m`;
  }

  if (hours <= 0) return `${minutes} min`;
  if (remainingMinutes === 0) return `${hours}h`;
  return `${hours}h ${remainingMinutes} min`;
};

const formatHours = (seconds) => {
  const safeSeconds = Math.max(0, normalizeNumber(seconds));
  if (!safeSeconds) return "0h";
  const hours = safeSeconds / 3600;
  if (hours >= 10) return `${Math.round(hours)}h`;
  return `${Math.round(hours * 10) / 10}h`;
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

const getChartDayCount = (range) => {
  if (range === "7d") return 7;
  if (range === "30d") return 30;
  if (range === "90d") return 30;
  return 14;
};

const buildLastNDays = (count) => {
  const days = [];
  const today = new Date();
  today.setHours(0, 0, 0, 0);

  for (let index = count - 1; index >= 0; index -= 1) {
    const day = new Date(today.getTime() - (index * DAY_MS));
    days.push({
      key: day.toISOString().slice(0, 10),
      dayLabel: day.toLocaleDateString(undefined, { weekday: "short" }).slice(0, 1),
      fullLabel: day.toLocaleDateString(undefined, { month: "short", day: "numeric" }),
      seconds: 0
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

const readStoredPreferences = () => {
  if (typeof window === "undefined") {
    return {
      timeRange: "30d",
      layoutMode: "dashboard",
      activityView: "bars"
    };
  }
  try {
    const raw = window.localStorage.getItem(READING_STATS_PREFS_KEY);
    if (!raw) {
      return {
        timeRange: "30d",
        layoutMode: "dashboard",
        activityView: "bars"
      };
    }
    const parsed = JSON.parse(raw);
    const timeRange = TIME_RANGE_OPTIONS.some((option) => option.value === parsed?.timeRange) ? parsed.timeRange : "30d";
    const layoutMode = LAYOUT_OPTIONS.some((option) => option.value === parsed?.layoutMode) ? parsed.layoutMode : "dashboard";
    const activityView = ACTIVITY_VIEWS.some((option) => option.value === parsed?.activityView) ? parsed.activityView : "bars";
    return { timeRange, layoutMode, activityView };
  } catch {
    return {
      timeRange: "30d",
      layoutMode: "dashboard",
      activityView: "bars"
    };
  }
};

export default function LibraryReadingStatisticsSection({
  isDarkLibraryTheme,
  books,
  buildReaderPath,
  onOpenBook
}) {
  const safeBooks = Array.isArray(books) ? books : [];
  const [preferences, setPreferences] = useState(() => readStoredPreferences());
  const { timeRange, layoutMode, activityView } = preferences;

  useEffect(() => {
    if (typeof window === "undefined") return;
    window.localStorage.setItem(READING_STATS_PREFS_KEY, JSON.stringify(preferences));
  }, [preferences]);

  const sessionRows = useMemo(() => (
    safeBooks.flatMap((book) => {
      const sessions = Array.isArray(book?.readingSessions) ? book.readingSessions : [];
      return sessions
        .map((session, index) => {
          const endMs = getSessionEndMs(session);
          if (!endMs) return null;
          return {
            id: `${book.id}-session-${index}-${endMs}`,
            bookId: book.id,
            title: book.title || "Untitled",
            seconds: Math.max(0, normalizeNumber(session?.seconds)),
            endMs
          };
        })
        .filter(Boolean);
    })
  ), [safeBooks]);

  const rangeStartMs = useMemo(() => getTimeRangeStartMs(timeRange), [timeRange]);

  const sessionsInRange = useMemo(
    () => sessionRows.filter((session) => !rangeStartMs || session.endMs >= rangeStartMs),
    [sessionRows, rangeStartMs]
  );

  const totalSecondsForRange = useMemo(() => {
    if (timeRange === "all") {
      return safeBooks.reduce((sum, book) => sum + Math.max(0, normalizeNumber(book?.readingTime)), 0);
    }
    return sessionsInRange.reduce((sum, session) => sum + session.seconds, 0);
  }, [safeBooks, sessionsInRange, timeRange]);

  const coreStats = useMemo(() => {
    const totalBooks = safeBooks.length;
    const finishedBooks = safeBooks.filter((book) => clampProgress(book?.progress) >= 100).length;
    const inProgressBooks = safeBooks.filter((book) => {
      const progress = clampProgress(book?.progress);
      return progress > 0 && progress < 100;
    }).length;
    const averageSessionSeconds = sessionsInRange.length
      ? Math.round(sessionsInRange.reduce((sum, row) => sum + row.seconds, 0) / sessionsInRange.length)
      : 0;
    const completedPages = safeBooks
      .filter((book) => clampProgress(book?.progress) >= 100)
      .reduce((sum, book) => sum + Math.max(0, Math.round(normalizeNumber(book?.estimatedPages))), 0);

    return {
      totalBooks,
      finishedBooks,
      inProgressBooks,
      completedPages,
      completionRate: totalBooks ? Math.round((finishedBooks / totalBooks) * 100) : 0,
      averageSessionSeconds,
      trackedSessions: sessionsInRange.length
    };
  }, [safeBooks, sessionsInRange]);

  const chartDays = useMemo(() => {
    const days = buildLastNDays(getChartDayCount(timeRange));
    const dayMap = new Map(days.map((day) => [day.key, day]));

    sessionsInRange.forEach((session) => {
      const key = new Date(session.endMs).toISOString().slice(0, 10);
      const target = dayMap.get(key);
      if (!target) return;
      target.seconds += session.seconds;
    });

    return days;
  }, [sessionsInRange, timeRange]);

  const maxDaySeconds = chartDays.reduce((max, day) => Math.max(max, day.seconds), 0);

  const chartLinePoints = useMemo(() => {
    if (!chartDays.length) return "";
    const width = Math.max(220, chartDays.length * 18);
    const stepX = chartDays.length > 1 ? width / (chartDays.length - 1) : width;
    return chartDays
      .map((day, index) => {
        const percent = maxDaySeconds > 0 ? day.seconds / maxDaySeconds : 0;
        const x = Number((index * stepX).toFixed(2));
        const y = Number((90 - (percent * 72)).toFixed(2));
        return `${x},${y}`;
      })
      .join(" ");
  }, [chartDays, maxDaySeconds]);

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
    if (timeRange === "all") {
      return [...safeBooks]
        .sort((left, right) => normalizeNumber(right?.readingTime) - normalizeNumber(left?.readingTime))
        .slice(0, 6)
        .map((book) => ({
          ...book,
          trackedSeconds: Math.max(0, normalizeNumber(book?.readingTime))
        }));
    }

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
  }, [safeBooks, sessionsInRange, timeRange]);

  const topSessions = useMemo(() => (
    [...sessionsInRange]
      .sort((left, right) => right.seconds - left.seconds)
      .slice(0, 5)
  ), [sessionsInRange]);

  const showActivityPanel = layoutMode !== "books";
  const showStatusPanel = true;
  const showTopBooksPanel = layoutMode !== "habits";
  const showSessionsPanel = layoutMode !== "books";

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
            Switch range, layout, and visualization style.
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

      <div className="grid gap-4 sm:grid-cols-2 xl:grid-cols-4">
        <div className={`rounded-2xl border p-4 ${isDarkLibraryTheme ? "border-slate-700 bg-slate-900" : "border-gray-200 bg-white"}`}>
          <div className="flex items-center justify-between">
            <div className={`text-xs font-semibold uppercase tracking-[0.14em] ${isDarkLibraryTheme ? "text-slate-400" : "text-gray-500"}`}>
              Reading Time
            </div>
            <Clock3 size={14} className={isDarkLibraryTheme ? "text-slate-400" : "text-gray-400"} />
          </div>
          <div className={`mt-2 text-3xl font-extrabold tracking-tight ${isDarkLibraryTheme ? "text-slate-100" : "text-[#1A1A2E]"}`}>
            {formatHours(totalSecondsForRange)}
          </div>
          <div className={`mt-1 text-sm ${isDarkLibraryTheme ? "text-slate-400" : "text-gray-500"}`}>
            {TIME_RANGE_OPTIONS.find((option) => option.value === timeRange)?.label}
          </div>
        </div>

        <div className={`rounded-2xl border p-4 ${isDarkLibraryTheme ? "border-slate-700 bg-slate-900" : "border-gray-200 bg-white"}`}>
          <div className="flex items-center justify-between">
            <div className={`text-xs font-semibold uppercase tracking-[0.14em] ${isDarkLibraryTheme ? "text-slate-400" : "text-gray-500"}`}>
              Completion
            </div>
            <BadgeCheck size={14} className={isDarkLibraryTheme ? "text-slate-400" : "text-gray-400"} />
          </div>
          <div className={`mt-2 text-3xl font-extrabold tracking-tight ${isDarkLibraryTheme ? "text-slate-100" : "text-[#1A1A2E]"}`}>
            {coreStats.finishedBooks}/{coreStats.totalBooks}
          </div>
          <div className={`mt-1 text-sm ${isDarkLibraryTheme ? "text-slate-400" : "text-gray-500"}`}>
            {coreStats.completionRate}% completed
          </div>
        </div>

        <div className={`rounded-2xl border p-4 ${isDarkLibraryTheme ? "border-slate-700 bg-slate-900" : "border-gray-200 bg-white"}`}>
          <div className="flex items-center justify-between">
            <div className={`text-xs font-semibold uppercase tracking-[0.14em] ${isDarkLibraryTheme ? "text-slate-400" : "text-gray-500"}`}>
              Pages Done
            </div>
            <FileText size={14} className={isDarkLibraryTheme ? "text-slate-400" : "text-gray-400"} />
          </div>
          <div className={`mt-2 text-3xl font-extrabold tracking-tight ${isDarkLibraryTheme ? "text-slate-100" : "text-[#1A1A2E]"}`}>
            {coreStats.completedPages}
          </div>
          <div className={`mt-1 text-sm ${isDarkLibraryTheme ? "text-slate-400" : "text-gray-500"}`}>
            Pages from completed books
          </div>
        </div>

        <div className={`rounded-2xl border p-4 ${isDarkLibraryTheme ? "border-slate-700 bg-slate-900" : "border-gray-200 bg-white"}`}>
          <div className="flex items-center justify-between">
            <div className={`text-xs font-semibold uppercase tracking-[0.14em] ${isDarkLibraryTheme ? "text-slate-400" : "text-gray-500"}`}>
              Avg Session
            </div>
            <Timer size={14} className={isDarkLibraryTheme ? "text-slate-400" : "text-gray-400"} />
          </div>
          <div className={`mt-2 text-3xl font-extrabold tracking-tight ${isDarkLibraryTheme ? "text-slate-100" : "text-[#1A1A2E]"}`}>
            {formatDuration(coreStats.averageSessionSeconds, { short: true })}
          </div>
          <div className={`mt-1 text-sm ${isDarkLibraryTheme ? "text-slate-400" : "text-gray-500"}`}>
            {coreStats.trackedSessions} sessions in range
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
                    {TIME_RANGE_OPTIONS.find((option) => option.value === timeRange)?.label}
                  </p>
                </div>
                <ChartNoAxesColumnIncreasing size={15} className={isDarkLibraryTheme ? "text-slate-400" : "text-gray-400"} />
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
                      points={chartLinePoints}
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
                    const percent = maxDaySeconds > 0 ? Math.max(8, Math.round((day.seconds / maxDaySeconds) * 100)) : 8;
                    const dayMinutes = Math.round(day.seconds / 60);
                    return (
                      <div key={day.key} className="flex flex-col items-center gap-1">
                        <div
                          className={`relative h-24 w-full rounded-full ${isDarkLibraryTheme ? "bg-slate-800" : "bg-gray-100"}`}
                          title={`${day.fullLabel}: ${dayMinutes} min`}
                        >
                          <div
                            className="absolute inset-x-0 bottom-0 rounded-full bg-blue-500 transition-all"
                            style={{ height: `${percent}%` }}
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
                <Trophy size={15} className={isDarkLibraryTheme ? "text-slate-400" : "text-gray-400"} />
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
                <CalendarDays size={15} className={isDarkLibraryTheme ? "text-slate-400" : "text-gray-400"} />
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
