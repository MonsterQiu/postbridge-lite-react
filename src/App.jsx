import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import "./App.css";

const LOCAL_KEY_API = "pbl_react_api_base";
const LOCAL_KEY_PROFILE = "pbl_react_profile";
const LOCAL_KEY_TAB = "pbl_react_active_tab";

const TABS = [
  { id: "studio", label: "AI 创作工作台" },
  { id: "publish", label: "发布中心" },
  { id: "account", label: "账号授权" },
  { id: "monitor", label: "任务监控" },
];

const readLocalStorage = (key) => {
  if (typeof window === "undefined") return "";
  try {
    return localStorage.getItem(key) || "";
  } catch {
    return "";
  }
};

const sanitizeApiBase = (text) => (text || "").trim().replace(/\/$/, "");

const inferHostedApiBase = () => {
  if (typeof window === "undefined") return "";
  const host = (window.location.hostname || "").toLowerCase();
  if (host === "tiktok.athinker.net") {
    return "https://api.athinker.net";
  }
  return "";
};

const initialApiBase = () => {
  const saved = sanitizeApiBase(readLocalStorage(LOCAL_KEY_API));
  if (saved) return saved;

  const envBase = sanitizeApiBase(import.meta.env.VITE_API_BASE || "");
  if (envBase) return envBase;

  const hostedBase = inferHostedApiBase();
  if (hostedBase) return hostedBase;

  return "http://127.0.0.1:8787";
};

const initialProfile = () => {
  const saved = (readLocalStorage(LOCAL_KEY_PROFILE) || "").trim();
  return saved || "default";
};

