"use client";

import {
  endOfMonth,
  format,
  parseISO,
  startOfMonth,
  subDays,
  subMonths,
} from "date-fns";
import { Calendar as CalendarIcon, ChevronDown } from "lucide-react";
import { useState } from "react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import {
  Popover,
  PopoverContent,
  PopoverTrigger,
} from "@/components/ui/popover";

interface DateRangePickerProps {
  startDate: string; // YYYY-MM-DD
  endDate: string; // YYYY-MM-DD
  onChange: (range: { startDate: string; endDate: string }) => void;
  className?: string;
}

export function DateRangePicker({
  startDate,
  endDate,
  onChange,
  className = "",
}: DateRangePickerProps) {
  const [open, setOpen] = useState(false);
  const [tempStart, setTempStart] = useState(startDate);
  const [tempEnd, setTempEnd] = useState(endDate);

  const formatDateLabel = (dateStr: string) => {
    try {
      if (!dateStr) return "";
      const d = parseISO(dateStr);
      return format(d, "dd MMM yyyy");
    } catch {
      return dateStr;
    }
  };

  const getPresetDates = (preset: string) => {
    const today = new Date();
    const todayStr = format(today, "yyyy-MM-dd");

    switch (preset) {
      case "today":
        return { startDate: todayStr, endDate: todayStr };
      case "yesterday": {
        const yestStr = format(subDays(today, 1), "yyyy-MM-dd");
        return { startDate: yestStr, endDate: yestStr };
      }
      case "last7":
        return {
          startDate: format(subDays(today, 6), "yyyy-MM-dd"),
          endDate: todayStr,
        };
      case "last14":
        return {
          startDate: format(subDays(today, 13), "yyyy-MM-dd"),
          endDate: todayStr,
        };
      case "last30":
        return {
          startDate: format(subDays(today, 29), "yyyy-MM-dd"),
          endDate: todayStr,
        };
      case "thisMonth":
        return {
          startDate: format(startOfMonth(today), "yyyy-MM-dd"),
          endDate: todayStr,
        };
      case "lastMonth": {
        const lastM = subMonths(today, 1);
        return {
          startDate: format(startOfMonth(lastM), "yyyy-MM-dd"),
          endDate: format(endOfMonth(lastM), "yyyy-MM-dd"),
        };
      }
      default:
        return { startDate, endDate };
    }
  };

  const handleApplyPreset = (presetKey: string) => {
    const range = getPresetDates(presetKey);
    setTempStart(range.startDate);
    setTempEnd(range.endDate);
    onChange(range);
    setOpen(false);
  };

  const handleApplyCustom = () => {
    if (!tempStart || !tempEnd) return;
    if (tempStart > tempEnd) {
      onChange({ startDate: tempEnd, endDate: tempStart });
    } else {
      onChange({ startDate: tempStart, endDate: tempEnd });
    }
    setOpen(false);
  };

  const labelText = `${formatDateLabel(startDate)} – ${formatDateLabel(endDate)}`;

  return (
    <Popover open={open} onOpenChange={setOpen}>
      <PopoverTrigger asChild>
        <button
          type="button"
          className={`flex items-center gap-2 bg-white hover:bg-slate-50 text-slate-800 border border-slate-200 shadow-sm rounded-full px-4 py-2 text-xs font-bold cursor-pointer transition-all outline-none focus:ring-2 focus:ring-indigo-500/20 ${className}`}
        >
          <CalendarIcon className="h-4 w-4 text-indigo-600 shrink-0" />
          <span className="font-semibold text-slate-900 tracking-tight">
            {labelText}
          </span>
          <ChevronDown className="h-3.5 w-3.5 text-slate-400 shrink-0 ml-1" />
        </button>
      </PopoverTrigger>
      <PopoverContent align="end" className="w-80 p-4 space-y-4">
        <div className="flex items-center justify-between border-b border-slate-100 pb-2">
          <span className="text-xs font-bold text-slate-900 uppercase tracking-wider">
            Select Date Range
          </span>
        </div>

        {/* Quick Presets Grid */}
        <div className="grid grid-cols-2 gap-1.5">
          {[
            { key: "today", label: "Today" },
            { key: "yesterday", label: "Yesterday" },
            { key: "last7", label: "Last 7 Days" },
            { key: "last14", label: "Last 14 Days" },
            { key: "last30", label: "Last 30 Days" },
            { key: "thisMonth", label: "This Month" },
            { key: "lastMonth", label: "Last Month" },
          ].map((item) => (
            <button
              key={item.key}
              type="button"
              onClick={() => handleApplyPreset(item.key)}
              className="px-2.5 py-1.5 text-xs font-semibold text-slate-700 hover:text-indigo-600 hover:bg-indigo-50 rounded-lg text-left transition-colors cursor-pointer"
            >
              {item.label}
            </button>
          ))}
        </div>

        <div className="border-t border-slate-100 pt-3 space-y-3">
          <span className="text-[11px] font-bold text-slate-400 uppercase tracking-wider block">
            Custom Range
          </span>
          <div className="grid grid-cols-2 gap-2">
            <div>
              <label className="text-[10px] font-semibold text-slate-500 block mb-1">
                Start Date
              </label>
              <Input
                type="date"
                value={tempStart}
                onChange={(e) => setTempStart(e.target.value)}
                className="bg-slate-50 border-slate-200 text-xs h-8 rounded-lg"
              />
            </div>
            <div>
              <label className="text-[10px] font-semibold text-slate-500 block mb-1">
                End Date
              </label>
              <Input
                type="date"
                value={tempEnd}
                onChange={(e) => setTempEnd(e.target.value)}
                className="bg-slate-50 border-slate-200 text-xs h-8 rounded-lg"
              />
            </div>
          </div>

          <Button
            type="button"
            size="sm"
            onClick={handleApplyCustom}
            className="w-full bg-indigo-600 hover:bg-indigo-500 text-white font-bold text-xs h-8 rounded-lg shadow-sm cursor-pointer mt-1"
          >
            Apply Range
          </Button>
        </div>
      </PopoverContent>
    </Popover>
  );
}
