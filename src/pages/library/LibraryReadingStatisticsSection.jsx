import React from "react";
import { BarChart3 } from "lucide-react";

export default function LibraryReadingStatisticsSection({ isDarkLibraryTheme }) {
  return (
    <section
      data-testid="library-reading-statistics-panel"
      className={`mb-4 rounded-2xl border p-6 md:p-8 ${
        isDarkLibraryTheme ? "border-slate-700 bg-slate-900/70" : "border-gray-200 bg-white"
      }`}
    >
      <div className="mx-auto max-w-6xl">
        <div className="rounded-2xl border border-dashed p-8 text-center md:p-12">
          <div
            className={`mx-auto inline-flex h-12 w-12 items-center justify-center rounded-full ${
              isDarkLibraryTheme ? "bg-slate-800 text-slate-300" : "bg-blue-50 text-blue-600"
            }`}
          >
            <BarChart3 size={20} />
          </div>
          <h3 className={`mt-4 text-xl font-bold ${isDarkLibraryTheme ? "text-slate-100" : "text-[#1A1A2E]"}`}>
            Reading Statistics
          </h3>
          <p className={`mt-2 text-sm ${isDarkLibraryTheme ? "text-slate-400" : "text-gray-500"}`}>
            Building your full analytics dashboard now.
          </p>
        </div>
      </div>
    </section>
  );
}