const initialTab = () => {
  const saved = readLocalStorage(LOCAL_KEY_TAB);
  const valid = TABS.some((tab) => tab.id === saved);
  return valid ? saved : "studio";
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

const isoLocalInput = (date = new Date(Date.now() + 2 * 60 * 1000)) => {
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

  const [activeTab, setActiveTab] = useState(() => initialTab());
  const [apiBase, setApiBase] = useState(() => initialApiBase());
  const [profile, setProfile] = useState(() => initialProfile());
  const [busyLabel, setBusyLabel] = useState("");
  const [health, setHealth] = useState({ ok: false, text: "未检测" });
  const [logText, setLogText] = useState("");

  const [accounts, setAccounts] = useState([]);
  const [posts, setPosts] = useState([]);
  const [postStatusFilter, setPostStatusFilter] = useState("");

  const [authScopes, setAuthScopes] = useState("user.info.basic,video.publish,video.upload");
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

  const [maxJobs, setMaxJobs] = useState(20);
  const [autoRefreshSec, setAutoRefreshSec] = useState(10);
  const [autoRefreshOn, setAutoRefreshOn] = useState(false);

  const [dailyEnabled, setDailyEnabled] = useState(false);
  const [dailyTime, setDailyTime] = useState("10:00");
  const [dailyMaxJobs, setDailyMaxJobs] = useState(20);
  const [dailyLastRunAt, setDailyLastRunAt] = useState("");
  const [dailyNextRunAt, setDailyNextRunAt] = useState("");
  const [dailyLastResult, setDailyLastResult] = useState(null);

  const [aiConfig, setAiConfig] = useState({
    llm_enabled: false,
    llm_ready: false,
    model: "",
    fallback_mode: true,
  });

  const [ideaNiche, setIdeaNiche] = useState("AI 自动化与效率工具");
  const [ideaAudience, setIdeaAudience] = useState("跨境/电商/独立开发者");
  const [ideaGoal, setIdeaGoal] = useState("涨粉并引导咨询");
  const [ideaLanguage, setIdeaLanguage] = useState("zh-CN");
  const [ideaCount, setIdeaCount] = useState(6);
  const [topics, setTopics] = useState([]);
  const [selectedTopicIndex, setSelectedTopicIndex] = useState(-1);

  const [draftTopic, setDraftTopic] = useState("");
  const [draftAudience, setDraftAudience] = useState("内容创作者");
  const [draftTone, setDraftTone] = useState("专业但口语化");
  const [draftCta, setDraftCta] = useState("关注我领取模板");
  const [draftDurationSec, setDraftDurationSec] = useState(35);
  const [draftResult, setDraftResult] = useState(null);

  const [videoTopic, setVideoTopic] = useState("");
  const [videoStyle, setVideoStyle] = useState("cinematic, realistic");
  const [videoPromptCount, setVideoPromptCount] = useState(4);
  const [videoPromptResult, setVideoPromptResult] = useState([]);

  const [callbackCode, setCallbackCode] = useState(route.code);
  const [callbackState, setCallbackState] = useState(route.state);
  const [callbackError] = useState(route.error);
  const [callbackErrorDescription] = useState(route.errorDescription);
  const [callbackBusy, setCallbackBusy] = useState(false);
  const [callbackMessage, setCallbackMessage] = useState("");

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
  const demoVideoUrl = useMemo(
    () => (typeof window !== "undefined" ? `${window.location.origin}/videos/tiktok_demo_960x540.mp4` : ""),
    []
  );

  const selectedTopic = useMemo(() => {
    if (selectedTopicIndex < 0 || selectedTopicIndex >= topics.length) {
      return null;
    }
    return topics[selectedTopicIndex];
  }, [topics, selectedTopicIndex]);

  const hasConnectedAccount = accounts.length > 0;
  const latestDonePost = useMemo(
    () => posts.find((p) => (p.status || "").toLowerCase() === "done"),
    [posts]
  );

  const appendLog = useCallback((message, payload) => {
    const line = `[${fmtNow()}] ${message}${payload ? `\n${JSON.stringify(payload, null, 2)}` : ""}\n\n`;
    setLogText((prev) => (line + prev).slice(0, 32000));
  }, []);

  const copyText = async (text, label) => {
    if (!text?.trim()) {
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

  const request = useCallback(async (path, options = {}) => {
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
  }, [base]);

  const runSafely = useCallback(async (fn, label = "") => {
    if (label) {
      setBusyLabel(label);
    }
    try {
      await fn();
    } catch (err) {
      appendLog(`操作失败: ${err.message}`);
    } finally {
      if (label) {
        setBusyLabel("");
      }
    }
  }, [appendLog]);

  const checkHealth = useCallback(async () => {
    await request("/health");
    setHealth({ ok: true, text: "服务在线" });
    appendLog("健康检查通过");
  }, [appendLog, request]);

  const loadAccounts = useCallback(async () => {
    const data = await request("/api/v1/accounts");
    setAccounts(data.items || []);
  }, [request]);

  const loadPosts = useCallback(async () => {
    const query = new URLSearchParams({ limit: "100" });
    if (postStatusFilter) query.set("status", postStatusFilter);
    const data = await request(`/api/v1/posts?${query.toString()}`);
    setPosts(data.items || []);
  }, [postStatusFilter, request]);

  const loadScheduler = useCallback(async () => {
    const data = await request("/api/v1/scheduler");
    setDailyEnabled(Boolean(data.enabled));
    setDailyTime(String(data.time_hhmm || "10:00"));
    setDailyMaxJobs(Number(data.max_jobs || 20));
    setDailyLastRunAt(String(data.last_run_at || ""));
    setDailyNextRunAt(String(data.next_run_at || ""));
    setDailyLastResult(data.last_result || null);
  }, [request]);

  const loadAiConfig = useCallback(async () => {
    try {
      const data = await request("/api/v1/ai/config");
      setAiConfig(data || {});
    } catch {
      setAiConfig({
        llm_enabled: false,
        llm_ready: false,
        model: "",
        fallback_mode: true,
      });
    }
  }, [request]);

  const loadAll = useCallback(async () => {
    await Promise.all([loadAccounts(), loadPosts(), loadScheduler(), loadAiConfig()]);
  }, [loadAccounts, loadAiConfig, loadPosts, loadScheduler]);

  const useRecommendedApiBase = () => {
    const recommended = inferHostedApiBase() || "http://127.0.0.1:8787";
    setApiBase(recommended);
    appendLog(`已应用推荐 API Base: ${recommended}`);
  };

  const fillDemoMediaUrl = () => {
    setMode("PULL_FROM_URL");
    setMediaUrl(demoVideoUrl);
    appendLog("已填入测试视频 URL");
  };

  const setScheduleSoon = (minutes = 2) => {
    setScheduledAt(isoLocalInput(new Date(Date.now() + minutes * 60 * 1000)));
    appendLog(`发布时间已设置为 ${minutes} 分钟后`);
  };

  const createPostBody = () => {
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
        throw new Error("请填写视频 URL");
      }
      payload.media_url = mediaUrl.trim();
    }

    if (mode === "FILE_UPLOAD") {
      if (!filePath.trim()) {
        throw new Error("请填写文件路径");
      }
      payload.file_path = filePath.trim();
    }

    return {
      platform: "tiktok",
      profile: profile.trim() || "default",
      mode,
      scheduled_at: toIsoSecond(scheduledAt),
      payload,
    };
  };

  const handleCreatePost = async () => {
    if (!hasConnectedAccount) {
      throw new Error("请先完成 TikTok 授权");
    }
    const body = createPostBody();
    const data = await request("/api/v1/posts", { method: "POST", body });
    appendLog("创建发布任务成功", data);
    await loadPosts();
  };

  const handleCreateAndRun = async () => {
    await handleCreatePost();
    const runData = await request("/api/v1/worker/run", {
      method: "POST",
      body: { max_jobs: Number(maxJobs || 20) },
    });
    appendLog("Worker 执行完成", runData);
    await loadPosts();
    await loadScheduler();
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

  const handleAuthUrl = async (openWindow = false) => {
    const body = {
      scopes: (authScopes || "").trim(),
    };
    const data = await request("/api/v1/tiktok/auth-url", { method: "POST", body });
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
      throw new Error("请输入授权 code");
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

  const handleGenerateTopics = async () => {
    const body = {
      niche: ideaNiche,
      audience: ideaAudience,
      goal: ideaGoal,
      language: ideaLanguage,
      count: Number(ideaCount || 6),
    };
    const data = await request("/api/v1/ai/topics", { method: "POST", body });
    const rows = Array.isArray(data.topics) ? data.topics : [];
    setTopics(rows);
    setSelectedTopicIndex(rows.length ? 0 : -1);
    appendLog("AI 选题已生成", {
      provider: data.provider,
      reason: data.reason || "",
      count: rows.length,
    });

    if (rows[0]) {
      setDraftTopic(rows[0].title || "");
      setVideoTopic(rows[0].title || "");
    }
  };

  const handleUseTopic = (idx) => {
    setSelectedTopicIndex(idx);
    const item = topics[idx];
    if (!item) return;
    if (item.title) {
      setDraftTopic(item.title);
      setVideoTopic(item.title);
    }
    appendLog(`已选择选题: ${item.title || `#${idx + 1}`}`);
  };

  const handleGenerateDraft = async () => {
    const topic = (draftTopic || selectedTopic?.title || "").trim();
    if (!topic) {
      throw new Error("请先输入或选择主题");
    }

    const body = {
      topic,
      audience: draftAudience,
      tone: draftTone,
      cta: draftCta,
      language: ideaLanguage,
      duration_sec: Number(draftDurationSec || 35),
    };
    const data = await request("/api/v1/ai/draft", { method: "POST", body });
    setDraftResult(data || null);
    appendLog("AI 文案与脚本已生成", {
      provider: data.provider,
      reason: data.reason || "",
      topic: data.topic,
    });
    if (!videoTopic.trim()) {
      setVideoTopic(topic);
    }
    if (Array.isArray(data.video_prompts) && data.video_prompts.length) {
      setVideoPromptResult(data.video_prompts);
    }
  };

  const handleGenerateVideoPrompts = async () => {
    const topic = (videoTopic || draftTopic || selectedTopic?.title || "").trim();
    if (!topic) {
      throw new Error("请先输入主题");
    }

    const body = {
      topic,
      style: videoStyle,
      language: "en",
      count: Number(videoPromptCount || 4),
    };
    const data = await request("/api/v1/ai/video-prompts", { method: "POST", body });
    const prompts = Array.isArray(data.prompts) ? data.prompts : [];
    setVideoPromptResult(prompts);
    appendLog("AI 视频提示词已生成", {
      provider: data.provider,
      reason: data.reason || "",
      count: prompts.length,
    });
  };

  const handleApplyDraftToPublish = () => {
    if (!draftResult) {
      appendLog("没有可应用的 AI 文案，请先生成文案");
      return;
    }
    const caption = String(draftResult.caption || "").trim();
    const tags = Array.isArray(draftResult.hashtags)
      ? draftResult.hashtags.map((v) => String(v || "").trim()).filter(Boolean).join(" ")
      : "";
    const merged = [caption, tags].filter(Boolean).join("\n");
    setTitle(merged);
    if (!mediaUrl.trim() && demoVideoUrl) {
      setMediaUrl(demoVideoUrl);
      setMode("PULL_FROM_URL");
    }
    setActiveTab("publish");
    appendLog("已将 AI 文案应用到发布中心");
  };

  const handleCheckPublishStatus = async (post) => {
    if (!post?.publish_id) {
      throw new Error("该任务没有 publish_id");
    }
    const body = {
      profile: post.profile || profile.trim() || "default",
      publish_id: post.publish_id,
    };
    const data = await request("/api/v1/tiktok/publish-status", { method: "POST", body });
    appendLog(`查询发布状态: ${post.id}`, data);
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
    if (!mediaUrl && demoVideoUrl) {
      setMediaUrl(demoVideoUrl);
    }
  }, [demoVideoUrl, mediaUrl]);

  useEffect(() => {
    if (!isCallbackRoute) {
      return;
    }
    if (route.code) {
      setAuthCode(route.code);
      appendLog("检测到 TikTok 回调 code，可直接换取 token");
    }
  }, [appendLog, isCallbackRoute, route.code]);

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
  }, [autoRefreshOn, autoRefreshSec, isCallbackRoute, loadAll, runSafely]);

  useEffect(() => {
    if (isCallbackRoute) {
      return;
    }
    runSafely(checkHealth);
    runSafely(loadAll);
  }, [checkHealth, isCallbackRoute, loadAll, runSafely]);

  useEffect(() => {
    if (typeof window !== "undefined") {
      localStorage.setItem(LOCAL_KEY_TAB, activeTab);
    }
  }, [activeTab]);

  const statusClass = (status) => {
    const s = (status || "").toLowerCase();
    return `tag ${s}`;
  };

  const renderLegal = (isTerms) => {
    const titleText = isTerms ? "服务条款" : "隐私政策";
    return (
      <main className="routeWrap">
        <article className="card legalCard">
          <p className="brandMini">athinker.net</p>
          <h1>{titleText}</h1>
          <p className="muted">最后更新：2026-02-15</p>

          {isTerms ? (
            <div className="legalBody">
              <p>本服务用于 TikTok 账号授权、发布任务管理与自动执行。你对发布内容负责，并需遵守 TikTok 平台规则。</p>
              <h3>许可范围</h3>
              <p>仅可用于合法合规内容发布，不得用于侵权、欺诈、骚扰或违法场景。</p>
              <h3>服务边界</h3>
              <p>服务按现状提供，可能因平台策略或技术维护发生变更。</p>
              <h3>联系</h3>
              <p>support@athinker.net</p>
            </div>
          ) : (
            <div className="legalBody">
              <p>我们仅在实现授权、发布和任务追踪所需范围内处理数据。</p>
              <h3>收集内容</h3>
              <p>包括 OAuth token 信息、发布任务数据、运行日志与错误记录。</p>
              <h3>使用目的</h3>
              <p>用于账号连接、自动发布、问题排查与安全审计，不用于对外售卖数据。</p>
              <h3>联系</h3>
              <p>privacy@athinker.net</p>
            </div>
          )}

          <div className="rowActions">
            <a className="btn ghost" href="/">返回控制台</a>
            <a className="btn ghost" href={termsUri}>服务条款 URL</a>
            <a className="btn ghost" href={privacyUri}>隐私政策 URL</a>
          </div>
        </article>
      </main>
    );
  };

  if (isTermsRoute) {
    return renderLegal(true);
  }

  if (isPrivacyRoute) {
    return renderLegal(false);
  }

  if (isCallbackRoute) {
    return (
      <main className="routeWrap">
        <article className="card callbackCard">
          <p className="brandMini">TikTok OAuth</p>
          <h1>回调已到达</h1>
          <p className="muted">确认 API Base 与 Profile 后，点击换取 Token。</p>

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

          <div className="rowActions">
            <button className="btn ghost" onClick={saveConfig}>保存配置</button>
            <button className="btn ghost" onClick={() => runSafely(() => checkHealth(), "检查后端")}>检查后端</button>
            <button className="btn ghost" onClick={() => runSafely(() => copyText(redirectUri, "Redirect URI"))}>复制 Redirect URI</button>
          </div>

          {callbackError ? (
            <div className="warnBox">授权失败：{callbackErrorDescription || callbackError}</div>
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

          <div className="rowActions">
            <button
              className="btn"
              disabled={callbackBusy}
              onClick={() =>
                runSafely(async () => {
                  if (!callbackCode.trim()) {
                    setCallbackMessage("回调 URL 里没有 code，无法换 token。");
                    return;
                  }
                  setCallbackBusy(true);
                  setCallbackMessage("");
                  try {
                    await exchangeWithCode(callbackCode);
                    setCallbackMessage("换取 Token 成功。可以返回控制台继续发布。 ");
                  } catch (err) {
                    setCallbackMessage(`换取失败：${err.message}`);
                    throw err;
                  } finally {
                    setCallbackBusy(false);
                  }
                }, "换取 Token")
              }
            >
              {callbackBusy ? "换取中..." : "换取 Token"}
            </button>
            <a className="btn ghost" href="/">返回控制台</a>
          </div>

          {callbackMessage ? <div className="plainMeta">{callbackMessage}</div> : null}
        </article>
      </main>
    );
  }

  return (
    <div className="appPage">
      <header className="shellHeader">
        <div>
          <p className="brandMini">AI Publishing Console</p>
          <h1>PostBridge Pro</h1>
          <p className="muted">目标流程：AI 选题 → AI 文案脚本 → 视频提示词 → TikTok 自动发布</p>
        </div>
        <div className="healthBox">
          <span className={`dot ${health.ok ? "ok" : "bad"}`} />
          <span>{health.text}</span>
          {busyLabel ? <span className="busyTag">进行中：{busyLabel}</span> : null}
          <button className="btn ghost" onClick={() => runSafely(checkHealth, "健康检查")}>检查服务</button>
        </div>
      </header>

      <section className="topConfig card">
        <div className="grid three">
          <label>
            API Base
            <input value={apiBase} onChange={(e) => setApiBase(e.target.value)} placeholder="https://api.athinker.net" />
          </label>
          <label>
            Profile
            <input value={profile} onChange={(e) => setProfile(e.target.value)} placeholder="default" />
          </label>
          <label>
            推荐动作
            <div className="rowActions compact">
              <button className="btn ghost" onClick={useRecommendedApiBase}>一键填后端地址</button>
              <button className="btn ghost" onClick={() => runSafely(loadAll, "刷新数据")}>刷新全量数据</button>
            </div>
          </label>
        </div>

        <div className="rowActions">
          <button className="btn" onClick={saveConfig}>保存配置</button>
          <button className="btn ghost" onClick={() => runSafely(() => copyText(redirectUri, "Redirect URI"))}>复制 Redirect URI</button>
          <button className="btn ghost" onClick={() => runSafely(() => copyText(termsUri, "Terms URL"))}>复制服务条款 URL</button>
          <button className="btn ghost" onClick={() => runSafely(() => copyText(privacyUri, "Privacy URL"))}>复制隐私政策 URL</button>
        </div>
      </section>

      <nav className="tabNav">
        {TABS.map((tab) => (
          <button
            key={tab.id}
            className={`tabBtn ${activeTab === tab.id ? "active" : ""}`}
            onClick={() => setActiveTab(tab.id)}
          >
            {tab.label}
          </button>
        ))}
      </nav>

      <main className="tabBody">
        {activeTab === "studio" ? (
          <section className="stack">
            <article className="card">
              <h2>AI 引擎状态</h2>
              <div className="plainMeta">
                <div>LLM 开关：{aiConfig.llm_enabled ? "已启用" : "未启用"}</div>
                <div>LLM 可用：{aiConfig.llm_ready ? "是" : "否（当前走 fallback）"}</div>
                <div>模型：{aiConfig.model || "-"}</div>
              </div>
            </article>

            <article className="card">
              <h2>1) AI 选题</h2>
              <div className="grid two">
                <label>
                  领域
                  <input value={ideaNiche} onChange={(e) => setIdeaNiche(e.target.value)} placeholder="例如：汽车内容、AI工具、跨境电商" />
                </label>
                <label>
                  受众
                  <input value={ideaAudience} onChange={(e) => setIdeaAudience(e.target.value)} placeholder="例如：TikTok 新手商家" />
                </label>
              </div>
              <div className="grid three">
                <label>
                  目标
                  <input value={ideaGoal} onChange={(e) => setIdeaGoal(e.target.value)} placeholder="涨粉 / 引流 / 转化" />
                </label>
                <label>
                  语言
                  <input value={ideaLanguage} onChange={(e) => setIdeaLanguage(e.target.value)} placeholder="zh-CN" />
                </label>
                <label>
                  生成数量
                  <input type="number" min="3" max="12" value={ideaCount} onChange={(e) => setIdeaCount(e.target.value)} />
                </label>
              </div>
              <div className="rowActions">
                <button className="btn" onClick={() => runSafely(handleGenerateTopics, "AI 生成选题")}>生成选题</button>
              </div>

              <div className="list">
                {!topics.length ? <div className="item mutedItem">暂无选题，请先点击“生成选题”</div> : null}
                {topics.map((item, idx) => (
                  <div
                    key={`${item.title || "topic"}-${idx}`}
                    className={`item clickItem ${selectedTopicIndex === idx ? "selected" : ""}`}
                    onClick={() => handleUseTopic(idx)}
                  >
                    <div className="itemTitle">{idx + 1}. {item.title || "未命名选题"}</div>
                    <div className="itemMeta">{item.hook || "-"}</div>
                    <div className="itemMeta">角度：{item.angle || "-"}</div>
                    <div className="itemMeta">标签：{Array.isArray(item.hashtags) ? item.hashtags.join(" ") : "-"}</div>
                  </div>
                ))}
              </div>
            </article>

            <article className="card">
              <h2>2) AI 生成文案 + 镜头脚本</h2>
              <div className="grid two">
                <label>
                  主题
                  <input
                    value={draftTopic}
                    onChange={(e) => setDraftTopic(e.target.value)}
                    placeholder="可手动输入，或从上方点选题"
                  />
                </label>
                <label>
                  受众
                  <input value={draftAudience} onChange={(e) => setDraftAudience(e.target.value)} />
                </label>
              </div>
              <div className="grid three">
                <label>
                  语气
                  <input value={draftTone} onChange={(e) => setDraftTone(e.target.value)} />
                </label>
                <label>
                  CTA
                  <input value={draftCta} onChange={(e) => setDraftCta(e.target.value)} />
                </label>
                <label>
                  时长(秒)
                  <input type="number" min="15" max="120" value={draftDurationSec} onChange={(e) => setDraftDurationSec(e.target.value)} />
                </label>
              </div>
              <div className="rowActions">
                <button className="btn" onClick={() => runSafely(handleGenerateDraft, "AI 生成文案")}>生成文案与脚本</button>
                <button className="btn ghost" onClick={handleApplyDraftToPublish}>应用到发布中心</button>
              </div>

              {draftResult ? (
                <div className="resultBox">
                  <h3>文案</h3>
                  <pre>{draftResult.caption || "-"}</pre>
                  <h3>Hashtags</h3>
                  <pre>{Array.isArray(draftResult.hashtags) ? draftResult.hashtags.join(" ") : "-"}</pre>
                  <h3>口播脚本</h3>
                  <pre>{Array.isArray(draftResult.script_lines) ? draftResult.script_lines.join("\n") : "-"}</pre>
                  <h3>镜头清单</h3>
                  <pre>{Array.isArray(draftResult.shot_list) ? draftResult.shot_list.join("\n") : "-"}</pre>
                </div>
              ) : null}
            </article>

            <article className="card">
              <h2>3) AI 视频提示词（用于接入视频生成）</h2>
              <div className="grid three">
                <label>
                  主题
                  <input value={videoTopic} onChange={(e) => setVideoTopic(e.target.value)} placeholder="默认继承上一步主题" />
                </label>
                <label>
                  风格
                  <input value={videoStyle} onChange={(e) => setVideoStyle(e.target.value)} placeholder="cinematic, realistic" />
                </label>
                <label>
                  数量
                  <input type="number" min="3" max="8" value={videoPromptCount} onChange={(e) => setVideoPromptCount(e.target.value)} />
                </label>
              </div>
              <div className="rowActions">
                <button className="btn" onClick={() => runSafely(handleGenerateVideoPrompts, "AI 生成视频提示词")}>生成视频提示词</button>
              </div>

              <div className="list">
                {!videoPromptResult.length ? <div className="item mutedItem">暂无视频提示词</div> : null}
                {videoPromptResult.map((line, idx) => (
                  <div className="item" key={`${line}-${idx}`}>
                    <div className="itemTitle">Prompt {idx + 1}</div>
                    <div className="itemMeta">{line}</div>
                    <div className="rowActions compact">
                      <button className="btn ghost" onClick={() => runSafely(() => copyText(line, `视频 Prompt ${idx + 1}`))}>复制</button>
                    </div>
                  </div>
                ))}
              </div>
            </article>
          </section>
        ) : null}

        {activeTab === "publish" ? (
          <section className="stack">
            <article className="card">
              <h2>发布任务</h2>
              <p className="plainMeta">先在 AI 创作工作台生成文案，再回到这里创建发布任务。</p>
              <div className="grid two">
                <label>
                  发布模式
                  <select value={mode} onChange={(e) => setMode(e.target.value)}>
                    <option value="PULL_FROM_URL">PULL_FROM_URL</option>
                    <option value="FILE_UPLOAD">FILE_UPLOAD</option>
                  </select>
                </label>
                <label>
                  发布时间
                  <input type="datetime-local" value={scheduledAt} onChange={(e) => setScheduledAt(e.target.value)} />
                </label>
              </div>

              {mode === "PULL_FROM_URL" ? (
                <label>
                  视频 URL
                  <input
                    value={mediaUrl}
                    onChange={(e) => setMediaUrl(e.target.value)}
                    placeholder="https://tiktok.athinker.net/videos/tiktok_demo_960x540.mp4"
                  />
                </label>
              ) : (
                <label>
                  文件路径
                  <input value={filePath} onChange={(e) => setFilePath(e.target.value)} placeholder="/absolute/path/video.mp4" />
                </label>
              )}

              <label>
                标题 / 文案
                <textarea rows={4} value={title} onChange={(e) => setTitle(e.target.value)} placeholder="从 AI 文案回填或手动输入" />
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
                  Chunk Size
                  <input type="number" value={chunkSize} onChange={(e) => setChunkSize(e.target.value)} />
                </label>
              </div>

              <div className="grid three compactGrid">
                <label className="check"><input type="checkbox" checked={disableComment} onChange={(e) => setDisableComment(e.target.checked)} />禁评论</label>
                <label className="check"><input type="checkbox" checked={disableDuet} onChange={(e) => setDisableDuet(e.target.checked)} />禁合拍</label>
                <label className="check"><input type="checkbox" checked={disableStitch} onChange={(e) => setDisableStitch(e.target.checked)} />禁拼接</label>
              </div>

              <div className="rowActions">
                <button className="btn ghost" onClick={fillDemoMediaUrl}>填测试视频 URL</button>
                <button className="btn ghost" onClick={() => setScheduleSoon(2)}>发布时间 +2 分钟</button>
                <button className="btn ghost" onClick={handleApplyDraftToPublish}>从 AI 文案回填</button>
                <button className="btn" onClick={() => runSafely(handleCreatePost, "创建发布任务")}>仅创建任务</button>
                <button className="btn" onClick={() => runSafely(handleCreateAndRun, "创建并执行")}>创建并执行</button>
              </div>
            </article>

            <article className="card">
              <h2>最新发布结果</h2>
              {latestDonePost?.publish_id ? (
                <div className="plainMeta">最近成功 publish_id：{latestDonePost.publish_id}</div>
              ) : (
                <div className="plainMeta">暂无成功发布记录</div>
              )}
            </article>
          </section>
        ) : null}

        {activeTab === "account" ? (
          <section className="stack">
            <article className="card">
              <h2>TikTok OAuth</h2>
              <label>
                Redirect URI（填到 TikTok Login Kit）
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
              <label>
                Scopes（逗号分隔）
                <input value={authScopes} onChange={(e) => setAuthScopes(e.target.value)} placeholder="user.info.basic,video.publish,video.upload" />
              </label>
              <div className="rowActions">
                <button className="btn" onClick={() => runSafely(() => handleAuthUrl(true), "生成授权链接")}>生成授权链接并打开</button>
                <button className="btn ghost" onClick={() => runSafely(() => copyText(redirectUri, "Redirect URI"))}>复制回调地址</button>
                <button className="btn ghost" onClick={() => runSafely(handleRefreshToken, "刷新 Token")}>刷新 Token</button>
              </div>
              <label>
                授权链接
                <textarea rows={2} readOnly value={authUrl} />
              </label>
              <label>
                授权 Code
                <input value={authCode} onChange={(e) => setAuthCode(e.target.value)} placeholder="回调 URL 中的 code" />
              </label>
              <div className="rowActions">
                <button className="btn" onClick={() => runSafely(handleExchange, "换取 Token")}>换取 Token</button>
              </div>
            </article>

            <article className="card">
              <div className="headLine">
                <h2>已连接账号</h2>
                <button className="btn ghost" onClick={() => runSafely(loadAccounts, "刷新账号")}>刷新</button>
              </div>
              <div className="list">
                {!accounts.length ? <div className="item mutedItem">暂无账号</div> : null}
                {accounts.map((a) => (
                  <div className="item" key={`${a.platform}-${a.profile}`}>
                    <div className="itemTitle">{a.platform}/{a.profile}</div>
                    <div className="itemMeta">open_id: {a.open_id || "-"}</div>
                    <div className="itemMeta">scope: {a.scope || "-"}</div>
                    <div className="itemMeta">expires_at: {a.expires_at || "-"}</div>
                  </div>
                ))}
              </div>
            </article>
          </section>
        ) : null}

        {activeTab === "monitor" ? (
          <section className="stack">
            <article className="card">
              <h2>Worker 与定时</h2>
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
              <div className="rowActions">
                <button className="btn" onClick={() => runSafely(handleRunWorker, "执行 Worker")}>执行 Worker</button>
                <button className="btn ghost" onClick={toggleAutoRefresh}>{autoRefreshOn ? "关闭自动刷新" : "开启自动刷新"}</button>
              </div>

              <div className="splitLine" />

              <h3>每日自动执行</h3>
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
              <div className="rowActions">
                <button className="btn" onClick={() => runSafely(handleSaveScheduler, "保存每日定时")}>保存每日定时</button>
              </div>
              <div className="plainMeta">
                <div>next_run_at: {dailyNextRunAt || "-"}</div>
                <div>last_run_at: {dailyLastRunAt || "-"}</div>
                <div>
                  last_result: {dailyLastResult ? `${dailyLastResult.processed ?? 0}/${dailyLastResult.done ?? 0}/${dailyLastResult.failed ?? 0}` : "-"}
                </div>
              </div>
            </article>

            <article className="card">
              <div className="headLine">
                <h2>发布任务</h2>
                <div className="rowActions compact">
                  <select value={postStatusFilter} onChange={(e) => setPostStatusFilter(e.target.value)}>
                    <option value="">全部</option>
                    <option value="scheduled">scheduled</option>
                    <option value="running">running</option>
                    <option value="done">done</option>
                    <option value="failed">failed</option>
                  </select>
                  <button className="btn ghost" onClick={() => runSafely(loadPosts, "刷新任务")}>刷新</button>
                </div>
              </div>

              <div className="list postsList">
                {!posts.length ? <div className="item mutedItem">暂无任务</div> : null}
                {posts.map((p) => (
                  <div className="item" key={p.id}>
                    <div className="itemTitle">
                      <span className={statusClass(p.status)}>{p.status}</span>
                      {p.id}
                    </div>
                    <div className="itemMeta">{p.platform}/{p.profile} · {p.mode}</div>
                    <div className="itemMeta">scheduled_at: {p.scheduled_at || "-"}</div>
                    <div className="itemMeta">publish_id: {p.publish_id || "-"}</div>
                    <div className="itemMeta">media: {p.payload?.media_url || p.payload?.file_path || "-"}</div>
                    {p.last_error ? <div className="itemMeta">error: {p.last_error}</div> : null}
                    <div className="rowActions compact">
                      <button
                        className="btn ghost"
                        disabled={!p.publish_id}
                        onClick={() => runSafely(() => handleCheckPublishStatus(p), "查询发布状态")}
                      >
                        查询发布状态
                      </button>
                    </div>
                  </div>
                ))}
              </div>
            </article>

            <article className="card">
              <h2>操作日志</h2>
              <pre className="log">{logText}</pre>
            </article>
          </section>
        ) : null}
      </main>
    </div>
  );
}

export default App;
