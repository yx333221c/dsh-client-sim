/* =========================================================
   DSH Client Simulator — application logic
   No frameworks, no build step, no network calls.
   ========================================================= */

(() => {
  "use strict";

  const $ = (selector, root = document) => root.querySelector(selector);
  const $$ = (selector, root = document) => [...root.querySelectorAll(selector)];

  const LS = {
    theme: "dsh-sim-theme",
    model: "dsh-sim-model",
    reduceMotion: "dsh-sim-reduce-motion",
    collapsed: "dsh-sim-sidebar-collapsed",
  };

  const MODELS = {
    "deepseek-v3.2": {
      name: "DeepSeek-V3.2",
      short: "V3.2",
      sub: "旗舰 · 通用",
      description: "复杂任务与日常对话的首选",
      tone: "tone-blue",
      icon: "i-spark",
    },
    "deepseek-r1": {
      name: "DeepSeek-R1",
      short: "R1",
      sub: "推理 · 深度思考",
      description: "更强的分步推理与规划能力",
      tone: "tone-violet",
      icon: "i-brain",
    },
    "deepseek-v3.1": {
      name: "DeepSeek-V3.1",
      short: "V3.1",
      sub: "均衡 · 长上下文",
      description: "长文档与多轮协作",
      tone: "tone-cyan",
      icon: "i-layers",
    },
    "harness-lite": {
      name: "Harness-Lite",
      short: "Lite",
      sub: "轻量 · 快速响应",
      description: "快速草稿与轻量任务",
      tone: "tone-amber",
      icon: "i-zap",
    },
  };
  const MODEL_ORDER = Object.keys(MODELS);

  const SAMPLE_SESSIONS = {
    delegation: {
      title: "子智能体协作出题",
      user: "帮我把「为盲人设计一款导航应用」拆成 3 个可由不同子智能体并行完成的任务，并说明它们之间的依赖。",
      output:
        "拆分为 3 个并行子任务：\n\n" +
        "1. 用户旅程与无障碍约束 —— 梳理核心场景、失败点与合规要求；\n" +
        "2. 空间感知方案 —— 比较 GPS、蓝牙信标与视觉识别的组合策略；\n" +
        "3. 交互原型验证 —— 设计语音优先的导航流程，并列出可用性测试脚本。\n\n" +
        "依赖关系：任务 1 是任务 2 和任务 3 的输入；任务 2 与任务 3 可以并行，最后由父智能体合并结果。",
      modelKey: "deepseek-v3.2",
      time: "10:24",
    },
    plugins: {
      title: "插件权限审查",
      user: "审查「子智能体委托」插件需要的权限，确认是否存在越权风险。",
      output:
        "审查结论：低风险。\n\n" +
        "所需权限仅为 session.read、subagent.create 与 result.write，全部限定在当前会话作用域。插件无法读取其他会话、写入文件系统或发起网络请求；结果回传策略为原样回传，不会二次改写。\n\n" +
        "建议：保持核心插件锁定，不为普通插件开放 subagent.create。",
      modelKey: "deepseek-r1",
      time: "昨天",
    },
    outline: {
      title: "长报告结构拆解",
      user: "把一份 8000 字的研究报告拆成 6 个章节，并给出每章的一句话摘要。",
      output:
        "建议结构：\n\n" +
        "01 研究背景｜说明问题为何在当下值得被研究。\n" +
        "02 文献脉络｜归纳已有结论与尚未解决的矛盾。\n" +
        "03 研究设计｜交代样本、方法与评价指标。\n" +
        "04 核心发现｜用三组证据回答研究问题。\n" +
        "05 机制解释｜解释结果为何出现，以及边界条件。\n" +
        "06 结论与建议｜给出可执行建议与后续研究方向。\n\n" +
        "此回答来自示例会话，仅用于展示界面结构。",
      modelKey: "deepseek-v3.1",
      time: "昨天",
    },
  };

  const DEFAULT_COMPOSER_STATUS = "本地模拟 · 子智能体的答复会原样成为输出";

  const state = {
    view: "chat",
    theme: "dark",
    model: "deepseek-v3.2",
    reduceMotion: false,
    collapsed: false,
    busy: false,
    pending: null,
    runSeq: 0,
    activeSession: "current",
    sessionTitle: "新会话",
    snapshots: {},
    attachments: [],
    modalType: null,
    previousFocus: null,
    modelMenuOpen: false,
    palette: {
      all: [],
      filtered: [],
      active: 0,
      input: null,
      list: null,
    },
  };

  const els = {
    appShell: $("#appShell"),
    sidebar: $("#sidebar"),
    mobileBackdrop: $("#mobileBackdrop"),
    brandButton: $("#brandButton"),
    collapseSidebar: $("#collapseSidebar"),
    newChatButton: $("#newChatButton"),
    clearHistoryButton: $("#clearHistoryButton"),
    historySearch: $("#historySearch"),
    historyScroll: $("#historyScroll"),
    historyEmpty: $("#historyEmpty"),
    currentSessionTitle: $("#currentSessionTitle"),
    localBadge: $("#localBadge"),
    profileButton: $("#profileButton"),
    mobileMenuButton: $("#mobileMenuButton"),
    pageTitle: $("#pageTitle"),
    modelPicker: $("#modelPicker"),
    modelTrigger: $("#modelTrigger"),
    currentModelName: $("#currentModelName"),
    currentModelSub: $("#currentModelSub"),
    modelMenu: $("#modelMenu"),
    themeToggle: $("#themeToggle"),
    themeIconUse: $("#themeIconUse"),
    commandButton: $("#commandButton"),
    avatarButton: $("#avatarButton"),
    mainScroll: $("#mainScroll"),
    chatView: $("#chatView"),
    pluginsView: $("#pluginsView"),
    settingsView: $("#settingsView"),
    hero: $("#hero"),
    messages: $("#messages"),
    pluginDocsButton: $("#pluginDocsButton"),
    corePluginSwitch: $("#corePluginSwitch"),
    manifestButton: $("#manifestButton"),
    testDelegationButton: $("#testDelegationButton"),
    settingsSaved: $("#settingsSaved"),
    reduceMotionSwitch: $("#reduceMotionSwitch"),
    defaultModelSelect: $("#defaultModelSelect"),
    settingsSessionMeta: $("#settingsSessionMeta"),
    clearCurrentButton: $("#clearCurrentButton"),
    resetSettingsButton: $("#resetSettingsButton"),
    composerDock: $("#composerDock"),
    attachmentStrip: $("#attachmentStrip"),
    composerForm: $("#composerForm"),
    promptInput: $("#promptInput"),
    attachButton: $("#attachButton"),
    deepThinkButton: $("#deepThinkButton"),
    webSearchButton: $("#webSearchButton"),
    sendButton: $("#sendButton"),
    sendIconUse: $("#sendIconUse"),
    composerStatus: $("#composerStatus"),
    composerModelLabel: $("#composerModelLabel"),
    fileInput: $("#fileInput"),
    modalRoot: $("#modalRoot"),
    toastRegion: $("#toastRegion"),
  };

  /* ---------------------------------------------------------
     Small utilities
     --------------------------------------------------------- */

  function readStorage(key, fallback = null) {
    try {
      const value = window.localStorage.getItem(key);
      return value === null ? fallback : value;
    } catch (_error) {
      return fallback;
    }
  }

  function writeStorage(key, value) {
    try {
      window.localStorage.setItem(key, String(value));
    } catch (_error) {
      /* localStorage can be disabled; the demo still works. */
    }
  }

  function removeStorage(key) {
    try {
      window.localStorage.removeItem(key);
    } catch (_error) {
      /* noop */
    }
  }

  function truncateText(text, maxLength) {
    const normalized = text.replace(/\s+/g, " ").trim();
    const chars = [...normalized];
    if (chars.length <= maxLength) return normalized;
    return `${chars.slice(0, maxLength).join("")}…`;
  }

  function formatClock(totalSeconds) {
    const safeSeconds = Math.max(0, Math.floor(totalSeconds));
    const minutes = String(Math.floor(safeSeconds / 60)).padStart(2, "0");
    const seconds = String(safeSeconds % 60).padStart(2, "0");
    return `${minutes}:${seconds}`;
  }

  function nowTime() {
    return new Intl.DateTimeFormat("zh-CN", {
      hour: "2-digit",
      minute: "2-digit",
      hour12: false,
    }).format(new Date());
  }

  function randomId(length = 6) {
    return Math.random()
      .toString(36)
      .slice(2, 2 + length)
      .toUpperCase()
      .padEnd(length, "0");
  }

  function randomItem(items) {
    return items[Math.floor(Math.random() * items.length)];
  }

  function makeAgentMark(className = "") {
    const span = document.createElement("span");
    span.className = `agent-mark ${className}`.trim();
    span.setAttribute("aria-hidden", "true");
    span.innerHTML = '<svg class="icon"><use href="#i-spark"></use></svg>';
    return span;
  }

  function iconUse(id) {
    return `<svg class="icon"><use href="#${id}"></use></svg>`;
  }

  function scrollChatToBottom(behavior = "smooth") {
    window.requestAnimationFrame(() => {
      window.requestAnimationFrame(() => {
        els.mainScroll.scrollTo({
          top: els.mainScroll.scrollHeight,
          behavior: state.reduceMotion ? "auto" : behavior,
        });
      });
    });
  }

  /* ---------------------------------------------------------
     Toasts
     --------------------------------------------------------- */

  function showToast(message, type = "info") {
    const toast = document.createElement("div");
    toast.className = `toast${type === "success" ? " toast-success" : ""}${
      type === "warning" ? " toast-warning" : ""
    }`;

    const iconId = type === "success" ? "i-check-circle" : type === "warning" ? "i-info" : "i-info";
    toast.innerHTML = `<span class="toast-icon">${iconUse(iconId)}</span><span class="toast-copy"></span>`;
    $(".toast-copy", toast).textContent = message;
    els.toastRegion.appendChild(toast);

    while (els.toastRegion.children.length > 4) {
      els.toastRegion.firstElementChild.remove();
    }

    window.setTimeout(() => {
      toast.classList.add("is-leaving");
      window.setTimeout(() => toast.remove(), 200);
    }, 3300);
  }

  async function copyText(text) {
    try {
      await navigator.clipboard.writeText(text);
      return true;
    } catch (_error) {
      try {
        const helper = document.createElement("textarea");
        helper.value = text;
        helper.setAttribute("readonly", "");
        helper.style.position = "fixed";
        helper.style.opacity = "0";
        helper.style.pointerEvents = "none";
        document.body.appendChild(helper);
        helper.select();
        const copied = document.execCommand("copy");
        helper.remove();
        return copied;
      } catch (_fallbackError) {
        return false;
      }
    }
  }

  /* ---------------------------------------------------------
     Theme, motion, sidebar, model
     --------------------------------------------------------- */

  function setTheme(theme, options = {}) {
    const { persist = true, notify = false } = options;
    state.theme = theme === "light" ? "light" : "dark";
    document.documentElement.dataset.theme = state.theme;

    const isDark = state.theme === "dark";
    els.themeIconUse.setAttribute("href", isDark ? "#i-sun" : "#i-moon");
    els.themeToggle.title = isDark ? "切换到浅色模式" : "切换到深色模式";
    els.themeToggle.setAttribute("aria-label", els.themeToggle.title);

    const themeMeta = $('meta[name="theme-color"]');
    if (themeMeta) themeMeta.setAttribute("content", isDark ? "#090b11" : "#f2f5fa");

    $$(".theme-choice").forEach((button) => {
      const active = button.dataset.themeChoice === state.theme;
      button.classList.toggle("is-active", active);
      button.setAttribute("aria-pressed", String(active));
    });

    if (persist) writeStorage(LS.theme, state.theme);
    if (notify) {
      showToast(`已切换到${isDark ? "深色" : "浅色"}模式。`, "info");
    }
  }

  function setReduceMotion(enabled, options = {}) {
    const { persist = true, notify = false } = options;
    state.reduceMotion = Boolean(enabled);
    document.documentElement.classList.toggle("reduce-motion", state.reduceMotion);
    updateSwitch(els.reduceMotionSwitch, state.reduceMotion);
    if (persist) writeStorage(LS.reduceMotion, state.reduceMotion ? "1" : "0");
    if (notify) {
      showToast(state.reduceMotion ? "已减少动态效果。" : "已恢复动态效果。", "info");
    }
  }

  function updateSwitch(button, active) {
    if (!button) return;
    button.classList.toggle("is-on", Boolean(active));
    button.setAttribute("aria-checked", String(Boolean(active)));
  }

  function setCollapsed(collapsed, options = {}) {
    const { persist = true } = options;
    state.collapsed = Boolean(collapsed);
    els.appShell.classList.toggle("is-collapsed", state.collapsed);
    els.collapseSidebar.title = state.collapsed ? "展开侧边栏" : "收起侧边栏";
    els.collapseSidebar.setAttribute("aria-label", els.collapseSidebar.title);
    if (persist) writeStorage(LS.collapsed, state.collapsed ? "1" : "0");
  }

  function openMobileSidebar() {
    els.appShell.classList.add("sidebar-open");
    els.mobileMenuButton.setAttribute("aria-expanded", "true");
  }

  function closeMobileSidebar() {
    els.appShell.classList.remove("sidebar-open");
    els.mobileMenuButton.setAttribute("aria-expanded", "false");
  }

  function renderModelMenu() {
    const head = '<div class="model-menu-head"><span>选择模型</span><span>4 available</span></div>';
    const options = MODEL_ORDER.map((id) => {
      const model = MODELS[id];
      return `
        <button class="model-option" type="button" role="option" aria-selected="false" data-model-id="${id}">
          <span class="model-orb ${model.tone}">${iconUse(model.icon)}</span>
          <span class="model-option-copy">
            <strong>${model.name}</strong>
            <span>${model.sub} · ${model.description}</span>
          </span>
          <span class="model-option-check">${iconUse("i-check")}</span>
        </button>`;
    }).join("");
    const foot = `<div class="model-menu-foot">${iconUse(
      "i-info"
    )}模型与切换动画均为本地演示数据。</div>`;
    els.modelMenu.innerHTML = head + options + foot;
  }

  function populateModelSelect() {
    els.defaultModelSelect.innerHTML = MODEL_ORDER.map(
      (id) =>
        `<option value="${id}">${MODELS[id].name} · ${MODELS[id].sub}</option>`
    ).join("");
  }

  function selectModel(modelId, options = {}) {
    const { notify = true, persist = true } = options;
    const model = MODELS[modelId];
    if (!model) return;

    state.model = modelId;
    els.currentModelName.textContent = model.name;
    els.currentModelSub.textContent = model.sub;
    els.composerModelLabel.textContent = model.name;
    els.modelTrigger.setAttribute("aria-label", `选择模型，当前 ${model.name}`);

    const triggerOrb = $(".model-orb", els.modelTrigger);
    if (triggerOrb) {
      triggerOrb.className = `model-orb ${model.tone}`;
      const use = $("use", triggerOrb);
      if (use) use.setAttribute("href", `#${model.icon}`);
    }

    $$(".model-option", els.modelMenu).forEach((option) => {
      option.setAttribute("aria-selected", String(option.dataset.modelId === modelId));
    });

    if (els.defaultModelSelect) els.defaultModelSelect.value = modelId;
    if (persist) writeStorage(LS.model, modelId);
    if (notify) showToast(`已切换至 ${model.name}。`, "info");
  }

  function toggleModelMenu(force) {
    const willOpen = typeof force === "boolean" ? force : !state.modelMenuOpen;
    state.modelMenuOpen = willOpen;
    els.modelMenu.hidden = !willOpen;
    els.modelTrigger.setAttribute("aria-expanded", String(willOpen));
    if (willOpen) {
      const selected = $('.model-option[aria-selected="true"]', els.modelMenu);
      selected?.scrollIntoView({ block: "nearest" });
    }
  }

  function closeModelMenu() {
    if (!state.modelMenuOpen) return;
    toggleModelMenu(false);
  }

  /* ---------------------------------------------------------
     Page navigation
     --------------------------------------------------------- */

  function pageTitleForView() {
    if (state.view === "plugins") return "插件";
    if (state.view === "settings") return "设置";
    return state.sessionTitle;
  }

  function updatePageTitle() {
    const title = pageTitleForView();
    els.pageTitle.textContent = title;
    els.pageTitle.title = title;
    document.title =
      state.view === "chat"
        ? `${title} · DeepSeek Harness`
        : `${title} · DeepSeek Harness`;
  }

  function setView(view, options = {}) {
    const { force = false } = options;
    if (!["chat", "plugins", "settings"].includes(view)) return;

    if (state.busy && view !== "chat" && !force) {
      showToast("委托仍在进行中，请先完成或停止当前任务。", "warning");
      return;
    }

    state.view = view;

    const views = {
      chat: els.chatView,
      plugins: els.pluginsView,
      settings: els.settingsView,
    };
    Object.entries(views).forEach(([key, element]) => {
      element.hidden = key !== view;
    });

    $$(".nav-item").forEach((button) => {
      button.classList.toggle("is-active", button.dataset.view === view);
    });

    els.composerDock.classList.toggle("is-hidden", view !== "chat");
    updatePageTitle();
    closeModelMenu();
    closeMobileSidebar();

    if (view === "settings") updateSettingsUI();

    if (view === "chat") {
      scrollChatToBottom("auto");
    } else {
      els.mainScroll.scrollTo({ top: 0, behavior: state.reduceMotion ? "auto" : "smooth" });
    }
  }

  /* ---------------------------------------------------------
     Sessions and history
     --------------------------------------------------------- */

  function createUserMessage(text, time = nowTime()) {
    const article = document.createElement("article");
    article.className = "message message-user";
    article.innerHTML = `
      <div class="message-main">
        <div class="user-meta"><strong>你</strong><span>${time}</span></div>
        <div class="user-bubble"></div>
      </div>
      <span class="avatar user-avatar" aria-hidden="true">Y</span>`;
    $(".user-bubble", article).textContent = text;
    return article;
  }

  function createStaticAssistantMessage({ modelKey, time, output }) {
    const model = MODELS[modelKey] || MODELS["deepseek-v3.2"];
    const article = document.createElement("article");
    article.className = "message message-assistant";
    article.innerHTML = `
      <span class="agent-mark assistant-avatar" aria-hidden="true">${iconUse("i-spark")}</span>
      <div class="message-main">
        <div class="assistant-head">
          <span class="assistant-name">Harness</span>
          <span class="assistant-model">${model.short}</span>
          <time class="message-time">${time}</time>
          <span class="run-state is-complete">已完成</span>
        </div>
        <div class="result-block">
          <div class="result-head">
            <span class="subagent-chip">${iconUse("i-users")}SUBAGENT RETURN</span>
            <span class="result-caption">示例会话 · 子智能体回复</span>
          </div>
          <div class="result-text"></div>
        </div>
        <div class="message-actions">
          <button class="message-action" type="button" data-action="copy">${iconUse("i-copy")}复制</button>
        </div>
      </div>`;
    $(".result-text", article).textContent = output;
    return article;
  }

  function buildSampleSnapshot(key) {
    const sample = SAMPLE_SESSIONS[key];
    if (!sample) return { title: "示例会话", html: "", heroHidden: true };
    const holder = document.createElement("div");
    holder.appendChild(createUserMessage(sample.user, sample.time));
    holder.appendChild(
      createStaticAssistantMessage({
        modelKey: sample.modelKey,
        time: sample.time,
        output: sample.output,
      })
    );
    return {
      title: sample.title,
      html: holder.innerHTML,
      heroHidden: true,
    };
  }

  function getSnapshot(key) {
    if (!state.snapshots[key]) {
      state.snapshots[key] = buildSampleSnapshot(key);
    }
    return state.snapshots[key];
  }

  function saveActiveSnapshot() {
    const snapshot = getSnapshot(state.activeSession);
    snapshot.html = els.messages.innerHTML;
    snapshot.heroHidden = els.hero.hidden;
    snapshot.title = state.sessionTitle;
    state.snapshots[state.activeSession] = snapshot;
  }

  function setHistoryActive(key) {
    $$(".history-item").forEach((button) => {
      const active = button.dataset.session === key;
      button.classList.toggle("is-active", active);
      if (active) {
        button.setAttribute("aria-current", "page");
      } else {
        button.removeAttribute("aria-current");
      }
    });
  }

  function updateSettingsMeta() {
    const count = els.messages.querySelectorAll(".message").length;
    if (!count) {
      els.settingsSessionMeta.textContent = "还没有发送过消息";
      return;
    }
    els.settingsSessionMeta.textContent = `${truncateText(state.sessionTitle, 20)} · ${count} 条消息`;
  }

  function switchSession(key, options = {}) {
    const { notify = false } = options;
    if (state.busy) {
      showToast("请先完成或停止当前委托，再切换会话。", "warning");
      return;
    }
    if (state.modalType) return;
    if (!key) return;

    closeMobileSidebar();

    if (key === state.activeSession) {
      if (state.view !== "chat") setView("chat");
      return;
    }

    saveActiveSnapshot();
    const snapshot = getSnapshot(key);

    state.activeSession = key;
    state.sessionTitle = snapshot.title;
    els.messages.innerHTML = snapshot.html;
    els.hero.hidden = snapshot.heroHidden;
    els.currentSessionTitle.textContent = getSnapshot("current").title;
    setHistoryActive(key);

    if (state.view !== "chat") {
      setView("chat");
    } else {
      updatePageTitle();
      scrollChatToBottom("auto");
    }

    updateSettingsMeta();
    if (notify) showToast(`已打开示例会话「${snapshot.title}」。`, "info");
  }

  function resetCurrentSession(options = {}) {
    const { goChat = true, notify = true } = options;
    if (state.busy) {
      showToast("请先完成或停止当前委托。", "warning");
      return;
    }

    if (state.activeSession !== "current") {
      saveActiveSnapshot();
    }

    state.snapshots.current = {
      title: "新会话",
      html: "",
      heroHidden: false,
    };
    state.activeSession = "current";
    state.sessionTitle = "新会话";
    els.messages.innerHTML = "";
    els.hero.hidden = false;
    els.currentSessionTitle.textContent = "新会话";
    els.currentSessionTitle.title = "新会话";
    els.promptInput.value = "";
    state.attachments = [];
    renderAttachments();
    autoResizeComposer();
    updateComposerState();
    setHistoryActive("current");
    closeMobileSidebar();
    if (els.historySearch.value) {
      els.historySearch.value = "";
      filterHistory();
    }

    if (goChat) {
      setView("chat");
    } else {
      updatePageTitle();
    }

    updateSettingsMeta();
    scrollChatToBottom("auto");
    if (notify) showToast("已开始新会话。", "success");
    if (goChat) window.setTimeout(() => els.promptInput.focus(), 60);
  }

  function filterHistory() {
    const query = els.historySearch.value.trim().toLowerCase();
    let visibleCount = 0;

    $$(".history-item").forEach((item) => {
      const matches = !query || item.textContent.toLowerCase().includes(query);
      item.hidden = !matches;
      if (matches) visibleCount += 1;
    });

    $$(".history-group").forEach((group) => {
      const hasVisible = $$(".history-item", group).some((item) => !item.hidden);
      group.hidden = !hasVisible;
    });

    els.historyEmpty.hidden = visibleCount > 0 || !query;
  }

  /* ---------------------------------------------------------
     Composer
     --------------------------------------------------------- */

  function autoResizeComposer() {
    const input = els.promptInput;
    input.style.height = "auto";
    const nextHeight = Math.min(input.scrollHeight, 190);
    input.style.height = `${Math.max(nextHeight, 47)}px`;
  }

  function setPromptValue(value) {
    els.promptInput.value = value;
    autoResizeComposer();
    updateComposerState();
    els.promptInput.focus();
    els.promptInput.setSelectionRange(value.length, value.length);
    scrollChatToBottom("auto");
  }

  function updateComposerState() {
    const hasText = els.promptInput.value.trim().length > 0;
    if (state.busy) {
      els.sendButton.disabled = false;
      els.sendButton.classList.add("is-stop");
      els.sendButton.setAttribute("aria-label", "停止生成");
      els.sendIconUse.setAttribute("href", "#i-stop");
    } else {
      els.sendButton.disabled = !hasText;
      els.sendButton.classList.remove("is-stop");
      els.sendButton.setAttribute("aria-label", "发送消息");
      els.sendIconUse.setAttribute("href", "#i-arrow-up");
    }
  }

  function setComposerStatus(text, tone = "default") {
    els.composerStatus.classList.toggle("is-busy", tone === "busy");
    els.composerStatus.textContent = "";
    const dot = document.createElement("span");
    dot.className = "meta-dot";
    els.composerStatus.append(dot, document.createTextNode(text));
  }

  function setBusy(busy, statusText) {
    state.busy = Boolean(busy);
    updateComposerState();
    if (state.busy) {
      setComposerStatus(statusText || "Harness 正在处理…", "busy");
    } else if (!state.pending) {
      setComposerStatus(DEFAULT_COMPOSER_STATUS);
    }
  }

  function renderAttachments() {
    els.attachmentStrip.innerHTML = "";
    els.attachmentStrip.hidden = state.attachments.length === 0;
    state.attachments.forEach((name, index) => {
      const chip = document.createElement("span");
      chip.className = "attachment-chip";
      chip.innerHTML = `${iconUse("i-file")}<span class="attachment-name"></span><button class="attachment-remove" type="button" data-remove-attachment="${index}" aria-label="移除附件">${iconUse("i-x")}</button>`;
      $(".attachment-name", chip).textContent = name;
      els.attachmentStrip.appendChild(chip);
    });
  }

  function clearPromptAndAttachments() {
    els.promptInput.value = "";
    state.attachments = [];
    renderAttachments();
    autoResizeComposer();
    updateComposerState();
  }

  function handleComposerSubmit(event) {
    event.preventDefault();
    if (state.busy) {
      cancelPendingRun("你停止了当前生成，父智能体没有收到答复。");
      return;
    }
    const question = els.promptInput.value;
    if (!question.trim()) return;
    clearPromptAndAttachments();
    startDelegation(question);
  }

  /* ---------------------------------------------------------
     Delegation run
     --------------------------------------------------------- */

  function createAssistantMessage({ modelKey, time }) {
    const model = MODELS[modelKey] || MODELS["deepseek-v3.2"];
    const article = document.createElement("article");
    article.className = "message message-assistant";
    article.innerHTML = `
      <span class="agent-mark assistant-avatar" aria-hidden="true">${iconUse("i-spark")}</span>
      <div class="message-main">
        <div class="assistant-head">
          <span class="assistant-name">Harness</span>
          <span class="assistant-model">${model.short}</span>
          <time class="message-time">${time}</time>
          <span class="run-state">运行中</span>
        </div>
        <div class="activity">
          <div class="activity-head">
            <span class="activity-orb" aria-hidden="true"></span>
            <span class="activity-title"></span>
            <span class="activity-elapsed">00:00</span>
          </div>
          <div class="activity-steps"></div>
        </div>
        <div class="assistant-output"></div>
        <div class="message-actions" hidden>
          <button class="message-action" type="button" data-action="copy">${iconUse("i-copy")}复制</button>
        </div>
      </div>`;

    return {
      article,
      activity: $(".activity", article),
      activityTitle: $(".activity-title", article),
      elapsed: $(".activity-elapsed", article),
      stepsEl: $(".activity-steps", article),
      runState: $(".run-state", article),
      output: $(".assistant-output", article),
      actions: $(".message-actions", article),
    };
  }

  function setActivityTitle(run, text, withDots = true) {
    const title = run.assistant.activityTitle;
    title.textContent = "";
    title.append(document.createTextNode(text));
    if (withDots) {
      const dots = document.createElement("span");
      dots.className = "thinking-dots";
      title.appendChild(dots);
    }
  }

  function addActivityStep(run, title, detail) {
    const step = document.createElement("div");
    step.className = "activity-step is-active";
    step.innerHTML = `
      <span class="step-indicator">
        <span class="step-spinner"></span>
        <svg class="icon step-check"><use href="#i-check"></use></svg>
      </span>
      <span class="step-copy"><strong></strong><small></small></span>`;
    $("strong", step).textContent = title;
    $("small", step).textContent = detail;
    run.assistant.stepsEl.appendChild(step);
    run.currentStep = step;
  }

  function completeCurrentStep(run) {
    if (!run.currentStep) return;
    run.currentStep.classList.remove("is-active");
    run.currentStep.classList.add("is-done");
    run.currentStep = null;
  }

  function scheduleRun(run, delay, callback) {
    const timer = window.setTimeout(() => {
      run.timers.delete(timer);
      if (state.pending !== run) return;
      callback();
    }, delay);
    run.timers.add(timer);
    return timer;
  }

  function updateActivityElapsed(run) {
    const seconds = (Date.now() - run.startedAt) / 1000;
    run.assistant.elapsed.textContent = formatClock(seconds);
  }

  function startDelegation(question) {
    if (state.busy) return;

    state.busy = true;
    els.hero.hidden = true;

    if (state.activeSession === "current" && state.snapshots.current.title === "新会话") {
      const title = truncateText(question, 22);
      state.sessionTitle = title;
      state.snapshots.current.title = title;
      els.currentSessionTitle.textContent = title;
      els.currentSessionTitle.title = question;
      if (state.view === "chat") updatePageTitle();
    }

    els.messages.appendChild(createUserMessage(question));

    const run = {
      id: ++state.runSeq,
      question,
      answer: "",
      modelKey: state.model,
      startedAt: Date.now(),
      status: "running",
      assistant: null,
      currentStep: null,
      timers: new Set(),
      activityInterval: null,
      modalInterval: null,
      returnTimer: null,
      modalEl: null,
    };

    run.assistant = createAssistantMessage({
      modelKey: run.modelKey,
      time: nowTime(),
    });
    els.messages.appendChild(run.assistant.article);

    state.pending = run;
    setBusy(true, "Harness 正在思考…");
    updateSettingsMeta();
    scrollChatToBottom("smooth");

    addActivityStep(run, "正在思考", "解析意图、约束与期望的交付物");
    setActivityTitle(run, "正在思考");
    updateActivityElapsed(run);
    run.activityInterval = window.setInterval(() => updateActivityElapsed(run), 250);

    scheduleRun(run, 900, () => {
      completeCurrentStep(run);
      addActivityStep(run, "正在规划任务", "拆解为 3 个可执行的子任务");
      setActivityTitle(run, "正在规划任务");
      setComposerStatus("Harness 正在规划任务…", "busy");
    });

    scheduleRun(run, 1750, () => {
      completeCurrentStep(run);
      addActivityStep(run, "正在协调子智能体", "通过「子智能体委托」建立上下文通道");
      setActivityTitle(run, "正在协调子智能体");
      setComposerStatus("Harness 正在协调子智能体…", "busy");
    });

    scheduleRun(run, 2600, () => {
      completeCurrentStep(run);
      addActivityStep(run, "等待子智能体回传", "子智能体已领取任务，等待你的输入");
      setActivityTitle(run, "等待子智能体回传");
      setComposerStatus("子智能体已接单，等待你的答复…", "busy");
    });

    scheduleRun(run, 3300, () => {
      openDelegateModal(run);
    });
  }

  function openDelegateModal(run) {
    if (state.pending !== run || state.busy !== true) return;
    closeModelMenu();

    const model = MODELS[run.modelKey] || MODELS["deepseek-v3.2"];
    const taskId = `tsk_${randomId(7).toLowerCase()}`;
    const codename = `${randomItem(["scout", "weaver", "atlas", "nimbus", "kite", "echo"])}-${String(
      Math.floor(Math.random() * 90) + 10
    )}`;
    const priority = randomItem(["标准", "P1 · 高", "常规"]);
    const layer = document.createElement("div");
    layer.className = "modal-layer";
    layer.id = "delegateLayer";
    layer.innerHTML = `
      <div class="delegate-window" role="dialog" aria-modal="true" aria-labelledby="delegateTitle" aria-describedby="delegateDescription">
        <div class="window-bar">
          <div class="window-dots" aria-hidden="true"><span></span><span></span><span></span></div>
          <div class="window-title">${iconUse("i-terminal")}subagent://delegate</div>
          <div class="window-lock">${iconUse("i-lock")}内核锁定</div>
        </div>
        <div class="delegate-scroll">
          <div class="delegate-header">
            <span class="delegate-orb" aria-hidden="true">${iconUse("i-users")}</span>
            <div class="delegate-heading">
              <div class="delegate-kicker"><span class="dot"></span>SUBAGENT TASK · 父智能体发起的委托</div>
              <h2 id="delegateTitle">子智能体委托</h2>
            </div>
            <span class="delegate-status"><span class="pulse"></span>等待你的答复</span>
          </div>
          <div class="delegate-meta">
            <span class="delegate-meta-item">父智能体 <strong>harness-main</strong></span>
            <span class="delegate-meta-item">模型 <strong data-delegate-model></strong></span>
            <span class="delegate-meta-item">子智能体 <strong data-delegate-agent></strong></span>
            <span class="delegate-meta-item">优先级 <strong data-delegate-priority></strong></span>
            <span class="delegate-meta-item">${iconUse("i-clock")}<strong id="delegateTimer">00:00</strong></span>
          </div>
          <div class="task-card">
            <div class="task-card-head">
              <span class="task-label">${iconUse("i-route")}任务描述</span>
              <span class="task-id" data-task-id></span>
            </div>
            <p class="parent-requirement" id="delegateDescription">你的父智能体发送了要求：</p>
            <blockquote class="task-question" id="delegateQuestion"></blockquote>
            <p class="task-instruction">${iconUse(
              "i-info"
            )}请以子智能体身份完成上述任务。点击「提交并回传」后，父智能体将把你的原文作为最终输出展示在会话中。</p>
          </div>
          <div class="answer-field">
            <div class="answer-label-row">
              <label class="answer-label" for="delegateAnswer">你的答复</label>
              <span class="answer-count" id="delegateAnswerCount">0 / 4000</span>
            </div>
            <textarea class="delegate-textarea" id="delegateAnswer" maxlength="4000" placeholder="输入你想让父智能体看到的最终输出…"></textarea>
            <div class="answer-hint-row">
              <span class="answer-hint">${iconUse(
                "i-info"
              )}这段内容不会经过改写，将直接回传到会话中。</span>
              <span class="answer-shortcut">Ctrl / ⌘ + Enter 提交</span>
            </div>
            <p class="delegate-error" id="delegateError" hidden>请先输入答复，再提交给父智能体。</p>
          </div>
        </div>
        <div class="delegate-footer">
          <span class="delegate-footer-note">${iconUse(
            "i-shield"
          )}本地模拟通道 · 数据不会离开浏览器</span>
          <div class="delegate-footer-actions">
            <button class="button button-secondary" id="cancelDelegation" type="button">终止委托</button>
            <button class="button button-primary" id="submitDelegation" type="button" disabled>
              <span>提交并回传</span>${iconUse("i-arrow-right")}
            </button>
          </div>
        </div>
      </div>`;

    els.modalRoot.replaceChildren(layer);
    document.body.classList.add("modal-open");
    state.modalType = "delegate";
    state.previousFocus = document.activeElement;
    run.modalEl = layer;
    run.status = "awaiting";

    $("[data-delegate-model]", layer).textContent = model.short;
    $("[data-delegate-agent]", layer).textContent = codename;
    $("[data-delegate-priority]", layer).textContent = priority;
    $("[data-task-id]", layer).textContent = `任务 ${taskId}`;
    $("#delegateQuestion", layer).textContent = run.question;

    const answer = $("#delegateAnswer", layer);
    const answerCount = $("#delegateAnswerCount", layer);
    const error = $("#delegateError", layer);
    const submit = $("#submitDelegation", layer);
    const cancel = $("#cancelDelegation", layer);

    answer.addEventListener("input", () => {
      answerCount.textContent = `${answer.value.length} / 4000`;
      submit.disabled = answer.value.trim().length === 0;
      error.hidden = true;
    });

    answer.addEventListener("keydown", (event) => {
      if ((event.ctrlKey || event.metaKey) && event.key === "Enter") {
        event.preventDefault();
        submitDelegation(run);
      }
    });

    cancel.addEventListener("click", () => {
      cancelPendingRun("你终止了本次委托，父智能体没有收到答复。");
    });

    submit.addEventListener("click", () => submitDelegation(run));

    layer.addEventListener("click", (event) => {
      event.stopPropagation();
    });

    const modalStartedAt = Date.now();
    run.modalInterval = window.setInterval(() => {
      const timer = $("#delegateTimer", layer);
      if (timer) timer.textContent = formatClock((Date.now() - modalStartedAt) / 1000);
    }, 1000);

    window.setTimeout(() => {
      if (state.pending === run && state.modalType === "delegate") answer.focus();
    }, 180);
  }

  function submitDelegation(run) {
    if (state.pending !== run || state.modalType !== "delegate" || run.status !== "awaiting") return;
    const layer = run.modalEl;
    if (!layer) return;

    const answerEl = $("#delegateAnswer", layer);
    const errorEl = $("#delegateError", layer);
    const value = answerEl.value;
    if (!value.trim()) {
      errorEl.hidden = false;
      answerEl.focus();
      return;
    }

    run.answer = value;
    run.status = "returning";

    const submit = $("#submitDelegation", layer);
    const cancel = $("#cancelDelegation", layer);
    const status = $(".delegate-status", layer);
    answerEl.readOnly = true;
    submit.disabled = true;
    cancel.disabled = true;
    submit.classList.add("is-returning");
    submit.innerHTML = `${iconUse("i-refresh")}<span>正在回传…</span>`;
    status.innerHTML = '<span class="pulse"></span>正在回传结果';

    run.returnTimer = window.setTimeout(() => {
      finishDelegation(run);
    }, 780);
  }

  function finishDelegation(run) {
    if (state.pending !== run) return;

    run.status = "done";
    clearRunTimers(run);
    closeDelegateModal({ restoreFocus: false });

    completeCurrentStep(run);
    $$(".activity-step", run.assistant.stepsEl).forEach((step) => {
      step.classList.remove("is-active");
      step.classList.add("is-done");
    });

    run.assistant.activity.classList.add("is-complete");
    setActivityTitle(run, "子智能体已返回结果", false);
    run.assistant.elapsed.textContent = formatClock((Date.now() - run.startedAt) / 1000);
    run.assistant.runState.textContent = "已完成";
    run.assistant.runState.classList.add("is-complete");
    run.assistant.output.appendChild(createResultBlock(run.answer));

    run.assistant.actions.hidden = false;
    state.pending = null;
    setBusy(false);
    updateSettingsMeta();
    scrollChatToBottom("smooth");
    showToast("子智能体已返回结果，父智能体已原样采纳你的答复。", "success");
    window.setTimeout(() => els.promptInput.focus(), 80);
  }

  function createResultBlock(text) {
    const block = document.createElement("div");
    block.className = "result-block";
    block.innerHTML = `
      <div class="result-head">
        <span class="subagent-chip">${iconUse("i-users")}SUBAGENT RETURN</span>
        <span class="result-caption">子智能体回复 · 父智能体原样采纳</span>
      </div>
      <div class="result-text"></div>`;
    $(".result-text", block).textContent = text;
    return block;
  }

  function clearRunTimers(run) {
    run.timers.forEach((timer) => window.clearTimeout(timer));
    run.timers.clear();
    if (run.activityInterval) {
      window.clearInterval(run.activityInterval);
      run.activityInterval = null;
    }
    if (run.modalInterval) {
      window.clearInterval(run.modalInterval);
      run.modalInterval = null;
    }
    if (run.returnTimer) {
      window.clearTimeout(run.returnTimer);
      run.returnTimer = null;
    }
  }

  function cancelPendingRun(reason, options = {}) {
    const { notify = true } = options;
    const run = state.pending;
    if (!run) return;

    run.status = "canceled";
    clearRunTimers(run);
    closeDelegateModal({ restoreFocus: false });

    $$(".activity-step", run.assistant.stepsEl).forEach((step) => {
      step.classList.remove("is-active");
    });

    run.assistant.activity.classList.add("is-canceled");
    setActivityTitle(run, "委托已终止", false);
    run.assistant.elapsed.textContent = "已停止";
    run.assistant.runState.textContent = "已停止";
    run.assistant.runState.classList.add("is-canceled");

    const note = document.createElement("div");
    note.className = "activity-note";
    note.innerHTML = `${iconUse("i-info")}<span></span>`;
    $("span", note).textContent = reason;
    run.assistant.activity.appendChild(note);

    state.pending = null;
    setBusy(false);
    updateSettingsMeta();
    if (notify) showToast(reason, "warning");
    window.setTimeout(() => els.promptInput.focus(), 80);
  }

  function closeDelegateModal(options = {}) {
    const { restoreFocus = true } = options;
    const run = state.pending;
    if (run && run.modalInterval) {
      window.clearInterval(run.modalInterval);
      run.modalInterval = null;
    }
    const layer = $("#delegateLayer");
    if (layer) layer.remove();
    if (!els.modalRoot.children.length) {
      document.body.classList.remove("modal-open");
    }
    if (state.modalType === "delegate") state.modalType = null;
    if (restoreFocus) {
      const target = state.previousFocus;
      state.previousFocus = null;
      if (target && typeof target.focus === "function") target.focus();
    }
  }

  /* ---------------------------------------------------------
     Command palette
     --------------------------------------------------------- */

  function buildPaletteActions() {
    const actions = [
      {
        id: "new-chat",
        label: "新建会话",
        description: "清空当前画布，开始新的委托",
        icon: "i-plus",
        shortcut: "⌘ N",
        keywords: "new chat session",
        run: () => resetCurrentSession(),
      },
      {
        id: "plugins",
        label: "打开插件",
        description: "查看被内核锁定的「子智能体委托」",
        icon: "i-puzzle",
        shortcut: "⌘ 2",
        keywords: "plugin extension",
        run: () => setView("plugins"),
      },
      {
        id: "settings",
        label: "打开设置",
        description: "外观、模型与本地数据",
        icon: "i-settings",
        shortcut: "⌘ 3",
        keywords: "settings preferences",
        run: () => setView("settings"),
      },
      {
        id: "theme",
        label: state.theme === "dark" ? "切换到浅色模式" : "切换到深色模式",
        description: "立即切换整个界面的配色",
        icon: state.theme === "dark" ? "i-sun" : "i-moon",
        keywords: "theme light dark appearance",
        run: () => setTheme(state.theme === "dark" ? "light" : "dark", { notify: true }),
      },
      {
        id: "demo-delegation",
        label: "发起一次委托演示",
        description: "填入一个任务，发送后体验子智能体窗口",
        icon: "i-users",
        keywords: "delegate subagent demo",
        run: () => {
          setView("chat");
          setPromptValue(
            "请演示一次子智能体委托：把「为猫咪设计一个智能喂食器」拆成三个可执行任务，并给出优先级。"
          );
          showToast("示例任务已填入，点击发送即可开始。", "info");
        },
      },
    ];

    MODEL_ORDER.forEach((id) => {
      const model = MODELS[id];
      actions.push({
        id: `model-${id}`,
        label: `切换到 ${model.name}`,
        description: `${model.sub} · ${model.description}`,
        icon: model.icon,
        keywords: `${model.name} model ${model.short}`,
        run: () => {
          selectModel(id);
          setView("chat");
        },
      });
    });

    return actions;
  }

  function renderPaletteActions() {
    const query = state.palette.input.value.trim().toLowerCase();
    const list = state.palette.list;
    state.palette.filtered = state.palette.all.filter((action) => {
      if (!query) return true;
      return `${action.label} ${action.description} ${action.keywords}`
        .toLowerCase()
        .includes(query);
    });
    state.palette.active = 0;

    if (!state.palette.filtered.length) {
      list.innerHTML = '<div class="palette-empty">没有匹配的命令</div>';
      return;
    }

    list.innerHTML =
      '<div class="palette-section-label">命令</div>' +
      state.palette.filtered
        .map(
          (action, index) => `
          <button class="palette-item${index === 0 ? " is-active" : ""}" type="button" data-palette-index="${index}">
            <span class="palette-item-icon">${iconUse(action.icon)}</span>
            <span class="palette-item-copy">
              <strong>${action.label}</strong>
              <span>${action.description}</span>
            </span>
            ${action.shortcut ? `<kbd>${action.shortcut}</kbd>` : ""}
          </button>`
        )
        .join("");
  }

  function setPaletteActive(index) {
    const items = $$(".palette-item", state.palette.list);
    if (!items.length) return;
    const bounded = (index + items.length) % items.length;
    state.palette.active = bounded;
    items.forEach((item, itemIndex) => {
      item.classList.toggle("is-active", itemIndex === bounded);
    });
    items[bounded].scrollIntoView({ block: "nearest" });
  }

  function executePaletteIndex(index) {
    const action = state.palette.filtered[index];
    if (!action) return;
    closeCommandPalette({ restoreFocus: false });
    window.setTimeout(() => action.run(), 30);
  }

  function openCommandPalette() {
    if (state.modalType) return;
    if (state.busy) {
      showToast("委托执行中，暂时无法打开命令面板。", "warning");
      return;
    }

    closeModelMenu();
    state.previousFocus = document.activeElement;
    const layer = document.createElement("div");
    layer.className = "modal-layer palette-layer";
    layer.id = "paletteLayer";
    layer.innerHTML = `
      <div class="palette-window" role="dialog" aria-modal="true" aria-label="命令面板">
        <div class="palette-search">
          ${iconUse("i-search")}
          <input id="paletteInput" type="text" placeholder="搜索命令或模型…" autocomplete="off" aria-label="搜索命令">
          <kbd>ESC</kbd>
        </div>
        <div class="palette-list" id="paletteList"></div>
        <div class="palette-footer"><span>↑ ↓ 选择 · ↵ 执行</span><span>DSH CLIENT SIMULATOR</span></div>
      </div>`;
    els.modalRoot.replaceChildren(layer);
    document.body.classList.add("modal-open");
    state.modalType = "command";

    state.palette.all = buildPaletteActions();
    state.palette.input = $("#paletteInput", layer);
    state.palette.list = $("#paletteList", layer);
    renderPaletteActions();

    state.palette.input.addEventListener("input", renderPaletteActions);
    state.palette.list.addEventListener("click", (event) => {
      const item = event.target.closest("[data-palette-index]");
      if (!item) return;
      executePaletteIndex(Number(item.dataset.paletteIndex));
    });
    layer.addEventListener("click", (event) => {
      if (event.target === layer) closeCommandPalette();
    });
    window.setTimeout(() => state.palette.input.focus(), 40);
  }

  function closeCommandPalette(options = {}) {
    const { restoreFocus = true } = options;
    const layer = $("#paletteLayer");
    if (layer) layer.remove();
    if (!els.modalRoot.children.length) {
      document.body.classList.remove("modal-open");
    }
    if (state.modalType === "command") state.modalType = null;
    state.palette.input = null;
    state.palette.list = null;
    if (restoreFocus) {
      const target = state.previousFocus;
      state.previousFocus = null;
      if (target && typeof target.focus === "function") target.focus();
    }
  }

  /* ---------------------------------------------------------
     Manifest modal
     --------------------------------------------------------- */

  const PLUGIN_MANIFEST = {
    id: "dsh.core.subagent-delegate",
    name: "子智能体委托",
    version: "2.4.1",
    publisher: "harness-kernel",
    locked: true,
    enabled: true,
    description: "将复杂任务拆解并委托给具备独立上下文的子智能体。",
    permissions: ["session.read", "subagent.create", "result.write"],
    config: {
      autoDecompose: true,
      maxParallelSubagents: 3,
      returnStrategy: "verbatim",
    },
    entry: "kernel://extensions/subagent-delegate",
  };

  function openManifestModal() {
    if (state.modalType) return;
    closeModelMenu();
    state.previousFocus = document.activeElement;
    const layer = document.createElement("div");
    layer.className = "modal-layer";
    layer.id = "manifestLayer";
    layer.innerHTML = `
      <div class="manifest-window" role="dialog" aria-modal="true" aria-labelledby="manifestTitle">
        <div class="manifest-head">
          <span class="manifest-icon">${iconUse("i-code")}</span>
          <div class="manifest-title">
            <h2 id="manifestTitle">插件 manifest</h2>
            <p>只读声明 · 由 Harness Kernel 托管</p>
          </div>
          <button class="icon-button manifest-close" id="manifestClose" type="button" aria-label="关闭">${iconUse(
            "i-x"
          )}</button>
        </div>
        <div class="manifest-body">
          <pre class="manifest-code" id="manifestCode"></pre>
        </div>
        <div class="manifest-foot">
          <span class="manifest-note">演示数据 · 不对应真实插件</span>
          <div class="settings-actions" style="margin:0">
            <button class="ghost-button small-button" id="manifestCopy" type="button">${iconUse(
              "i-copy"
            )}复制 JSON</button>
            <button class="secondary-button small-button" id="manifestDone" type="button">关闭</button>
          </div>
        </div>
      </div>`;
    els.modalRoot.replaceChildren(layer);
    document.body.classList.add("modal-open");
    state.modalType = "manifest";

    $("#manifestCode", layer).textContent = JSON.stringify(PLUGIN_MANIFEST, null, 2);

    const close = () => closeManifestModal();
    $("#manifestClose", layer).addEventListener("click", close);
    $("#manifestDone", layer).addEventListener("click", close);
    $("#manifestCopy", layer).addEventListener("click", async () => {
      const ok = await copyText(JSON.stringify(PLUGIN_MANIFEST, null, 2));
      showToast(ok ? "manifest 已复制到剪贴板。" : "复制失败，请手动选择内容。", ok ? "success" : "warning");
    });
    layer.addEventListener("click", (event) => {
      if (event.target === layer) close();
    });
    $("#manifestClose", layer).focus();
  }

  function closeManifestModal(options = {}) {
    const { restoreFocus = true } = options;
    const layer = $("#manifestLayer");
    if (layer) layer.remove();
    if (!els.modalRoot.children.length) {
      document.body.classList.remove("modal-open");
    }
    if (state.modalType === "manifest") state.modalType = null;
    if (restoreFocus) {
      const target = state.previousFocus;
      state.previousFocus = null;
      if (target && typeof target.focus === "function") target.focus();
    }
  }

  /* ---------------------------------------------------------
     Settings UI
     --------------------------------------------------------- */

  function updateSettingsUI() {
    $$(".theme-choice").forEach((button) => {
      const active = button.dataset.themeChoice === state.theme;
      button.classList.toggle("is-active", active);
      button.setAttribute("aria-pressed", String(active));
    });
    updateSwitch(els.reduceMotionSwitch, state.reduceMotion);
    els.defaultModelSelect.value = state.model;
    updateSettingsMeta();
  }

  function resetPreferences() {
    setTheme("dark", { persist: true });
    setReduceMotion(false, { persist: true });
    selectModel("deepseek-v3.2", { persist: true, notify: false });
    setCollapsed(false);
    showToast("已恢复默认设置。", "success");
  }

  /* ---------------------------------------------------------
     Global keyboard, focus trap, event binding
     --------------------------------------------------------- */

  function getFocusable(container) {
    return $$(
      'button:not([disabled]), input:not([disabled]), textarea:not([disabled]), select:not([disabled]), a[href], [tabindex]:not([tabindex="-1"])',
      container
    ).filter((element) => element.offsetParent !== null);
  }

  function trapFocus(event, container) {
    if (event.key !== "Tab") return;
    const focusable = getFocusable(container);
    if (!focusable.length) return;
    const first = focusable[0];
    const last = focusable[focusable.length - 1];
    if (event.shiftKey && document.activeElement === first) {
      event.preventDefault();
      last.focus();
    } else if (!event.shiftKey && document.activeElement === last) {
      event.preventDefault();
      first.focus();
    }
  }

  function handleGlobalKeydown(event) {
    if (state.modalType === "delegate") {
      const windowEl = $(".delegate-window");
      if (windowEl) trapFocus(event, windowEl);
      if (event.key === "Escape") {
        event.preventDefault();
        showToast("请提交答复，或点击「终止委托」退出。", "warning");
      }
      return;
    }

    if (state.modalType === "manifest") {
      const windowEl = $(".manifest-window");
      if (windowEl) trapFocus(event, windowEl);
      if (event.key === "Escape") {
        event.preventDefault();
        closeManifestModal();
      }
      return;
    }

    if (state.modalType === "command") {
      const windowEl = $(".palette-window");
      if (windowEl) trapFocus(event, windowEl);
      if ((event.ctrlKey || event.metaKey) && event.key.toLowerCase() === "k") {
        event.preventDefault();
        closeCommandPalette();
      } else if (event.key === "Escape") {
        event.preventDefault();
        closeCommandPalette();
      } else if (event.key === "ArrowDown") {
        event.preventDefault();
        setPaletteActive(state.palette.active + 1);
      } else if (event.key === "ArrowUp") {
        event.preventDefault();
        setPaletteActive(state.palette.active - 1);
      } else if (event.key === "Enter" && state.palette.filtered.length) {
        event.preventDefault();
        executePaletteIndex(state.palette.active);
      }
      return;
    }

    if (event.key === "Escape") {
      if (state.modelMenuOpen) {
        closeModelMenu();
        els.modelTrigger.focus();
        return;
      }
      if (els.appShell.classList.contains("sidebar-open")) {
        closeMobileSidebar();
        return;
      }
      if (document.activeElement === els.historySearch && els.historySearch.value) {
        els.historySearch.value = "";
        filterHistory();
        return;
      }
    }

    const isMac = /Mac|iPhone|iPad/.test(navigator.platform);
    const commandKey = isMac ? event.metaKey : event.ctrlKey;

    if (commandKey && event.key.toLowerCase() === "k") {
      event.preventDefault();
      if (state.modalType === "command") closeCommandPalette();
      else openCommandPalette();
      return;
    }

    if (commandKey && event.key.toLowerCase() === "n") {
      event.preventDefault();
      resetCurrentSession();
      return;
    }

    if (commandKey && ["1", "2", "3"].includes(event.key)) {
      event.preventDefault();
      setView({ 1: "chat", 2: "plugins", 3: "settings" }[event.key]);
      return;
    }

    const activeTag = document.activeElement?.tagName;
    const isTyping =
      activeTag === "INPUT" || activeTag === "TEXTAREA" || activeTag === "SELECT";

    if (event.key === "/" && !isTyping && state.view === "chat") {
      event.preventDefault();
      els.historySearch.focus();
    }
  }

  function bindEvents() {
    // Navigation and chrome
    els.brandButton.addEventListener("click", () => setView("chat"));
    els.collapseSidebar.addEventListener("click", () => setCollapsed(!state.collapsed));
    els.newChatButton.addEventListener("click", () => resetCurrentSession());
    els.clearHistoryButton.addEventListener("click", () => resetCurrentSession());
    els.mobileMenuButton.addEventListener("click", () => {
      if (els.appShell.classList.contains("sidebar-open")) closeMobileSidebar();
      else openMobileSidebar();
    });
    els.mobileBackdrop.addEventListener("click", closeMobileSidebar);
    els.profileButton.addEventListener("click", () => setView("settings"));
    els.avatarButton.addEventListener("click", () => setView("settings"));
    els.localBadge.addEventListener("click", () => {
      showToast("这是一个纯前端交互模拟，不会调用任何真实模型 API。", "info");
    });

    $$(".nav-item").forEach((button) => {
      button.addEventListener("click", () => setView(button.dataset.view));
    });

    // Theme and model
    els.themeToggle.addEventListener("click", () => {
      setTheme(state.theme === "dark" ? "light" : "dark", { notify: true });
    });
    els.modelTrigger.addEventListener("click", () => toggleModelMenu());
    els.modelTrigger.addEventListener("keydown", (event) => {
      if (event.key === "ArrowDown") {
        event.preventDefault();
        toggleModelMenu(true);
        $('.model-option[aria-selected="true"]', els.modelMenu)?.focus();
      }
    });
    els.modelMenu.addEventListener("click", (event) => {
      const option = event.target.closest("[data-model-id]");
      if (!option) return;
      selectModel(option.dataset.modelId);
      closeModelMenu();
      els.modelTrigger.focus();
    });

    document.addEventListener("pointerdown", (event) => {
      if (!state.modelMenuOpen) return;
      if (!event.target.closest("#modelPicker")) closeModelMenu();
    });

    // History
    els.historySearch.addEventListener("input", filterHistory);
    els.historyScroll.addEventListener("click", (event) => {
      const item = event.target.closest("[data-session]");
      if (!item) return;
      switchSession(item.dataset.session, { notify: item.dataset.session !== "current" });
    });

    // Suggestions
    $$(".suggestion-card").forEach((button) => {
      button.addEventListener("click", () => {
        setPromptValue(button.dataset.prompt || "");
        showToast("示例任务已填入，发送后开始委托。", "info");
      });
    });

    // Composer
    els.composerForm.addEventListener("submit", handleComposerSubmit);
    els.promptInput.addEventListener("input", () => {
      autoResizeComposer();
      updateComposerState();
    });
    els.promptInput.addEventListener("keydown", (event) => {
      if (event.key === "Enter" && !event.shiftKey && !event.isComposing) {
        if (state.busy) {
          event.preventDefault();
          return;
        }
        event.preventDefault();
        els.composerForm.requestSubmit();
      }
    });
    els.attachButton.addEventListener("click", () => els.fileInput.click());
    els.fileInput.addEventListener("change", () => {
      const files = [...(els.fileInput.files || [])];
      if (!files.length) return;
      const available = Math.max(0, 3 - state.attachments.length);
      const selected = files.slice(0, available).map((file) => file.name);
      state.attachments.push(...selected);
      renderAttachments();
      if (files.length > available) {
        showToast("演示最多附加 3 个文件。", "warning");
      } else {
        showToast(`已附加 ${selected.length} 个文件（仅用于界面演示）。`, "info");
      }
      els.fileInput.value = "";
    });
    els.attachmentStrip.addEventListener("click", (event) => {
      const button = event.target.closest("[data-remove-attachment]");
      if (!button) return;
      state.attachments.splice(Number(button.dataset.removeAttachment), 1);
      renderAttachments();
    });

    els.deepThinkButton.addEventListener("click", () => {
      const active = els.deepThinkButton.getAttribute("aria-pressed") !== "true";
      els.deepThinkButton.setAttribute("aria-pressed", String(active));
      els.deepThinkButton.classList.toggle("is-active", active);
    });
    els.webSearchButton.addEventListener("click", () => {
      const active = els.webSearchButton.getAttribute("aria-pressed") !== "true";
      els.webSearchButton.setAttribute("aria-pressed", String(active));
      els.webSearchButton.classList.toggle("is-active", active);
      if (active) {
        showToast("联网搜索是演示开关，不会发出真实网络请求。", "info");
      }
    });

    // Messages (delegated so restored HTML keeps working)
    els.messages.addEventListener("click", async (event) => {
      const button = event.target.closest('[data-action="copy"]');
      if (!button) return;
      const message = button.closest(".message");
      const result = message?.querySelector(".result-text");
      if (!result) return;
      const ok = await copyText(result.textContent);
      showToast(ok ? "已复制到剪贴板。" : "复制失败，请手动选择文本。", ok ? "success" : "warning");
    });

    // Plugins
    els.pluginDocsButton.addEventListener("click", () => {
      showToast("插件开发指南是模拟入口，完整项目说明见 GitHub README。", "info");
    });
    els.manifestButton.addEventListener("click", openManifestModal);
    els.testDelegationButton.addEventListener("click", () => {
      setView("chat");
      setPromptValue(
        "请演示一次子智能体委托：把「为独立开发者设计一个构建状态追踪器」拆成三个可执行任务，并给出优先级。"
      );
      showToast("示例任务已填入，点击发送即可开始。", "info");
    });

    document.addEventListener("click", (event) => {
      const lockedSwitch = event.target.closest(".switch.is-locked");
      if (!lockedSwitch) return;
      event.preventDefault();
      showToast("「子智能体委托」由 Harness 内核托管，配置不可更改。", "warning");
    });

    // Settings
    $$(".theme-choice").forEach((button) => {
      button.addEventListener("click", () => setTheme(button.dataset.themeChoice));
    });
    els.reduceMotionSwitch.addEventListener("click", () => {
      setReduceMotion(!state.reduceMotion, { notify: true });
    });
    els.defaultModelSelect.addEventListener("change", () => {
      selectModel(els.defaultModelSelect.value);
    });
    els.clearCurrentButton.addEventListener("click", () => {
      resetCurrentSession({ goChat: false, notify: true });
    });
    els.resetSettingsButton.addEventListener("click", resetPreferences);

    // Command palette
    els.commandButton.addEventListener("click", openCommandPalette);

    // Overlay clicks that are allowed to close
    document.addEventListener("keydown", handleGlobalKeydown);

    // Persisted settings
  }

  /* ---------------------------------------------------------
     Boot
     --------------------------------------------------------- */

  function init() {
    const savedTheme = readStorage(LS.theme, "dark");
    const savedModel = readStorage(LS.model, "deepseek-v3.2");
    const savedMotion = readStorage(LS.reduceMotion, null);
    const savedCollapsed = readStorage(LS.collapsed, "0");

    renderModelMenu();
    populateModelSelect();

    state.snapshots.current = {
      title: "新会话",
      html: "",
      heroHidden: false,
    };

    setTheme(savedTheme === "light" ? "light" : "dark", { persist: false });
    setReduceMotion(
      savedMotion === null ? window.matchMedia("(prefers-reduced-motion: reduce)").matches : savedMotion === "1",
      { persist: false }
    );
    selectModel(MODELS[savedModel] ? savedModel : "deepseek-v3.2", {
      notify: false,
      persist: false,
    });
    setCollapsed(savedCollapsed === "1", { persist: false });

    setHistoryActive("current");
    updatePageTitle();
    updateSettingsMeta();
    updateComposerState();
    setComposerStatus(DEFAULT_COMPOSER_STATUS);
    renderAttachments();
    bindEvents();

    els.historySearch.value = "";
    filterHistory();
  }

  init();
})();
