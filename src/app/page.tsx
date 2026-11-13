import { desc } from "drizzle-orm";
import {
  Activity,
  AlertTriangle,
  ArrowUpRight,
  Bot,
  Crown,
  Database,
  Gauge,
  HeartPulse,
  Medal,
  MessageSquare,
  Mic,
  Server,
  TerminalSquare,
  Trophy,
  Users,
} from "lucide-react";
import { getDb } from "@/db";
import { userStats } from "@/db/schema";
import { getBotStatus } from "@/bot/status";

export const dynamic = "force-dynamic";

type UserStat = typeof userStats.$inferSelect;

type LeaderboardResult = {
  users: UserStat[];
  error: string | null;
  latencyMs: number | null;
  dbConfigured: boolean;
};

async function getLeaderboard(): Promise<LeaderboardResult> {
  const database = getDb();

  if (!database) {
    return {
      users: [],
      error: "Переменная окружения DATABASE_URL не задана",
      latencyMs: null,
      dbConfigured: false,
    };
  }

  const startedAt = Date.now();
  try {
    const users = await database.query.userStats.findMany({
      orderBy: [desc(userStats.messageCount)],
      limit: 10,
    });
    return {
      users,
      error: null,
      latencyMs: Date.now() - startedAt,
      dbConfigured: true,
    };
  } catch (error) {
    return {
      users: [],
      error: error instanceof Error ? error.message : String(error),
      latencyMs: null,
      dbConfigured: true,
    };
  }
}

function StatusDot({ tone }: { tone: "ok" | "warn" | "bad" }) {
  const color =
    tone === "ok"
      ? "bg-emerald-400 text-emerald-400/40"
      : tone === "warn"
        ? "bg-amber-400 text-amber-400/40"
        : "bg-rose-400 text-rose-400/40";
  return (
    <span className="relative inline-flex size-2.5">
      <span
        className={`absolute inline-flex size-full rounded-full ${color} animate-pulse-dot`}
      />
      <span
        className={`relative inline-flex size-2.5 rounded-full ${color.split(" ")[0]}`}
      />
    </span>
  );
}

function RankBadge({ rank }: { rank: number }) {
  if (rank === 1) {
    return (
      <span className="grid size-9 place-items-center rounded-xl bg-amber-400/15 text-amber-300 ring-1 ring-amber-300/30">
        <Crown className="size-4.5" strokeWidth={1.8} />
      </span>
    );
  }
  if (rank <= 3) {
    const tint =
      rank === 2
        ? "bg-zinc-300/10 text-zinc-300 ring-zinc-300/25"
        : "bg-orange-400/10 text-orange-300 ring-orange-300/25";
    return (
      <span className={`grid size-9 place-items-center rounded-xl ring-1 ${tint}`}>
        <Medal className="size-4.5" strokeWidth={1.8} />
      </span>
    );
  }
  return (
    <span className="grid size-9 place-items-center rounded-xl bg-white/[0.04] font-mono text-sm font-semibold text-zinc-500 ring-1 ring-white/10">
      {rank}
    </span>
  );
}

function MetricCard({
  icon: Icon,
  label,
  value,
  hint,
}: {
  icon: typeof Gauge;
  label: string;
  value: string;
  hint?: string;
}) {
  return (
    <div className="rounded-2xl border border-white/10 bg-white/[0.04] p-5 backdrop-blur-xl transition-colors duration-300 hover:border-white/20 hover:bg-white/[0.07]">
      <div className="flex items-center gap-2.5 text-zinc-400">
        <Icon className="size-4" strokeWidth={1.8} />
        <span className="text-[11px] font-medium uppercase tracking-[0.14em]">
          {label}
        </span>
      </div>
      <p className="mt-3 truncate font-mono text-lg font-medium text-zinc-50">
        {value}
      </p>
      {hint ? (
        <p className="mt-1 truncate font-mono text-xs text-zinc-500">{hint}</p>
      ) : null}
    </div>
  );
}

