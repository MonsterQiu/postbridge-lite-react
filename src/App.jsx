import { useEffect, useMemo, useRef, useState } from "react";
import "./App.css";

const LOCAL_KEY_API = "pbl_react_api_base";
const LOCAL_KEY_PROFILE = "pbl_react_profile";

const readLocalStorage = (key) => {
  if (typeof window === "undefined") return "";
  try {
    return localStorage.getItem(key) || "";
  } catch {
    return "";
  }
};

const sanitizeApiBase = (text) => (text || "").trim().replace(/\/$/, "");

const initialApiBase = () => {
  const saved = sanitizeApiBase(readLocalStorage(LOCAL_KEY_API));
  if (saved) return saved;

  const envBase = sanitizeApiBase(import.meta.env.VITE_API_BASE || "");
  if (envBase) return envBase;

  return "http://127.0.0.1:8787";
};

const initialProfile = () => {
  const saved = (readLocalStorage(LOCAL_KEY_PROFILE) || "").trim();
  return saved || "default";
};

const getRouteInfo = () => {
  if (typeof window === "undefined") {
    return { path: "/", code: "", state: "", error: "", errorDescription: "" };
  }

  const rawPath = window.location.pathname || "/";
  const path = rawPath.replace(/\/+$/, "") || "/";
  const query = new URLSearchParams(window.location.search || "");

  return {
    path,
    code: query.get("code") || "",
    state: query.get("state") || "",
    error: query.get("error") || "",
    errorDescription: query.get("error_description") || "",
  };
};

const isoLocalInput = (date = new Date(Date.now() + 5 * 60 * 1000)) => {
  const pad = (n) => `${n}`.padStart(2, "0");
  const y = date.getFullYear();
  const m = pad(date.getMonth() + 1);
  const d = pad(date.getDate());
  const h = pad(date.getHours());
  const min = pad(date.getMinutes());
  return `${y}-${m}-${d}T${h}:${min}`;
};

const toIsoSecond = (localText) => {
  if (!localText) {
    return new Date().toISOString().slice(0, 19);
  }
  const dt = new Date(localText);
  if (Number.isNaN(dt.getTime())) {
    return new Date().toISOString().slice(0, 19);
  }
  return dt.toISOString().slice(0, 19);
};

const fmtNow = () =>
  new Date().toLocaleString("zh-CN", {
    hour12: false,
  });

