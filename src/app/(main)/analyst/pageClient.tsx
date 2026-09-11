"use client";

import {
  AlertCircle,
  Bot,
  Check,
  ChevronDown,
  Copy,
  FolderPlus,
  HelpCircle,
  History,
  Info,
  Maximize2,
  Minimize2,
  PanelLeftClose,
  PanelLeftOpen,
  Plus,
  RefreshCw,
  Search,
  Send,
  Sparkles,
  Terminal,
  Trash2,
  TrendingDown,
  TrendingUp,
  User as UserIcon,
  Wand2,
  Zap,
} from "lucide-react";
import type React from "react";
import { useEffect, useRef, useState } from "react";
import { toast } from "sonner";
import {
  clearAnalystConversationAction,
  createAnalystConversationAction,
  deleteAnalystConversationAction,
  getAnalystConversationMessagesAction,
  sendAnalystMessageAction,
} from "@/actions/analyst.actions";
import { AnalystMessageContent } from "@/components/analyst/analyst-message-content";
import { GoogleLogo, MetaLogo } from "@/components/icons/platform-logos";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import { Spinner, TopProgressBar } from "@/components/ui/loading";
import { cn } from "@/lib/utils";

interface ConversationItem {
  id: string;
  title: string;
  adAccountId: number | null;
  updatedAt: Date | string;
  adAccount?: {
    id: number;
    name: string;
    googleAccountId: string;
  } | null;
}

interface MessageItem {
  id?: number;
  conversationId: string;
  role: "user" | "assistant" | "system";
  content: string;
  toolCalls?: any;
  toolResults?: any;
  createdAt: Date | string;
}

interface AccountItem {
  id: number;
  name: string;
  googleAccountId: string;
  currencyCode: string | null;
  isActive: boolean;
}

interface AnalystClientProps {
  initialConversations: ConversationItem[];
  accounts: AccountItem[];
}

const STARTER_PROMPTS = [
  {
    title: "Portfolio Health Check",
    prompt:
      "Analyse yesterday's agency portfolio spend and conversion performance. Are there any critical fires or wasted spend?",
    badge: "God View",
  },
  {
    title: "Search Term Waste Audit",
    prompt:
      "Identify the top wasted search terms with spend but zero conversions across active campaigns.",
    badge: "Wasted Spend",
  },
  {
    title: "Period Delta Comparison",
    prompt:
      "Compare this month's performance against the previous month with percentage deltas for CPA and ROAS.",
    badge: "Comparison",
  },
  {
    title: "Impression Share & Bottlenecks",
    prompt:
      "Audit our search impression share. Are campaigns rank-constrained or budget-constrained?",
    badge: "Auction Health",
  },
];