export default async function DashboardPage() {
  const [{ users, error, latencyMs, dbConfigured }, bot] = [
    await getLeaderboard(),
    getBotStatus(),
  ];

  const dbOk = dbConfigured && !error;
  const allOk = dbOk && bot.ready;
  const maxMessages = users[0]?.messageCount ?? 0;

  const generatedAt = new Intl.DateTimeFormat("ru-RU", {
    dateStyle: "long",
    timeStyle: "medium",
    timeZone: "UTC",
  }).format(new Date());

  return (
    <main className="relative min-h-screen overflow-hidden">
      {/* ambient background */}
      <div aria-hidden className="pointer-events-none fixed inset-0">
        <div className="absolute inset-0 bg-[radial-gradient(55%_45%_at_70%_-10%,rgba(245,197,66,0.10),transparent_65%)]" />
        <div className="absolute inset-0 bg-[radial-gradient(45%_40%_at_8%_110%,rgba(88,101,242,0.12),transparent_60%)]" />
        <div
          className={`absolute -top-32 right-[-10%] size-[34rem] rounded-full blur-3xl animate-float-slow ${
            allOk ? "bg-emerald-500/[0.06]" : "bg-amber-500/[0.08]"
          }`}
        />
        <div className="absolute inset-0 bg-[linear-gradient(rgba(161,161,170,0.045)_1px,transparent_1px),linear-gradient(90deg,rgba(161,161,170,0.045)_1px,transparent_1px)] bg-[size:64px_64px] [mask-image:radial-gradient(80%_60%_at_50%_35%,black,transparent)]" />
      </div>

      <div className="relative mx-auto flex min-h-screen w-full max-w-5xl flex-col px-6 py-8 sm:px-10">
        {/* header */}
        <header className="flex items-center justify-between gap-4">
          <div className="flex items-center gap-3">
            <div className="grid size-10 place-items-center rounded-xl border border-white/10 bg-white/[0.06] shadow-[inset_0_1px_0_rgba(255,255,255,0.08)]">
              <Bot className="size-5 text-amber-300" strokeWidth={1.8} />
            </div>
            <div className="leading-tight">
              <p className="text-sm font-semibold tracking-wide text-zinc-50">
                Appoez Dashboard
              </p>
              <p className="text-xs text-zinc-500">Discord Bot · Next.js · PostgreSQL</p>
            </div>
          </div>

          <div
            className={`flex items-center gap-2.5 rounded-full border px-4 py-1.5 text-xs font-medium backdrop-blur-md ${
              allOk
                ? "border-emerald-400/25 bg-emerald-400/10 text-emerald-300"
                : "border-amber-400/25 bg-amber-400/10 text-amber-300"
            }`}
          >
            <StatusDot tone={allOk ? "ok" : "warn"} />
            {allOk ? "Все системы в норме" : "Частичная деградация"}
          </div>
        </header>

        {/* hero */}
        <section className="mt-14 sm:mt-20">
          <p className="flex items-center gap-2 font-mono text-xs uppercase tracking-[0.3em] text-amber-300/80">
            <Trophy className="size-3.5" strokeWidth={1.8} />
            community leaderboard
          </p>
          <h1 className="mt-4 max-w-3xl text-[clamp(2.2rem,5.5vw,3.75rem)] font-bold leading-[1.02] tracking-tight">
            <span className="bg-gradient-to-b from-white via-white to-zinc-400 bg-clip-text text-transparent">
              Топ участников сервера
            </span>
          </h1>
          <p className="mt-5 max-w-xl text-base leading-relaxed text-zinc-400">
            Дашборд рендерится на сервере при каждом запросе: живая статистика
            из PostgreSQL и текущий статус Discord-бота.
          </p>
        </section>

        {/* metric cards */}
        <section className="mt-10 grid grid-cols-2 gap-4 lg:grid-cols-4">
          <MetricCard
            icon={Bot}
            label="Бот"
            value={
              bot.ready
                ? (bot.tag ?? "Онлайн")
                : bot.startupTriggered
                  ? "Запускается…"
                  : "Офлайн"
            }
            hint={
              bot.ready
                ? `серверов: ${bot.guilds}`
                : "Ожидание..."
            }
          />
          <MetricCard
            icon={Database}
            label="PostgreSQL"
            value={dbOk ? "Подключено" : dbConfigured ? "Ошибка" : "Не задано"}
            hint={
              dbOk
                ? `запрос за ${latencyMs} мс`
                : dbConfigured
                  ? "Проблемы с БД"
                  : "Настройка..."
            }
          />
          <MetricCard
            icon={Users}
            label="В рейтинге"
            value={String(users.length)}
            hint="участников с активностью"
          />
          <MetricCard
            icon={Gauge}
            label="Статус"
            value="Активен"
            hint="Система работает"
          />
        </section>

        {/* leaderboard */}
        <section className="mt-4 rounded-3xl border border-white/10 bg-gradient-to-b from-white/[0.07] to-white/[0.02] p-6 backdrop-blur-xl sm:p-8">
          <div className="flex items-center justify-between gap-4">
            <div className="flex items-center gap-3">
              <div className="grid size-11 place-items-center rounded-2xl bg-amber-400/10 text-amber-300">
                <MessageSquare className="size-5" strokeWidth={1.8} />
              </div>
              <div>
                <h2 className="text-sm font-semibold text-zinc-100">
                  Рейтинг по сообщениям
                </h2>
                <p className="text-xs text-zinc-500">топ-10 · обновляется вживую</p>
              </div>
            </div>
            {dbOk ? (
              <span className="flex items-center gap-2 text-xs font-medium text-emerald-300">
                <StatusDot tone="ok" /> live
              </span>
            ) : null}
          </div>

          <div className="mt-6 space-y-2.5">
            {users.length > 0 ? (
              users.map((user, index) => {
                const share =
                  maxMessages > 0
                    ? Math.max(4, Math.round((user.messageCount / maxMessages) * 100))
                    : 0;
                return (
                  <div
                    key={user.userId}
                    className="group relative overflow-hidden rounded-2xl border border-white/[0.06] bg-white/[0.03] p-4 transition-colors duration-300 hover:border-amber-300/20 hover:bg-white/[0.05]"
                  >
                    <div
                      aria-hidden
                      className="absolute inset-y-0 left-0 bg-gradient-to-r from-amber-400/[0.09] to-transparent transition-all duration-500"
                      style={{ width: `${share}%` }}
                    />
                    <div className="relative flex items-center justify-between gap-4">
                      <div className="flex min-w-0 items-center gap-4">
                        <RankBadge rank={index + 1} />
                        <div className="min-w-0">
                          <p className="truncate font-mono text-sm font-medium text-zinc-100 sm:text-base">
                            {user.userId}
                          </p>
                          <p className="mt-0.5 flex items-center gap-1.5 text-xs text-zinc-500">
                            <Mic className="size-3" strokeWidth={1.8} />
                            {user.voiceMinutes} мин в войсе
                          </p>
                        </div>
                      </div>
                      <div className="shrink-0 text-right">
                        <p className="text-xl font-bold text-amber-300 sm:text-2xl">
                          {user.messageCount.toLocaleString("ru-RU")}
                        </p>
                        <p className="text-[10px] uppercase tracking-[0.15em] text-zinc-500">
                          сообщений
                        </p>
                      </div>
                    </div>
                  </div>
                );
              })
            ) : (
              <div className="rounded-2xl border border-dashed border-white/10 bg-white/[0.02] p-10 text-center">
                <Users className="mx-auto size-8 text-zinc-600" strokeWidth={1.5} />
                <p className="mt-4 text-sm text-zinc-400">
                  {error
                    ? "Не удалось загрузить статистику из базы данных."
                    : "Пока нет данных — статистика появится после первых сообщений."}
                </p>
              </div>
            )}
          </div>
        </section>

        {/* diagnostics — only when something is wrong */}
        {error ? (
          <section className="mt-4 rounded-3xl border border-amber-400/20 bg-amber-400/[0.06] p-7 backdrop-blur-xl">
            <div className="flex items-center gap-3">
              <AlertTriangle className="size-5 text-amber-300" strokeWidth={1.8} />
              <h2 className="text-sm font-semibold text-amber-200">
                Диагностика подключения
              </h2>
            </div>
            <p className="mt-4 rounded-xl bg-black/30 px-4 py-3 font-mono text-xs leading-relaxed text-amber-100/80">
              {error}
            </p>
            <ol className="mt-5 space-y-3.5 text-sm leading-relaxed text-zinc-300">
              {[
                "Обратитесь к администратору для проверки переменных окружения.",
                "Проверьте работоспособность базы данных.",
                "Попробуйте перезагрузить страницу через несколько минут.",
              ].map((step, index) => (
                <li key={index} className="flex gap-3.5">
                  <span className="grid size-6 shrink-0 place-items-center rounded-full border border-amber-300/25 bg-amber-300/10 font-mono text-[11px] font-semibold text-amber-200">
                    {index + 1}
                  </span>
                  <span>{step}</span>
                </li>
              ))}
            </ol>
          </section>
        ) : null}

        {/* footer */}
        <footer className="mt-auto flex flex-wrap items-center justify-between gap-4 pt-14 pb-2 text-xs text-zinc-500">
          <div className="flex items-center gap-2">
            <HeartPulse className="size-3.5" strokeWidth={1.8} />
            <span>UTC · {generatedAt}</span>
          </div>
          <div className="flex items-center gap-3">
            <a
              href="/api/health"
              className="group flex items-center gap-1.5 rounded-full border border-white/10 bg-white/[0.04] px-3.5 py-1.5 font-medium text-zinc-300 transition-colors hover:border-amber-300/30 hover:text-amber-200"
            >
              <Activity className="size-3.5" strokeWidth={1.8} />
              /api/health
              <ArrowUpRight className="size-3.5 transition-transform duration-300 group-hover:-translate-y-0.5 group-hover:translate-x-0.5" />
            </a>
            <a
              href="/api/bot-start"
              className="group flex items-center gap-1.5 rounded-full border border-white/10 bg-white/[0.04] px-3.5 py-1.5 font-medium text-zinc-300 transition-colors hover:border-indigo-300/30 hover:text-indigo-200"
            >
              <TerminalSquare className="size-3.5" strokeWidth={1.8} />
              /api/bot-start
              <ArrowUpRight className="size-3.5 transition-transform duration-300 group-hover:-translate-y-0.5 group-hover:translate-x-0.5" />
            </a>
          </div>
          <span className="flex items-center gap-2">
            <Server className="size-3.5" strokeWidth={1.8} />
            Community Edition
          </span>
        </footer>
      </div>
    </main>
  );
}