function App() {
  const route = useMemo(() => getRouteInfo(), []);
  const isTermsRoute = route.path === "/terms";
  const isPrivacyRoute = route.path === "/privacy";
  const isCallbackRoute = route.path === "/tiktok/callback";

  const [apiBase, setApiBase] = useState(() => initialApiBase());
  const [profile, setProfile] = useState(() => initialProfile());

  const [health, setHealth] = useState({ ok: false, text: "未检测" });
  const [logText, setLogText] = useState("");

  const [authUrl, setAuthUrl] = useState("");
  const [authCode, setAuthCode] = useState("");

  const [mode, setMode] = useState("PULL_FROM_URL");
  const [scheduledAt, setScheduledAt] = useState(isoLocalInput());
  const [mediaUrl, setMediaUrl] = useState("");
  const [filePath, setFilePath] = useState("");
  const [title, setTitle] = useState("");
  const [privacyLevel, setPrivacyLevel] = useState("SELF_ONLY");
  const [chunkSize, setChunkSize] = useState(10000000);
  const [disableComment, setDisableComment] = useState(false);
  const [disableDuet, setDisableDuet] = useState(false);
  const [disableStitch, setDisableStitch] = useState(false);

  const [openclawJson, setOpenclawJson] = useState('{"tasks":[{"video_url":"https://example.com/demo.mp4","caption":"hello"}]}');
  const [openclawProfile, setOpenclawProfile] = useState(profile);
  const [openclawScheduledAt, setOpenclawScheduledAt] = useState("");

  const [maxJobs, setMaxJobs] = useState(20);
  const [autoRefreshSec, setAutoRefreshSec] = useState(10);
  const [autoRefreshOn, setAutoRefreshOn] = useState(false);
  const [dailyEnabled, setDailyEnabled] = useState(false);
  const [dailyTime, setDailyTime] = useState("10:00");
  const [dailyMaxJobs, setDailyMaxJobs] = useState(20);
  const [dailyLastRunAt, setDailyLastRunAt] = useState("");
  const [dailyNextRunAt, setDailyNextRunAt] = useState("");
  const [dailyLastResult, setDailyLastResult] = useState(null);

  const [accounts, setAccounts] = useState([]);
  const [posts, setPosts] = useState([]);
  const [postStatusFilter, setPostStatusFilter] = useState("");

  const [callbackCode, setCallbackCode] = useState(route.code);
  const [callbackState, setCallbackState] = useState(route.state);
  const [callbackError] = useState(route.error);
  const [callbackErrorDescription] = useState(route.errorDescription);
  const [callbackBusy, setCallbackBusy] = useState(false);
  const [callbackMessage, setCallbackMessage] = useState("");
  const [callbackResult, setCallbackResult] = useState(null);

  const timerRef = useRef(null);

  const base = useMemo(() => sanitizeApiBase(apiBase), [apiBase]);
  const redirectUri = useMemo(
    () => (typeof window !== "undefined" ? `${window.location.origin}/tiktok/callback` : ""),
    []
  );
  const termsUri = useMemo(
    () => (typeof window !== "undefined" ? `${window.location.origin}/terms` : ""),
    []
  );
  const privacyUri = useMemo(
    () => (typeof window !== "undefined" ? `${window.location.origin}/privacy` : ""),
    []
  );

  const appendLog = (message, payload) => {
    const line = `[${fmtNow()}] ${message}${payload ? `\n${JSON.stringify(payload, null, 2)}` : ""}\n\n`;
    setLogText((prev) => (line + prev).slice(0, 30000));
  };

  const copyText = async (text, label) => {
    if (!text.trim()) {
      appendLog(`复制失败：${label} 为空`);
      return;
    }
    if (typeof navigator === "undefined" || !navigator.clipboard) {
      appendLog("当前浏览器不支持 clipboard API");
      return;
    }
    await navigator.clipboard.writeText(text);
    appendLog(`已复制：${label}`);
  };

  const saveConfig = () => {
    if (typeof window !== "undefined") {
      localStorage.setItem(LOCAL_KEY_API, base);
      localStorage.setItem(LOCAL_KEY_PROFILE, profile.trim() || "default");
    }
    appendLog(`配置已保存：${base}, profile=${profile || "default"}`);
  };

  const request = async (path, options = {}) => {
    const endpoint = path.startsWith("http") ? path : `${base}${path}`;
    if (!endpoint.startsWith("http")) {
      throw new Error("API Base 未配置，请先填写可访问的 https/http 地址");
    }

    const resp = await fetch(endpoint, {
      method: options.method || "GET",
      headers: { "Content-Type": "application/json" },
      body: options.body ? JSON.stringify(options.body) : null,
    });
    const text = await resp.text();
    let data = {};
    if (text) {
      try {
        data = JSON.parse(text);
      } catch {
        throw new Error(`HTTP ${resp.status}: ${text}`);
      }
    }
    if (!resp.ok) {
      throw new Error(data.error || `HTTP ${resp.status}`);
    }
    return data;
  };

  const runSafely = async (fn) => {
    try {
      await fn();
    } catch (err) {
      appendLog(`操作失败: ${err.message}`);
    }
  };

  const checkHealth = async () => {
    await request("/health");
    setHealth({ ok: true, text: "服务在线" });
    appendLog("健康检查通过");
  };

  const loadAccounts = async () => {
    const data = await request("/api/v1/accounts");
    setAccounts(data.items || []);
  };

  const loadPosts = async () => {
    const query = new URLSearchParams({ limit: "100" });
    if (postStatusFilter) query.set("status", postStatusFilter);
    const data = await request(`/api/v1/posts?${query.toString()}`);
    setPosts(data.items || []);
  };

  const loadScheduler = async () => {
    const data = await request("/api/v1/scheduler");
    setDailyEnabled(Boolean(data.enabled));
    setDailyTime(String(data.time_hhmm || "10:00"));
    setDailyMaxJobs(Number(data.max_jobs || 20));
    setDailyLastRunAt(String(data.last_run_at || ""));
    setDailyNextRunAt(String(data.next_run_at || ""));
    setDailyLastResult(data.last_result || null);
  };

  const loadAll = async () => {
    await Promise.all([loadAccounts(), loadPosts(), loadScheduler()]);
  };

  const handleAuthUrl = async (openWindow = false) => {
    const data = await request("/api/v1/tiktok/auth-url", { method: "POST", body: {} });
    const url = data.authorize_url || "";
    setAuthUrl(url);
    appendLog("已生成授权链接", data);

    if (openWindow && url && typeof window !== "undefined") {
      window.open(url, "_blank", "noopener,noreferrer");
    }
  };

  const exchangeWithCode = async (codeText) => {
    const code = codeText.trim();
    if (!code) {
      throw new Error("code 不能为空");
    }

    const data = await request("/api/v1/tiktok/exchange-token", {
      method: "POST",
      body: { code, profile: profile.trim() || "default" },
    });
    appendLog("换取 Token 成功", data);
    await loadAccounts();
    return data;
  };

  const handleExchange = async () => {
    if (!authCode.trim()) {
      appendLog("请输入授权 code");
      return;
    }
    await exchangeWithCode(authCode);
  };

  const handleRefreshToken = async () => {
    const data = await request("/api/v1/tiktok/refresh-token", {
      method: "POST",
      body: { profile: profile.trim() || "default" },
    });
    appendLog("刷新 Token 成功", data);
    await loadAccounts();
  };

  const handleCreatePost = async () => {
    const payload = {
      title: title.trim(),
      privacy_level: privacyLevel,
      disable_comment: disableComment,
      disable_duet: disableDuet,
      disable_stitch: disableStitch,
      chunk_size: Number(chunkSize || 10000000),
    };

    if (mode === "PULL_FROM_URL") {
      if (!mediaUrl.trim()) {
        appendLog("请填写视频 URL");
        return;
      }
      payload.media_url = mediaUrl.trim();
    }

    if (mode === "FILE_UPLOAD") {
      if (!filePath.trim()) {
        appendLog("请填写文件路径");
        return;
      }
      payload.file_path = filePath.trim();
    }

    const body = {
      platform: "tiktok",
      profile: profile.trim() || "default",
      mode,
      scheduled_at: toIsoSecond(scheduledAt),
      payload,
    };

    const data = await request("/api/v1/posts", { method: "POST", body });
    appendLog("创建发布任务成功", data);
    await loadPosts();
  };

  const handleIngest = async () => {
    let parsed;
    try {
      parsed = JSON.parse(openclawJson);
    } catch (err) {
      appendLog(`OpenClaw JSON 解析失败: ${err.message}`);
      return;
    }

    const body = {
      ...parsed,
      profile: openclawProfile.trim() || profile.trim() || "default",
    };
    if (openclawScheduledAt) {
      body.scheduled_at = toIsoSecond(openclawScheduledAt);
    }

    const data = await request("/api/v1/openclaw/ingest", {
      method: "POST",
      body,
    });
    appendLog("OpenClaw 导入成功", data);
    await loadPosts();
  };

  const handleRunWorker = async () => {
    const data = await request("/api/v1/worker/run", {
      method: "POST",
      body: { max_jobs: Number(maxJobs || 20) },
    });
    appendLog("Worker 执行完成", data);
    await loadPosts();
    await loadScheduler();
  };

  const handleSaveScheduler = async () => {
    const body = {
      enabled: dailyEnabled,
      time_hhmm: dailyTime,
      max_jobs: Number(dailyMaxJobs || 20),
    };
    const data = await request("/api/v1/scheduler", {
      method: "POST",
      body,
    });
    appendLog("每日定时配置已更新", data);
    await loadScheduler();
  };

  const handleCallbackExchange = async () => {
    if (!callbackCode.trim()) {
      setCallbackMessage("回调 URL 里没有 code，无法换 token。");
      return;
    }

    setCallbackBusy(true);
    setCallbackMessage("");
    try {
      const data = await exchangeWithCode(callbackCode);
      setCallbackResult(data);
      setCallbackMessage("换取 Token 成功。可以返回控制台查看账号。 ");
    } catch (err) {
      setCallbackMessage(`换取失败：${err.message}`);
      throw err;
    } finally {
      setCallbackBusy(false);
    }
  };

  const toggleAutoRefresh = () => {
    if (autoRefreshOn) {
      setAutoRefreshOn(false);
      appendLog("已关闭自动刷新");
      return;
    }
    if (Number(autoRefreshSec) <= 0) {
      appendLog("自动刷新秒数必须 > 0");
      return;
    }
    setAutoRefreshOn(true);
    appendLog(`已开启自动刷新，每 ${autoRefreshSec} 秒`);
  };

  useEffect(() => {
    setOpenclawProfile(profile);
  }, [profile]);

  useEffect(() => {
    if (autoRefreshOn && !isCallbackRoute) {
      timerRef.current = setInterval(() => {
        runSafely(loadAll);
      }, Number(autoRefreshSec) * 1000);
    }
    return () => {
      if (timerRef.current) {
        clearInterval(timerRef.current);
        timerRef.current = null;
      }
    };
  }, [autoRefreshOn, autoRefreshSec, isCallbackRoute]);

  useEffect(() => {
    if (isCallbackRoute) {
      if (route.code) {
        setAuthCode(route.code);
        appendLog("检测到 TikTok 回调 code，可直接换取 token");
      }
      return;
    }

    runSafely(checkHealth);
    runSafely(loadAll);
  }, [isCallbackRoute]);

  const statusClass = (status) => {
    const s = (status || "").toLowerCase();
    return `tag ${s}`;
  };

  if (isTermsRoute || isPrivacyRoute) {
    const title = isTermsRoute ? "服务条款" : "隐私政策";
    const updated = "2026-02-15";
    return (
      <>
        <div className="backdrop backOne" />
        <div className="backdrop backTwo" />
        <main className="callbackWrap">
          <article className="panel callbackCard legalCard">
            <p className="eyebrow">athinker.net</p>
            <h1>{title}</h1>
            <p className="subtitle">最后更新：{updated}</p>

            {isTermsRoute ? (
              <div className="legalBody">
                <p>
                  本服务提供 TikTok OAuth 连接、发布任务创建、队列执行与日志查看能力。使用本服务即表示你同意按本条款使用。
                </p>
                <h2>1. 许可使用</h2>
                <ul className="legalList">
                  <li>你只能在合法合规场景中使用本服务。</li>
                  <li>你不得利用本服务发布违法、侵权、欺诈或骚扰内容。</li>
                  <li>你需要遵守 TikTok 平台政策与开发者规则。</li>
                </ul>
                <h2>2. 账号与安全</h2>
                <ul className="legalList">
                  <li>你应妥善保管账号访问权限，不得共享给未授权人员。</li>
                  <li>若发现异常访问，请立即停止使用并联系支持。</li>
                </ul>
                <h2>3. 服务变更</h2>
                <ul className="legalList">
                  <li>我们可根据法规、平台政策或技术变更调整服务功能。</li>
                  <li>我们可能对接口、配额或可用性进行必要维护。</li>
                </ul>
                <h2>4. 责任限制</h2>
                <ul className="legalList">
                  <li>你对发布内容及其后果承担全部责任。</li>
                  <li>本服务按“现状”提供，不承诺持续无中断或绝对无错误。</li>
                </ul>
                <h2>5. 联系方式</h2>
                <p>如需支持，请联系：support@athinker.net</p>
              </div>
            ) : (
              <div className="legalBody">
                <p>
                  本隐私政策说明我们如何收集、使用、存储和保护你在使用本服务时提供的信息。
                </p>
                <h2>1. 收集的信息</h2>
                <ul className="legalList">
                  <li>TikTok OAuth 返回的授权信息（如 open_id、access token、refresh token、scope）。</li>
                  <li>你主动提交的发布任务内容（标题、媒体地址、发布时间、任务状态）。</li>
                  <li>服务运行日志与错误信息（用于故障排查和审计）。</li>
                </ul>
                <h2>2. 使用目的</h2>
                <ul className="legalList">
                  <li>用于完成账号连接、内容发布、任务调度和结果查询。</li>
                  <li>用于安全审计、问题排查和服务质量改进。</li>
                </ul>
                <h2>3. 数据存储与保护</h2>
                <ul className="legalList">
                  <li>数据存储在你配置的后端环境中，默认不会公开展示。</li>
                  <li>我们建议启用 HTTPS、最小权限访问和定期密钥轮换。</li>
                </ul>
                <h2>4. 数据共享</h2>
                <ul className="legalList">
                  <li>除为实现发布功能向 TikTok API 传输必要信息外，我们不会主动向第三方出售你的数据。</li>
                  <li>法律法规要求时，我们可能依法配合提供必要数据。</li>
                </ul>
                <h2>5. 你的权利</h2>
                <ul className="legalList">
                  <li>你可随时停止使用服务并要求删除账号相关数据（在技术可行范围内）。</li>
                  <li>你可要求导出与你账号相关的主要操作记录。</li>
                </ul>
                <h2>6. 联系方式</h2>
                <p>如需隐私相关支持，请联系：privacy@athinker.net</p>
              </div>
            )}

            <div className="actions">
              <a className="btn btnGhost" href="/">返回控制台</a>
              <a className="btn btnGhost" href={termsUri}>服务条款 URL</a>
              <a className="btn btnGhost" href={privacyUri}>隐私政策 URL</a>
            </div>
          </article>
        </main>
      </>
    );
  }

  if (isCallbackRoute) {
    return (
      <>
        <div className="backdrop backOne" />
        <div className="backdrop backTwo" />

        <main className="callbackWrap">
          <article className="panel callbackCard">
            <p className="eyebrow">TikTok OAuth</p>
            <h1>回调已到达</h1>
            <p className="subtitle">确认 `API Base` 和 `Profile` 后，点击换取 Token。</p>

            <div className="grid two">
              <label>
                API Base
                <input value={apiBase} onChange={(e) => setApiBase(e.target.value)} placeholder="https://api.athinker.net" />
              </label>
              <label>
                Profile
                <input value={profile} onChange={(e) => setProfile(e.target.value)} placeholder="default" />
              </label>
            </div>

            <label>
              Redirect URI（TikTok 后台必须与此一致）
              <input readOnly value={redirectUri} />
            </label>

            <div className="actions">
              <button className="btn btnGhost" onClick={saveConfig}>保存配置</button>
              <button className="btn btnGhost" onClick={() => runSafely(() => checkHealth())}>检查后端</button>
              <button className="btn btnGhost" onClick={() => runSafely(() => copyText(redirectUri, "Redirect URI"))}>复制 Redirect URI</button>
            </div>

            {callbackError ? (
              <div className="warnBox">授权失败: {callbackErrorDescription || callbackError}</div>
            ) : null}

            <div className="grid two">
              <label>
                code
                <input value={callbackCode} onChange={(e) => setCallbackCode(e.target.value)} placeholder="回调 code" />
              </label>
              <label>
                state
                <input value={callbackState} onChange={(e) => setCallbackState(e.target.value)} placeholder="回调 state" />
              </label>
            </div>

            <div className="actions">
              <button className="btn" disabled={callbackBusy} onClick={() => runSafely(handleCallbackExchange)}>
                {callbackBusy ? "换取中..." : "换取 Token"}
              </button>
              <a className="btn btnGhost" href="/">返回控制台</a>
            </div>

            {callbackMessage ? <div className="metaBlock">{callbackMessage}</div> : null}
            {callbackResult ? <pre className="log">{JSON.stringify(callbackResult, null, 2)}</pre> : null}
          </article>
        </main>
      </>
    );
  }

  return (
    <>
      <div className="backdrop backOne" />
      <div className="backdrop backTwo" />

      <header className="topbar">
        <div>
          <p className="eyebrow">React Dashboard</p>
          <h1>PostBridge Lite Console</h1>
          <p className="subtitle">连接 TikTok、管理发布队列、导入 OpenClaw、执行 Worker</p>
        </div>
        <div className="statusWrap">
          <span className={`dot ${health.ok ? "ok" : "bad"}`} />
          <span>{health.text}</span>
          <button className="btn btnGhost" onClick={() => runSafely(checkHealth)}>
            检查服务
          </button>
        </div>
      </header>

      <main className="layout">
        <section className="column">
          <article className="panel">
            <h2>服务配置</h2>
            <div className="grid two">
              <label>
                API Base
                <input value={apiBase} onChange={(e) => setApiBase(e.target.value)} placeholder="https://api.athinker.net" />
              </label>
              <label>
                默认 Profile
                <input value={profile} onChange={(e) => setProfile(e.target.value)} placeholder="default" />
              </label>
            </div>
            <div className="actions">
              <button className="btn" onClick={saveConfig}>保存配置</button>
              <button className="btn btnGhost" onClick={() => runSafely(loadAll)}>刷新数据</button>
            </div>
          </article>

          <article className="panel">
            <h2>TikTok 连接</h2>
            <label>
              回调地址（配置到 TikTok Portal 的 Redirect URI）
              <input readOnly value={redirectUri} />
            </label>
            <div className="grid two">
              <label>
                服务条款 URL
                <input readOnly value={termsUri} />
              </label>
              <label>
                隐私政策 URL
                <input readOnly value={privacyUri} />
              </label>
            </div>
            <div className="actions">
              <button className="btn btnGhost" onClick={() => runSafely(() => copyText(redirectUri, "Redirect URI"))}>复制回调地址</button>
              <button className="btn btnGhost" onClick={() => runSafely(() => copyText(termsUri, "Terms URL"))}>复制服务条款 URL</button>
              <button className="btn btnGhost" onClick={() => runSafely(() => copyText(privacyUri, "Privacy URL"))}>复制隐私政策 URL</button>
              <button className="btn" onClick={() => runSafely(() => handleAuthUrl(true))}>生成授权链接并打开</button>
              <button className="btn btnGhost" onClick={() => runSafely(handleRefreshToken)}>刷新 Token</button>
            </div>
            <label>
              授权链接
              <textarea rows={2} readOnly value={authUrl} />
            </label>
            <label>
              授权 Code
              <input value={authCode} onChange={(e) => setAuthCode(e.target.value)} placeholder="回调 URL 中的 code" />
            </label>
            <div className="actions">
              <button className="btn" onClick={() => runSafely(handleExchange)}>换取 Token</button>
            </div>
          </article>

          <article className="panel">
            <h2>创建发布任务</h2>
            <div className="grid two">
              <label>
                发布模式
                <select value={mode} onChange={(e) => setMode(e.target.value)}>
                  <option value="PULL_FROM_URL">PULL_FROM_URL</option>
                  <option value="FILE_UPLOAD">FILE_UPLOAD</option>
                </select>
              </label>
              <label>
                定时发布时间
                <input type="datetime-local" value={scheduledAt} onChange={(e) => setScheduledAt(e.target.value)} />
              </label>
            </div>

            {mode === "PULL_FROM_URL" ? (
              <label>
                视频 URL
                <input value={mediaUrl} onChange={(e) => setMediaUrl(e.target.value)} placeholder="https://example.com/demo.mp4" />
              </label>
            ) : (
              <label>
                文件路径
                <input value={filePath} onChange={(e) => setFilePath(e.target.value)} placeholder="/absolute/path/video.mp4" />
              </label>
            )}

            <label>
              标题 / 文案
              <input value={title} onChange={(e) => setTitle(e.target.value)} placeholder="你的文案" />
            </label>

            <div className="grid two">
              <label>
                可见性
                <select value={privacyLevel} onChange={(e) => setPrivacyLevel(e.target.value)}>
                  <option value="SELF_ONLY">SELF_ONLY</option>
                  <option value="PUBLIC_TO_EVERYONE">PUBLIC_TO_EVERYONE</option>
                  <option value="FOLLOWER_OF_CREATOR">FOLLOWER_OF_CREATOR</option>
                  <option value="MUTUAL_FOLLOW_FRIENDS">MUTUAL_FOLLOW_FRIENDS</option>
                </select>
              </label>
              <label>
                Chunk Size (文件模式)
                <input type="number" value={chunkSize} onChange={(e) => setChunkSize(e.target.value)} />
              </label>
            </div>

            <div className="grid three compact">
              <label className="check"><input type="checkbox" checked={disableComment} onChange={(e) => setDisableComment(e.target.checked)} />禁评论</label>
              <label className="check"><input type="checkbox" checked={disableDuet} onChange={(e) => setDisableDuet(e.target.checked)} />禁合拍</label>
              <label className="check"><input type="checkbox" checked={disableStitch} onChange={(e) => setDisableStitch(e.target.checked)} />禁拼接</label>
            </div>

            <div className="actions">
              <button className="btn" onClick={() => runSafely(handleCreatePost)}>创建任务</button>
            </div>
          </article>

          <article className="panel">
            <h2>OpenClaw 导入</h2>
            <label>
              OpenClaw JSON
              <textarea rows={8} value={openclawJson} onChange={(e) => setOpenclawJson(e.target.value)} />
            </label>
            <div className="grid two">
              <label>
                导入 Profile
                <input value={openclawProfile} onChange={(e) => setOpenclawProfile(e.target.value)} />
              </label>
              <label>
                统一定时（可空）
                <input type="datetime-local" value={openclawScheduledAt} onChange={(e) => setOpenclawScheduledAt(e.target.value)} />
              </label>
            </div>
            <div className="actions">
              <button className="btn" onClick={() => runSafely(handleIngest)}>批量导入</button>
            </div>
          </article>
        </section>

        <section className="column">
          <article className="panel">
            <h2>Worker 控制</h2>
            <div className="grid two">
              <label>
                max_jobs
                <input type="number" value={maxJobs} onChange={(e) => setMaxJobs(e.target.value)} />
              </label>
              <label>
                自动刷新（秒）
                <input type="number" value={autoRefreshSec} onChange={(e) => setAutoRefreshSec(e.target.value)} />
              </label>
            </div>
            <div className="actions">
              <button className="btn" onClick={() => runSafely(handleRunWorker)}>执行 Worker</button>
              <button className="btn btnGhost" onClick={toggleAutoRefresh}>{autoRefreshOn ? "关闭自动刷新" : "开启自动刷新"}</button>
            </div>
            <div className="splitLine" />
            <h3 className="subhead">每日自动执行</h3>
            <div className="grid three">
              <label>
                启用
                <select value={dailyEnabled ? "on" : "off"} onChange={(e) => setDailyEnabled(e.target.value === "on")}>
                  <option value="on">开启</option>
                  <option value="off">关闭</option>
                </select>
              </label>
              <label>
                每日时间 (HH:MM)
                <input value={dailyTime} onChange={(e) => setDailyTime(e.target.value)} placeholder="10:00" />
              </label>
              <label>
                每次 max_jobs
                <input type="number" min="1" value={dailyMaxJobs} onChange={(e) => setDailyMaxJobs(e.target.value)} />
              </label>
            </div>
            <div className="actions">
              <button className="btn" onClick={() => runSafely(handleSaveScheduler)}>保存每日定时</button>
            </div>
            <div className="metaBlock">
              <div>next_run_at: {dailyNextRunAt || "-"}</div>
              <div>last_run_at: {dailyLastRunAt || "-"}</div>
              <div>
                last_result: {dailyLastResult ? `${dailyLastResult.processed ?? 0}/${dailyLastResult.done ?? 0}/${dailyLastResult.failed ?? 0}` : "-"}
              </div>
            </div>
          </article>

          <article className="panel">
            <div className="headInline">
              <h2>已连接账号</h2>
              <button className="btn btnGhost" onClick={() => runSafely(loadAccounts)}>刷新</button>
            </div>
            <div className="list">
              {!accounts.length && <div className="item"><div className="meta">暂无账号</div></div>}
              {accounts.map((a) => (
                <div className="item" key={`${a.platform}-${a.profile}`}>
                  <div className="title">{a.platform}/{a.profile}</div>
                  <div className="meta">open_id: {a.open_id || "-"}</div>
                  <div className="meta">scope: {a.scope || "-"}</div>
                  <div className="meta">expires_at: {a.expires_at || "-"}</div>
                  <div className="meta">updated_at: {a.updated_at || "-"}</div>
                </div>
              ))}
            </div>
          </article>

          <article className="panel">
            <div className="headInline">
              <h2>发布任务</h2>
              <div className="miniActions">
                <select value={postStatusFilter} onChange={(e) => setPostStatusFilter(e.target.value)}>
                  <option value="">全部</option>
                  <option value="scheduled">scheduled</option>
                  <option value="running">running</option>
                  <option value="done">done</option>
                  <option value="failed">failed</option>
                </select>
                <button className="btn btnGhost" onClick={() => runSafely(loadPosts)}>刷新</button>
              </div>
            </div>
            <div className="list">
              {!posts.length && <div className="item"><div className="meta">暂无任务</div></div>}
              {posts.map((p) => (
                <div className="item" key={p.id}>
                  <div className="title"><span className={statusClass(p.status)}>{p.status}</span>{p.id}</div>
                  <div className="meta">{p.platform}/{p.profile} · {p.mode}</div>
                  <div className="meta">scheduled_at: {p.scheduled_at || "-"}</div>
                  <div className="meta">publish_id: {p.publish_id || "-"}</div>
                  <div className="meta">media: {p.payload?.media_url || p.payload?.file_path || "-"}</div>
                  {p.last_error ? <div className="meta">error: {p.last_error}</div> : null}
                </div>
              ))}
            </div>
          </article>

          <article className="panel">
            <h2>操作日志</h2>
            <pre className="log">{logText}</pre>
          </article>
        </section>
      </main>
    </>
  );
}

export default App;