export default function AnalystClient({
  initialConversations,
  accounts,
}: AnalystClientProps) {
  const [conversations, setConversations] =
    useState<ConversationItem[]>(initialConversations);
  const [activeConversationId, setActiveConversationId] = useState<
    string | null
  >(initialConversations[0]?.id || null);
  const [messages, setMessages] = useState<MessageItem[]>([]);
  const [inputText, setInputText] = useState("");
  const [selectedAccountId, setSelectedAccountId] = useState<number | null>(
    null,
  );
  const [isLoadingMessages, setIsLoadingMessages] = useState(false);
  const [isSending, setIsSending] = useState(false);
  const [sidebarOpen, setSidebarOpen] = useState(true);
  const [conversationSearch, setConversationSearch] = useState("");
  const [activeToolsRunning, setActiveToolsRunning] = useState<string[]>([]);
  const [deleteConfirmId, setDeleteConfirmId] = useState<string | null>(null);
  const [copiedIndex, setCopiedIndex] = useState<number | null>(null);

  const messagesEndRef = useRef<HTMLDivElement>(null);
  const textareaRef = useRef<HTMLTextAreaElement>(null);

  const scrollToBottom = () => {
    messagesEndRef.current?.scrollIntoView({ behavior: "smooth" });
  };

  useEffect(() => {
    scrollToBottom();
  }, [messages, isSending, activeToolsRunning]);

  // Load messages when active conversation changes
  useEffect(() => {
    if (!activeConversationId) {
      setMessages([]);
      return;
    }

    let isMounted = true;
    const loadMessages = async () => {
      setIsLoadingMessages(true);
      try {
        const res =
          await getAnalystConversationMessagesAction(activeConversationId);
        if (res.success && res.data && isMounted) {
          setMessages(res.data.messages as MessageItem[]);
          if (res.data.conversation.adAccountId) {
            setSelectedAccountId(res.data.conversation.adAccountId);
          }
        }
      } catch (err) {
        console.error("Failed to load messages:", err);
      } finally {
        if (isMounted) setIsLoadingMessages(false);
      }
    };

    loadMessages();
    return () => {
      isMounted = false;
    };
  }, [activeConversationId]);

  const handleStartNewChat = async (accountId?: number | null) => {
    const defaultTitle = accountId
      ? `Analysis for ${accounts.find((a) => a.id === accountId)?.name || "Account"}`
      : "New Strategic Analysis";

    try {
      const res = await createAnalystConversationAction(
        defaultTitle,
        accountId,
      );
      if (res.success && res.data) {
        setConversations((prev) => [res.data as ConversationItem, ...prev]);
        setActiveConversationId(res.data.id);
        setMessages([]);
        if (accountId !== undefined) setSelectedAccountId(accountId);
        toast.success("New conversation started");
      }
    } catch (err) {
      toast.error("Failed to create conversation");
    }
  };

  const handleSendMessage = async (textToSend?: string) => {
    const text = (textToSend || inputText).trim();
    if (!text || isSending) return;

    let targetConvId = activeConversationId;
    if (!targetConvId) {
      const createRes = await createAnalystConversationAction(
        text.slice(0, 35) + "...",
        selectedAccountId,
      );
      if (createRes.success && createRes.data) {
        targetConvId = createRes.data.id;
        setConversations((prev) => [
          createRes.data as ConversationItem,
          ...prev,
        ]);
        setActiveConversationId(targetConvId);
      } else {
        toast.error("Failed to initiate conversation thread");
        return;
      }
    }

    const optimisticUserMessage: MessageItem = {
      conversationId: targetConvId,
      role: "user",
      content: text,
      createdAt: new Date().toISOString(),
    };

    setMessages((prev) => [...prev, optimisticUserMessage]);
    setInputText("");
    setIsSending(true);
    setActiveToolsRunning([
      "Formulating inquiry...",
      "Consulting analytical models...",
    ]);

    try {
      const res = await sendAnalystMessageAction({
        conversationId: targetConvId,
        content: text,
        selectedAccountId,
      });

      if (res.success && res.data) {
        const assistantMsg = res.data.assistantMessage as MessageItem;
        setMessages((prev) => [...prev, assistantMsg]);

        // Update conversation title if needed
        setConversations((prev) =>
          prev.map((c) =>
            c.id === targetConvId
              ? {
                  ...c,
                  title:
                    c.title === "New Analysis" ? text.slice(0, 35) : c.title,
                  updatedAt: new Date(),
                }
              : c,
          ),
        );
      } else {
        toast.error(res.error || "Failed to receive Analyst response");
      }
    } catch (err: any) {
      toast.error("An error occurred while communicating with the Analyst.");
    } finally {
      setIsSending(false);
      setActiveToolsRunning([]);
    }
  };

  const handleKeyDown = (e: React.KeyboardEvent<HTMLTextAreaElement>) => {
    if (e.key === "Enter" && !e.shiftKey) {
      e.preventDefault();
      handleSendMessage();
    }
  };

  const handleDeleteConversation = async (id: string) => {
    try {
      const res = await deleteAnalystConversationAction(id);
      if (res.success) {
        setConversations((prev) => prev.filter((c) => c.id !== id));
        if (activeConversationId === id) {
          const remaining = conversations.filter((c) => c.id !== id);
          setActiveConversationId(remaining[0]?.id || null);
        }
        toast.success("Conversation deleted");
      }
    } catch (err) {
      toast.error("Failed to delete conversation");
    } finally {
      setDeleteConfirmId(null);
    }
  };

  const handleClearHistory = async () => {
    if (!activeConversationId) return;
    try {
      const res = await clearAnalystConversationAction(activeConversationId);
      if (res.success) {
        setMessages([]);
        toast.success("Messages cleared");
      }
    } catch (err) {
      toast.error("Failed to clear messages");
    }
  };

  const handleCopyMessage = (content: string, index: number) => {
    navigator.clipboard.writeText(content);
    setCopiedIndex(index);
    setTimeout(() => setCopiedIndex(null), 2000);
    toast.success("Message copied to clipboard");
  };

  const filteredConversations = conversations.filter((c) =>
    c.title.toLowerCase().includes(conversationSearch.toLowerCase()),
  );

  const selectedAccountObj = accounts.find((a) => a.id === selectedAccountId);

  return (
    <div className="flex h-full min-h-0 w-full overflow-hidden bg-slate-50/70">
      <TopProgressBar loading={isSending || isLoadingMessages} />

      {/* ─── LEFT SIDEBAR: CONVERSATION SESSIONS ──────────────────────────────── */}
      <aside
        className={cn(
          "flex flex-col border-r border-slate-200 bg-white transition-all duration-300 z-10 shrink-0",
          sidebarOpen ? "w-80" : "w-0 overflow-hidden border-none",
        )}
      >
        <div className="p-4 border-b border-slate-100 flex items-center justify-between gap-2">
          <div className="flex items-center gap-2">
            <div className="h-8 w-8 rounded-xl bg-indigo-600 flex items-center justify-center text-white shadow-xs">
              <Bot className="h-4.5 w-4.5" />
            </div>
            <div>
              <h2 className="text-sm font-bold text-slate-900 leading-tight">
                Analyst
              </h2>
              <p className="text-[11px] font-medium text-slate-400">
                PPC Media Strategist
              </p>
            </div>
          </div>
          <Button
            size="sm"
            onClick={() => handleStartNewChat(selectedAccountId)}
            className="cursor-pointer gap-1.5 bg-slate-900 hover:bg-slate-800 text-white rounded-lg h-8 px-2.5 text-xs font-semibold shadow-xs"
          >
            <Plus className="h-3.5 w-3.5" />
            New
          </Button>
        </div>

        {/* Search threads */}
        <div className="p-3 border-b border-slate-100">
          <div className="relative">
            <Search className="absolute left-2.5 top-2.5 h-3.5 w-3.5 text-slate-400" />
            <input
              type="text"
              placeholder="Search analysis threads..."
              value={conversationSearch}
              onChange={(e) => setConversationSearch(e.target.value)}
              className="w-full pl-8 pr-3 py-1.5 text-xs bg-slate-50 border border-slate-200 rounded-lg focus:outline-none focus:ring-1 focus:ring-indigo-500 focus:bg-white transition-colors"
            />
          </div>
        </div>

        {/* Conversation List */}
        <div className="flex-1 overflow-y-auto p-2 space-y-1">
          {filteredConversations.length === 0 ? (
            <div className="p-6 text-center text-xs text-slate-400">
              No conversations found. Click \"New\" to start a session.
            </div>
          ) : (
            filteredConversations.map((conv) => {
              const isActive = conv.id === activeConversationId;
              return (
                <div
                  key={conv.id}
                  onClick={() => setActiveConversationId(conv.id)}
                  className={cn(
                    "group relative flex items-center justify-between p-2.5 rounded-xl text-xs font-medium cursor-pointer transition-all",
                    isActive
                      ? "bg-indigo-50/80 text-indigo-950 font-semibold shadow-xs border border-indigo-100"
                      : "text-slate-600 hover:bg-slate-100/70 hover:text-slate-900",
                  )}
                >
                  <div className="flex items-center gap-2.5 truncate pr-2">
                    <History
                      className={cn(
                        "h-3.5 w-3.5 shrink-0",
                        isActive ? "text-indigo-600" : "text-slate-400",
                      )}
                    />
                    <div className="truncate">
                      <p className="truncate text-xs">{conv.title}</p>
                      {conv.adAccount && (
                        <span className="text-[10px] text-slate-400 block truncate">
                          {conv.adAccount.name}
                        </span>
                      )}
                    </div>
                  </div>

                  <button
                    type="button"
                    onClick={(e) => {
                      e.stopPropagation();
                      setDeleteConfirmId(conv.id);
                    }}
                    className="opacity-0 group-hover:opacity-100 p-1 rounded-md text-slate-400 hover:text-red-600 hover:bg-red-50 transition-all cursor-pointer"
                    title="Delete thread"
                  >
                    <Trash2 className="h-3.5 w-3.5" />
                  </button>
                </div>
              );
            })
          )}
        </div>

        {/* Sidebar Footer */}
        <div className="p-3 border-t border-slate-100 bg-slate-50/50 flex items-center justify-between text-[11px] text-slate-400">
          <span>Powered by Gemini 3.5</span>
          <span className="inline-flex items-center gap-1 font-mono text-[10px] text-emerald-600 font-semibold bg-emerald-50 px-1.5 py-0.5 rounded border border-emerald-200">
            Live Database
          </span>
        </div>
      </aside>

      {/* ─── MAIN CHAT AREA ──────────────────────────────────────────────────── */}
      <main className="flex-1 flex flex-col h-full overflow-hidden bg-slate-50/50">
        {/* Top Control Bar */}
        <header className="h-14 bg-white border-b border-slate-200 px-4 flex items-center justify-between shrink-0 shadow-xs z-10">
          <div className="flex items-center gap-3">
            <Button
              variant="ghost"
              size="sm"
              onClick={() => setSidebarOpen(!sidebarOpen)}
              className="h-8 w-8 p-0 cursor-pointer text-slate-500 hover:text-slate-900"
              title={sidebarOpen ? "Collapse sidebar" : "Open sidebar"}
            >
              {sidebarOpen ? (
                <PanelLeftClose className="h-4 w-4" />
              ) : (
                <PanelLeftOpen className="h-4 w-4" />
              )}
            </Button>

            <div className="h-4 w-px bg-slate-200" />

            {/* Account Context Switcher */}
            <div className="flex items-center gap-2">
              <span className="text-xs font-semibold text-slate-500 hidden sm:inline">
                Scope:
              </span>
              <DropdownMenu>
                <DropdownMenuTrigger asChild>
                  <Button
                    variant="outline"
                    size="sm"
                    className="h-8 text-xs font-medium cursor-pointer border-slate-200 gap-1.5 max-w-[220px]"
                  >
                    {selectedAccountObj ? (
                      <>
                        <GoogleLogo className="h-3 w-3 shrink-0" />
                        <span className="truncate">
                          {selectedAccountObj.name}
                        </span>
                      </>
                    ) : (
                      <>
                        <Zap className="h-3 w-3 text-amber-500" />
                        <span>Entire Portfolio (God View)</span>
                      </>
                    )}
                    <ChevronDown className="h-3 w-3 text-slate-400 ml-auto shrink-0" />
                  </Button>
                </DropdownMenuTrigger>
                <DropdownMenuContent
                  align="start"
                  className="w-64 max-h-72 overflow-y-auto"
                >
                  <DropdownMenuItem
                    onClick={() => setSelectedAccountId(null)}
                    className="cursor-pointer text-xs font-semibold text-slate-900 gap-2"
                  >
                    <Zap className="h-3.5 w-3.5 text-amber-500" />
                    Entire Portfolio (God View)
                  </DropdownMenuItem>
                  {accounts.map((acc) => (
                    <DropdownMenuItem
                      key={acc.id}
                      onClick={() => setSelectedAccountId(acc.id)}
                      className="cursor-pointer text-xs gap-2"
                    >
                      <GoogleLogo className="h-3.5 w-3.5 shrink-0" />
                      <span className="truncate">{acc.name}</span>
                    </DropdownMenuItem>
                  ))}
                </DropdownMenuContent>
              </DropdownMenu>
            </div>
          </div>

          <div className="flex items-center gap-2">
            {messages.length > 0 && (
              <Button
                variant="ghost"
                size="sm"
                onClick={handleClearHistory}
                className="cursor-pointer text-slate-500 hover:text-red-600 text-xs h-8 px-2.5"
              >
                Clear History
              </Button>
            )}
            <Badge
              variant="outline"
              className="bg-indigo-50/60 text-indigo-700 border-indigo-200 text-[11px] font-semibold gap-1 py-1"
            >
              <Sparkles className="h-3 w-3 text-indigo-500" />
              Strategic Mode
            </Badge>
          </div>
        </header>

        {/* Message Stream */}
        <div className="flex-1 overflow-y-auto px-4 md:px-8 py-6 space-y-6">
          {messages.length === 0 ? (
            <div className="max-w-3xl mx-auto pt-10 flex flex-col items-center text-center">
              <div className="h-16 w-16 rounded-2xl bg-gradient-to-tr from-indigo-600 to-indigo-500 flex items-center justify-center text-white shadow-lg shadow-indigo-500/20 mb-5">
                <Bot className="h-9 w-9" />
              </div>
              <h1 className="text-2xl font-black text-slate-900 tracking-tight">
                Paid Media Strategic Analyst
              </h1>
              <p className="text-sm text-slate-500 max-w-md mt-2 leading-relaxed">
                Direct access to real-time Google and Meta Ads performance,
                wasted search terms, macro god view fires, and account
                anomalies.
              </p>

              {/* Starter Prompt Cards */}
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-3 w-full max-w-2xl mt-8 text-left">
                {STARTER_PROMPTS.map((item, idx) => (
                  <button
                    key={idx}
                    type="button"
                    onClick={() => handleSendMessage(item.prompt)}
                    className="p-4 rounded-xl border border-slate-200 bg-white hover:border-indigo-300 hover:shadow-md transition-all cursor-pointer group flex flex-col justify-between"
                  >
                    <div>
                      <span className="text-[10px] font-bold uppercase tracking-wider text-indigo-600 bg-indigo-50 px-2 py-0.5 rounded border border-indigo-100">
                        {item.badge}
                      </span>
                      <h3 className="text-xs font-bold text-slate-900 mt-2 group-hover:text-indigo-600 transition-colors">
                        {item.title}
                      </h3>
                      <p className="text-[11px] text-slate-500 mt-1 leading-normal line-clamp-2">
                        {item.prompt}
                      </p>
                    </div>
                  </button>
                ))}
              </div>
            </div>
          ) : (
            <div className="max-w-4xl mx-auto space-y-6">
              {messages.map((msg, index) => {
                const isUser = msg.role === "user";
                return (
                  <div
                    key={msg.id || index}
                    className={cn(
                      "flex gap-3 group",
                      isUser ? "justify-end" : "justify-start",
                    )}
                  >
                    {!isUser && (
                      <div className="h-8 w-8 rounded-xl bg-indigo-600 flex items-center justify-center text-white shrink-0 mt-0.5 shadow-xs">
                        <Bot className="h-4 w-4" />
                      </div>
                    )}

                    <div
                      className={cn(
                        "relative rounded-2xl text-xs leading-relaxed transition-all",
                        isUser
                          ? "bg-slate-900 text-white rounded-tr-none shadow-sm p-4 max-w-[80%]"
                          : "bg-white text-slate-800 rounded-tl-none border border-slate-200/80 shadow-xs p-5 sm:p-6 w-full max-w-4xl",
                      )}
                    >
                      {/* Tool invocations badge if tools were executed */}
                      {msg.toolCalls &&
                        Array.isArray(msg.toolCalls) &&
                        msg.toolCalls.length > 0 && (
                          <div className="mb-4 pb-3 border-b border-slate-100 flex items-center justify-between flex-wrap gap-2">
                            <div className="flex items-center gap-1.5 flex-wrap">
                              <span className="text-[10px] font-semibold text-slate-400 uppercase tracking-wider mr-0.5">
                                Verified Tools:
                              </span>
                              {msg.toolCalls.map((tc: any, i: number) => (
                                <span
                                  key={i}
                                  className="inline-flex items-center gap-1 font-mono text-[10px] font-medium bg-slate-50 text-slate-600 px-2 py-0.5 rounded-md border border-slate-200/80"
                                >
                                  <Terminal className="h-2.5 w-2.5 text-indigo-500" />
                                  {tc.name}
                                </span>
                              ))}
                            </div>
                          </div>
                        )}

                      {/* Rich Content Body */}
                      <AnalystMessageContent
                        content={msg.content}
                        isUser={isUser}
                        onQuickAction={(action) => handleSendMessage(action)}
                      />

                      {/* Message Actions */}
                      {!isUser && (
                        <div className="mt-4 pt-3 border-t border-slate-100/80 flex items-center justify-between opacity-0 group-hover:opacity-100 transition-opacity">
                          <span className="text-[10px] text-slate-400 font-mono">
                            Strategic Paid Media AI
                          </span>
                          <button
                            type="button"
                            onClick={() =>
                              handleCopyMessage(msg.content, index)
                            }
                            className="inline-flex items-center gap-1 text-[11px] font-medium text-slate-400 hover:text-slate-700 cursor-pointer transition-colors"
                          >
                            {copiedIndex === index ? (
                              <>
                                <Check className="h-3 w-3 text-emerald-600" />
                                <span className="text-emerald-600">Copied</span>
                              </>
                            ) : (
                              <>
                                <Copy className="h-3 w-3" />
                                <span>Copy Analysis</span>
                              </>
                            )}
                          </button>
                        </div>
                      )}
                    </div>

                    {isUser && (
                      <div className="h-8 w-8 rounded-xl bg-slate-200 flex items-center justify-center text-slate-700 shrink-0 mt-0.5 font-bold text-xs">
                        U
                      </div>
                    )}
                  </div>
                );
              })}

              {/* Gemini-Inspired Dynamic Loading State */}
              {isSending && (
                <div className="flex gap-3 justify-start max-w-4xl mx-auto">
                  <div className="h-8 w-8 rounded-xl bg-indigo-600 flex items-center justify-center text-white shrink-0 shadow-xs mt-0.5">
                    <Bot className="h-4 w-4" />
                  </div>
                  <div className="bg-slate-50/90 border border-slate-200/90 rounded-2xl rounded-tl-none p-4 shadow-2xs space-y-2 max-w-md w-full">
                    <div className="flex items-center justify-between gap-3">
                      <div>
                        <div className="text-xs font-semibold text-slate-900 flex items-center gap-1.5">
                          <Sparkles className="h-3.5 w-3.5 text-indigo-600 animate-pulse" />
                          <span>Analysing media performance...</span>
                        </div>
                        <div className="text-[11px] text-slate-400 mt-0.5 italic">
                          Querying live account metrics and cross-referencing
                          baselines
                        </div>
                      </div>
                      <div className="h-4.5 w-4.5 rounded-full border-2 border-indigo-600/20 border-t-indigo-600 animate-spin shrink-0" />
                    </div>

                    {activeToolsRunning.length > 0 && (
                      <div className="flex flex-wrap gap-1.5 pt-1.5 border-t border-slate-200/60">
                        {activeToolsRunning.map((item, idx) => (
                          <span
                            key={idx}
                            className="inline-flex items-center gap-1 text-[10px] font-mono text-slate-600 bg-white px-2 py-0.5 rounded border border-slate-200"
                          >
                            <Terminal className="h-2.5 w-2.5 text-indigo-500" />
                            {item}
                          </span>
                        ))}
                      </div>
                    )}
                  </div>
                </div>
              )}

              <div ref={messagesEndRef} />
            </div>
          )}
        </div>

        {/* Bottom Input Area */}
        <footer className="p-4 bg-white border-t border-slate-200 shrink-0">
          <div className="max-w-4xl mx-auto">
            <div className="relative rounded-xl border border-slate-200 shadow-xs bg-white focus-within:border-indigo-500 focus-within:ring-1 focus-within:ring-indigo-500 transition-all">
              <textarea
                ref={textareaRef}
                rows={2}
                value={inputText}
                onChange={(e) => setInputText(e.target.value)}
                onKeyDown={handleKeyDown}
                placeholder={
                  selectedAccountObj
                    ? `Ask Analyst about ${selectedAccountObj.name} (e.g. "What were our top 5 wasted queries this month?")...`
                    : "Ask Analyst about agency portfolio health, CPA trends, or specific client accounts..."
                }
                className="w-full px-3.5 py-2.5 text-xs text-slate-900 bg-transparent resize-none focus:outline-none placeholder:text-slate-400"
              />

              <div className="px-3 py-2 bg-slate-50/70 border-t border-slate-100 rounded-b-xl flex items-center justify-between">
                <div className="flex items-center gap-2 text-[11px] text-slate-400">
                  <span className="hidden sm:inline">
                    Press Enter to send, Shift+Enter for new line
                  </span>
                </div>
                <Button
                  size="sm"
                  disabled={!inputText.trim() || isSending}
                  onClick={() => handleSendMessage()}
                  className="h-7 px-3 text-xs font-semibold cursor-pointer gap-1.5 bg-indigo-600 hover:bg-indigo-700 text-white rounded-lg shadow-xs transition-all disabled:opacity-50"
                >
                  {isSending ? (
                    <Spinner className="h-3 w-3" />
                  ) : (
                    <>
                      <span>Analyze</span>
                      <Send className="h-3 w-3" />
                    </>
                  )}
                </Button>
              </div>
            </div>
          </div>
        </footer>
      </main>

      {/* Delete Confirmation Dialog */}
      <Dialog
        open={!!deleteConfirmId}
        onOpenChange={(open) => !open && setDeleteConfirmId(null)}
      >
        <DialogContent className="max-w-md">
          <DialogHeader>
            <DialogTitle className="text-sm font-bold">
              Delete Conversation Thread
            </DialogTitle>
            <DialogDescription className="text-xs text-slate-500">
              Are you sure you want to permanently delete this analysis thread?
              This action cannot be undone.
            </DialogDescription>
          </DialogHeader>
          <DialogFooter className="gap-2 sm:gap-0 mt-4">
            <Button
              variant="outline"
              size="sm"
              onClick={() => setDeleteConfirmId(null)}
              className="text-xs cursor-pointer"
            >
              Cancel
            </Button>
            <Button
              variant="destructive"
              size="sm"
              onClick={() =>
                deleteConfirmId && handleDeleteConversation(deleteConfirmId)
              }
              className="text-xs cursor-pointer"
            >
              Delete
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}
