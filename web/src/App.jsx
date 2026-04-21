import { useEffect, useMemo, useRef, useState } from "react";
import {
  createUserWithEmailAndPassword,
  onAuthStateChanged,
  signInWithEmailAndPassword,
  signOut,
  updateProfile,
} from "firebase/auth";

import { auth, saveUserProfile } from "./firebase";

const STORAGE_KEY_PREFIX = "nexa-web-conversation";
const MODE_KEY = "nexa-web-mode";
const API_BASE_URL = (import.meta.env.VITE_API_BASE_URL || "").replace(/\/+$/, "");

function apiUrl(path) {
  return `${API_BASE_URL}${path}`;
}

const PROJECTS = [
  { name: "Story Lab", icon: "{}" },
  { name: "Launch Notes", icon: "[]" },
  { name: "Design Review", icon: "<>" },
];

const QUICK_LINKS = [
  { label: "Search chats", icon: "S" },
  { label: "Create", icon: "+" },
  { label: "Explore", icon: "..." },
];

const FEATURE_CARDS = [
  {
    eyebrow: "Write",
    title: "Stories, scripts, and polished drafts",
    text: "Move from quick ideas to longer creative sessions without leaving the Nexel ecosystem.",
  },
  {
    eyebrow: "Build",
    title: "Modern product and coding support",
    text: "Use Nexel Chat for debugging, UI thinking, implementation help, and sharper product decisions.",
  },
  {
    eyebrow: "Remember",
    title: "Saved sessions that survive restarts",
    text: "Your recent conversations stay available so useful ideas and unfinished work remain easy to revisit.",
  },
];

const WORKFLOW = [
  "Start on the Nexel Ai website to understand the product and create your account.",
  "Open Nexel Chat when you are ready for the protected assistant workspace.",
  "Pick up from your saved recent conversations whenever you return.",
];

const createConversationId = () =>
  `web-${Date.now()}-${Math.random().toString(36).slice(2, 8)}`;

function splitSegments(text) {
  return text
    .split(/```/)
    .map((chunk, index) => {
      if (index % 2 === 1) {
        const [language, ...rest] = chunk.split("\n");
        return {
          type: "code",
          language: language.trim() || "text",
          content: rest.join("\n").trimEnd(),
        };
      }
      return { type: "text", content: chunk.trim() };
    })
    .filter((segment) => segment.content);
}

function getConversationLabel(item) {
  if (!item) return "Untitled chat";
  if (item.preview) return item.preview;
  if (item.id === "api-default") return "General chat";
  return "Untitled chat";
}

function formatAuthError(error) {
  const code = error?.code || "";
  const known = {
    "auth/email-already-in-use": "That email is already in use.",
    "auth/invalid-email": "Enter a valid email address.",
    "auth/invalid-credential": "The email or password is incorrect.",
    "auth/missing-password": "Enter your password.",
    "auth/too-many-requests": "Too many attempts. Please wait a moment and try again.",
    "auth/user-disabled": "This account has been disabled.",
    "auth/weak-password": "Use a stronger password with at least 6 characters.",
  };

  return known[code] || error?.message || "Something went wrong. Please try again.";
}

function Message({ role, content }) {
  const segments = useMemo(() => splitSegments(content), [content]);

  const handleCopy = async () => {
    await navigator.clipboard.writeText(content);
  };

  return (
    <div className={`message-row ${role}`}>
      <div className="message-avatar">{role === "user" ? "Y" : "N"}</div>
      <article className="message-card">
        <div className="message-header">
          <h3 className="message-author">{role === "user" ? "You" : "Nexel Chat"}</h3>
          <button className="copy-btn" onClick={handleCopy} title="Copy message">
            Copy
          </button>
        </div>
        <div className="message-body">
          {segments.map((segment, index) =>
            segment.type === "code" ? (
              <pre key={index}>
                <code className={`language-${segment.language}`}>{segment.content}</code>
              </pre>
            ) : (
              segment.content.split(/\n{2,}/).map((paragraph, paragraphIndex) => (
                <p key={`${index}-${paragraphIndex}`}>
                  {paragraph.split("\n").map((line, lineIndex, lines) => (
                    <span key={lineIndex}>
                      {line}
                      {lineIndex < lines.length - 1 ? <br /> : null}
                    </span>
                  ))}
                </p>
              ))
            )
          )}
        </div>
      </article>
    </div>
  );
}

function AuthModal({
  mode,
  form,
  pending,
  error,
  onChange,
  onClose,
  onModeChange,
  onSubmit,
}) {
  const isSignup = mode === "signup";

  return (
    <div className="auth-overlay" role="dialog" aria-modal="true">
      <div className="auth-modal">
        <button className="auth-close" onClick={onClose} type="button" aria-label="Close auth">
          x
        </button>
        <div className="auth-badge">Nexel Account</div>
        <h2>{isSignup ? "Create your account" : "Welcome back"}</h2>
        <p>
          {isSignup
            ? "Create an account to unlock Nexel Chat."
            : "Sign in to open Nexel Chat and continue your saved chats."}
        </p>

        <form className="auth-form" onSubmit={onSubmit}>
          {isSignup ? (
            <label className="auth-field">
              <span>Name</span>
              <input
                name="name"
                type="text"
                placeholder="Damion"
                value={form.name}
                onChange={onChange}
                autoComplete="name"
              />
            </label>
          ) : null}

          <label className="auth-field">
            <span>Email</span>
            <input
              name="email"
              type="email"
              placeholder="you@example.com"
              value={form.email}
              onChange={onChange}
              autoComplete="email"
            />
          </label>

          <label className="auth-field">
            <span>Password</span>
            <input
              name="password"
              type="password"
              placeholder="At least 6 characters"
              value={form.password}
              onChange={onChange}
              autoComplete={isSignup ? "new-password" : "current-password"}
            />
          </label>

          {isSignup ? (
            <label className="auth-field">
              <span>Confirm password</span>
              <input
                name="confirmPassword"
                type="password"
                placeholder="Repeat password"
                value={form.confirmPassword}
                onChange={onChange}
                autoComplete="new-password"
              />
            </label>
          ) : null}

          {error ? <div className="auth-error">{error}</div> : null}

          <button className="auth-submit" type="submit" disabled={pending}>
            {pending ? "Please wait..." : isSignup ? "Create account" : "Sign in"}
          </button>
        </form>

        <div className="auth-switch">
          <span>{isSignup ? "Already have an account?" : "Need an account?"}</span>
          <button
            className="auth-switch-btn"
            type="button"
            onClick={() => onModeChange(isSignup ? "signin" : "signup")}
          >
            {isSignup ? "Sign in" : "Create one"}
          </button>
        </div>
      </div>
    </div>
  );
}

export default function App() {
  const [view, setView] = useState("home");
  const [currentConversationId, setCurrentConversationId] = useState(createConversationId());
  const [currentMode, setCurrentMode] = useState(localStorage.getItem(MODE_KEY) || "auto");
  const [conversations, setConversations] = useState([]);
  const [messages, setMessages] = useState([]);
  const [prompt, setPrompt] = useState("");
  const [status, setStatus] = useState("Ready");
  const [isSending, setIsSending] = useState(false);
  const [authReady, setAuthReady] = useState(false);
  const [authUser, setAuthUser] = useState(null);
  const [showAuthModal, setShowAuthModal] = useState(false);
  const [showProfileMenu, setShowProfileMenu] = useState(false);
  const [authMode, setAuthMode] = useState("signin");
  const [authPending, setAuthPending] = useState(false);
  const [authError, setAuthError] = useState("");
  const [authForm, setAuthForm] = useState({
    name: "",
    email: "",
    password: "",
    confirmPassword: "",
  });

  const messagePaneRef = useRef(null);
  const promptRef = useRef(null);
  const profileMenuRef = useRef(null);
  const storageUserKey = authUser?.uid || "guest";
  const conversationStorageKey = `${STORAGE_KEY_PREFIX}-${storageUserKey}`;
  const signedInUserName =
    authUser?.displayName?.trim() ||
    authUser?.email?.split("@")[0]?.trim() ||
    null;

  useEffect(() => {
    if (!authReady) {
      return;
    }
    const savedConversationId = localStorage.getItem(conversationStorageKey);
    setCurrentConversationId(savedConversationId || createConversationId());
    setMessages([]);
    setConversations([]);
  }, [authReady, conversationStorageKey]);

  useEffect(() => {
    if (!authReady || !currentConversationId) {
      return;
    }
    localStorage.setItem(conversationStorageKey, currentConversationId);
  }, [authReady, conversationStorageKey, currentConversationId]);

  useEffect(() => {
    localStorage.setItem(MODE_KEY, currentMode);
  }, [currentMode]);

  useEffect(() => {
    if (!authReady) {
      return;
    }

    if (!authUser?.uid) {
      setConversations([]);
      setMessages([]);
      return;
    }

    const syncWorkspace = async () => {
      await refreshConversations(authUser.uid);
      if (currentConversationId) {
        await loadConversation(currentConversationId, authUser.uid);
      }
    };

    void syncWorkspace();
  }, [authReady, authUser?.uid, currentConversationId]);

  useEffect(() => {
    if (messagePaneRef.current) {
      messagePaneRef.current.scrollTop = messagePaneRef.current.scrollHeight;
    }
  }, [messages]);

  useEffect(() => {
    const unsubscribe = onAuthStateChanged(auth, (user) => {
      setAuthUser(user);
      setAuthReady(true);
      if (user) {
        setShowAuthModal(false);
        void saveUserProfile(user).catch(() => {});
      } else if (view === "chat") {
        setView("home");
      }
    });

    return () => unsubscribe();
  }, [view]);

  useEffect(() => {
    const boot = async () => {
      try {
        const settingsResponse = await fetch(apiUrl("/settings"));
        if (settingsResponse.ok && !localStorage.getItem(MODE_KEY)) {
          const settings = await settingsResponse.json();
          if (settings.default_mode) {
            setCurrentMode(settings.default_mode);
          }
        }
      } catch {}

      if (auth.currentUser?.uid) {
        await Promise.all([loadConversation(currentConversationId, auth.currentUser.uid), refreshConversations(auth.currentUser.uid)]);
      }
    };

    boot();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  useEffect(() => {
    if (view === "chat") {
      promptRef.current?.focus();
    }
  }, [view]);

  useEffect(() => {
    if (!showProfileMenu) {
      return undefined;
    }

    const handlePointerDown = (event) => {
      if (profileMenuRef.current && !profileMenuRef.current.contains(event.target)) {
        setShowProfileMenu(false);
      }
    };

    const handleEscape = (event) => {
      if (event.key === "Escape") {
        setShowProfileMenu(false);
      }
    };

    document.addEventListener("mousedown", handlePointerDown);
    document.addEventListener("keydown", handleEscape);

    return () => {
      document.removeEventListener("mousedown", handlePointerDown);
      document.removeEventListener("keydown", handleEscape);
    };
  }, [showProfileMenu]);

  const refreshConversations = async (userId = authUser?.uid) => {
    if (!userId) {
      setConversations([]);
      return;
    }
    const params = new URLSearchParams({ user_id: userId });
    const response = await fetch(apiUrl(`/conversations?${params.toString()}`));
    if (!response.ok) return;
    const data = await response.json();
    setConversations(data.conversations || []);
  };

  const loadConversation = async (conversationId, userId = authUser?.uid) => {
    if (!userId) {
      setMessages([]);
      return;
    }
    const params = new URLSearchParams({ user_id: userId });
    const response = await fetch(apiUrl(`/conversations/${encodeURIComponent(conversationId)}?${params.toString()}`));
    if (!response.ok) {
      setMessages([]);
      return;
    }
    const data = await response.json();
    setMessages(
      (data.turns || []).map((turn) => ({
        role: turn.role === "user" ? "user" : "agent",
        content: turn.content,
      }))
    );
  };

  const openAuth = (mode = "signin") => {
    setAuthMode(mode);
    setAuthError("");
    setShowAuthModal(true);
  };

  const closeAuth = () => {
    setShowAuthModal(false);
    setAuthError("");
  };

  const openWorkspace = () => {
    if (!authUser) {
      openAuth("signin");
      return;
    }
    setView("chat");
  };

  const startNewConversation = async () => {
    if (!authUser) {
      openAuth("signup");
      return;
    }

    const nextId = createConversationId();
    setCurrentConversationId(nextId);
    setMessages([]);
    setStatus("Ready");
    setView("chat");
    await refreshConversations(authUser?.uid);
    setTimeout(() => promptRef.current?.focus(), 0);
  };

  const clearConversation = async () => {
    const params = new URLSearchParams({ user_id: authUser?.uid || "" });
    await fetch(apiUrl(`/conversations/${encodeURIComponent(currentConversationId)}?${params.toString()}`), { method: "DELETE" });
    await startNewConversation();
  };

  const handleSelectConversation = async (conversationId) => {
    if (!authUser) {
      openAuth("signin");
      return;
    }
    setCurrentConversationId(conversationId);
    setView("chat");
    await loadConversation(conversationId, authUser?.uid);
    await refreshConversations(authUser?.uid);
  };

  const handleSend = async () => {
    const text = prompt.trim();
    if (!text || isSending) return;

    setMessages((prev) => [...prev, { role: "user", content: text }]);
    setPrompt("");
    setIsSending(true);
    setStatus(`Thinking in ${currentMode} mode...`);

    try {
      const response = await fetch(apiUrl("/generate"), {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          prompt: text,
          mode: currentMode,
          conversation_id: currentConversationId,
          user_id: authUser?.uid || null,
          user_name: signedInUserName,
        }),
      });

      if (!response.ok) {
        const error = await response.json().catch(() => ({ detail: "Request failed." }));
        throw new Error(error.detail || "Request failed.");
      }

      const data = await response.json();
      setMessages((prev) => [...prev, { role: "agent", content: data.response }]);
      setStatus("Ready");
      await refreshConversations(authUser?.uid);
    } catch (error) {
      setMessages((prev) => [
        ...prev,
        { role: "agent", content: `Something went wrong: ${error.message || "Unknown error"}` },
      ]);
      setStatus("Error");
    } finally {
      setIsSending(false);
      promptRef.current?.focus();
    }
  };

  const handlePromptKeyDown = (event) => {
    if (event.key === "Enter" && !event.shiftKey) {
      event.preventDefault();
      handleSend();
    }
  };

  const handleAuthFieldChange = (event) => {
    const { name, value } = event.target;
    setAuthForm((prev) => ({ ...prev, [name]: value }));
  };

  const handleAuthSubmit = async (event) => {
    event.preventDefault();
    setAuthError("");

    const email = authForm.email.trim();
    const password = authForm.password;
    const name = authForm.name.trim();

    if (!email) {
      setAuthError("Enter your email address.");
      return;
    }

    if (!password) {
      setAuthError("Enter your password.");
      return;
    }

    if (authMode === "signup") {
      if (!name) {
        setAuthError("Enter your name.");
        return;
      }
      if (password.length < 6) {
        setAuthError("Use a password with at least 6 characters.");
        return;
      }
      if (password !== authForm.confirmPassword) {
        setAuthError("Passwords do not match.");
        return;
      }
    }

    setAuthPending(true);

    try {
      if (authMode === "signup") {
        const credential = await createUserWithEmailAndPassword(auth, email, password);
        if (name) {
          await updateProfile(credential.user, { displayName: name });
        }
        await saveUserProfile({
          ...credential.user,
          displayName: name || credential.user.displayName || "",
        }, { isNewUser: true });
      } else {
        const credential = await signInWithEmailAndPassword(auth, email, password);
        await saveUserProfile(credential.user);
      }

      setAuthForm({
        name: "",
        email: "",
        password: "",
        confirmPassword: "",
      });
      setView("chat");
    } catch (error) {
      setAuthError(formatAuthError(error));
    } finally {
      setAuthPending(false);
    }
  };

  const handleSignOut = async () => {
    setShowProfileMenu(false);
    await signOut(auth);
    setView("home");
  };

  const handleProfileAction = (label) => {
    setShowProfileMenu(false);
    if (label === "Log out") {
      void handleSignOut();
      return;
    }
    setStatus(`${label} is not wired up yet.`);
  };

  const currentTitle = useMemo(() => {
    const current = conversations.find((item) => item.id === currentConversationId);
    return getConversationLabel(current);
  }, [conversations, currentConversationId]);

  const recentConversations = useMemo(() => conversations.slice(0, 6), [conversations]);
  const emptyState = messages.length === 0;

  if (!authReady) {
    return <div className="boot-screen">Loading Nexel Ai...</div>;
  }

  if (view === "home") {
    return (
      <>
        <div className="landing-shell">
          <header className="landing-header">
            <div className="landing-brand">
              <div className="brand-badge">N</div>
              <div>
                <div className="brand-name">Nexel Ai</div>
                <div className="brand-tagline">
                  The public website for your AI assistant, account, and product updates.
                </div>
              </div>
            </div>

            <div className="landing-header-actions">
              <div className="mode-pill">Mode: {currentMode}</div>
              {authUser ? (
                <>
                  <button className="landing-secondary" onClick={openWorkspace}>
                    Open Nexel Chat
                  </button>
                  <button className="landing-secondary" onClick={handleSignOut}>
                    Sign out
                  </button>
                </>
              ) : (
                <>
                  <button className="landing-secondary" onClick={() => openAuth("signin")}>
                    Log in
                  </button>
                  <button className="landing-primary" onClick={() => openAuth("signup")}>
                    Sign up
                  </button>
                </>
              )}
            </div>
          </header>

          <main className="landing-main">
            <section className="hero-panel">
              <div className="hero-copy">
                <h1>Nexel Ai is the front door. Nexel Chat is the workspace.</h1>
                <p>
                  Host the public website on Netlify, keep the assistant behind an account, and
                  connect Nexel Chat to your AI backend when you are ready.
                </p>

                <div className="hero-actions">
                  <button className="landing-primary" onClick={startNewConversation}>
                    {authUser ? "Start Nexel Chat" : "Create your account"}
                  </button>
                  <button className="landing-secondary" onClick={openWorkspace}>
                    {authUser ? "Enter Nexel Chat" : "Sign in to continue"}
                  </button>
                </div>

                <div className="hero-stats">
                  <div className="stat-card">
                    <span className="stat-number">{recentConversations.length}</span>
                    <span className="stat-label">saved chats</span>
                  </div>
                  <div className="stat-card">
                    <span className="stat-number">3</span>
                    <span className="stat-label">routing modes</span>
                  </div>
                  <div className="stat-card">
                    <span className="stat-number">{authUser ? "On" : "Auth"}</span>
                    <span className="stat-label">protected chat</span>
                  </div>
                </div>
              </div>

              <div className="hero-preview">
                <div className="preview-window">
                  <div className="preview-topbar">
                    <span className="preview-dot" />
                    <span className="preview-dot" />
                    <span className="preview-dot" />
                  </div>
                  <div className="preview-content">
                    <div className="preview-pill">Nexel Chat</div>
                    <h3>A separate workspace for actual assistant sessions.</h3>
                    <p>
                      Use one account for your writing sessions, coding help, and ongoing
                      conversations without losing recent context.
                    </p>
                    <div className="preview-input">
                      <span>{authUser ? authUser.email : "Email and password access"}</span>
                      <button type="button" onClick={openWorkspace}>
                        Open
                      </button>
                    </div>
                  </div>
                </div>
              </div>
            </section>

            <section className="feature-grid">
              {FEATURE_CARDS.map((card) => (
                <article key={card.title} className="feature-card">
                  <div className="feature-eyebrow">{card.eyebrow}</div>
                  <h2>{card.title}</h2>
                  <p>{card.text}</p>
                </article>
              ))}
            </section>

            <section className="workflow-panel">
              <div>
                <div className="hero-eyebrow">How it flows</div>
                <h2>Built like a product, not just a chat box.</h2>
              </div>
              <div className="workflow-list">
                {WORKFLOW.map((step, index) => (
                  <div key={step} className="workflow-item">
                    <div className="workflow-number">0{index + 1}</div>
                    <p>{step}</p>
                  </div>
                ))}
              </div>
            </section>

            <section className="recent-strip">
              <div className="recent-strip-header">
                <h2>Recent conversations</h2>
                <button className="landing-secondary" onClick={openWorkspace}>
                  View all in Nexel Chat
                </button>
              </div>
              <div className="recent-grid">
                {recentConversations.length ? (
                  recentConversations.map((item) => (
                    <button
                      key={item.id}
                      className="recent-card"
                      onClick={() => handleSelectConversation(item.id)}
                    >
                      <div className="recent-card-title">{getConversationLabel(item)}</div>
                      <div className="recent-card-meta">Continue this conversation</div>
                    </button>
                  ))
                ) : (
                  <div className="recent-empty">
                    No saved chats yet. Create an account and start your first conversation.
                  </div>
                )}
              </div>
            </section>
          </main>
        </div>

        {showAuthModal ? (
          <AuthModal
            mode={authMode}
            form={authForm}
            pending={authPending}
            error={authError}
            onChange={handleAuthFieldChange}
            onClose={closeAuth}
            onModeChange={setAuthMode}
            onSubmit={handleAuthSubmit}
          />
        ) : null}
      </>
    );
  }

  return (
    <div className="app-shell">
      <aside className="sidebar">
        <div className="sidebar-header">
          <div className="logo-button" title="Nexel Chat">
            N
          </div>
          <div className="sidebar-account-pill">{authUser?.displayName || authUser?.email || "Account"}</div>
        </div>

        <button className="primary-action" onClick={startNewConversation}>
          <span className="action-icon">+</span>
          <span>New chat</span>
        </button>

        <div className="quick-links">
          {QUICK_LINKS.map((item) => (
            <button key={item.label} className="quick-link" type="button">
              <span className="quick-link-icon">{item.icon}</span>
              <span>{item.label}</span>
            </button>
          ))}
        </div>

        <section className="sidebar-group">
          <div className="sidebar-heading">Projects</div>
          <div className="project-list">
            {PROJECTS.map((project) => (
              <button key={project.name} className="project-item" type="button">
                <span className="project-icon">{project.icon}</span>
                <span>{project.name}</span>
              </button>
            ))}
          </div>
        </section>

        <section className="sidebar-group sidebar-recents">
          <div className="sidebar-heading">Recents</div>
          <div className="conversation-list">
            {conversations.length ? (
              conversations.slice(0, 12).map((item) => (
                <button
                  key={item.id}
                  className={`conversation-item ${item.id === currentConversationId ? "active" : ""}`}
                  onClick={() => handleSelectConversation(item.id)}
                >
                  <span className="conversation-title">{getConversationLabel(item)}</span>
                </button>
              ))
            ) : (
              <div className="empty-sidebar">No saved chats yet.</div>
            )}
          </div>
        </section>

        <div className="sidebar-user">
          <div className="profile-menu-wrap" ref={profileMenuRef}>
            <button
              className="profile-trigger"
              type="button"
              onClick={() => setShowProfileMenu((open) => !open)}
              aria-expanded={showProfileMenu}
              aria-haspopup="menu"
            >
              <div className="user-avatar">
                {(authUser?.displayName || authUser?.email || "N").slice(0, 1).toUpperCase()}
              </div>
              <div className="sidebar-user-copy">
                <div className="user-name">{authUser?.displayName || "Nexel User"}</div>
                <div className="user-plan">{authUser?.email}</div>
              </div>
              <div className="profile-trigger-caret">{showProfileMenu ? "▴" : "▾"}</div>
            </button>

            {showProfileMenu ? (
              <div className="profile-menu" role="menu" aria-label="Profile menu">
                {[
                  "Profile",
                  "Settings",
                  "Personalization",
                  "Upgrade Plan",
                  "Help",
                  "Log out",
                ].map((item) => (
                  <button
                    key={item}
                    type="button"
                    className={`profile-menu-item ${item === "Log out" ? "danger" : ""}`}
                    role="menuitem"
                    onClick={() => handleProfileAction(item)}
                  >
                    {item}
                  </button>
                ))}
              </div>
            ) : null}
          </div>
        </div>
      </aside>

      <main className="main-panel">
        <header className="topbar">
          <div className="topbar-title-wrap">
            <div className="topbar-title">{emptyState ? "Nexel Chat" : currentTitle}</div>
            {!emptyState ? (
              <div className="topbar-subtitle">
                {messages.length} message{messages.length === 1 ? "" : "s"} in this chat
              </div>
            ) : null}
          </div>

          <div className="topbar-controls">
            <div className="mode-toggle">
              {["auto", "fast", "smart"].map((mode) => (
                <button
                  key={mode}
                  className={`mode-btn ${currentMode === mode ? "active" : ""}`}
                  onClick={() => setCurrentMode(mode)}
                >
                  {mode[0].toUpperCase() + mode.slice(1)}
                </button>
              ))}
            </div>
            <button className="ghost-btn" onClick={clearConversation}>
              Clear
            </button>
          </div>
        </header>

        <section className={`content-stage ${emptyState ? "is-empty" : ""}`}>
          {emptyState ? (
            <div className="empty-state">
              <div className="empty-state-inner">
                <h1>How can Nexel Chat help?</h1>
                <p>Ask for writing, coding, brainstorming, design feedback, or just talk.</p>
              </div>
            </div>
          ) : (
            <section className="message-pane" ref={messagePaneRef}>
              {messages.map((message, index) => (
                <Message key={`${message.role}-${index}`} role={message.role} content={message.content} />
              ))}
            </section>
          )}

          <footer className={`composer-shell ${emptyState ? "composer-center" : ""}`}>
            <div className="composer-card">
              <button className="composer-side-icon" type="button" title="Add">
                +
              </button>
              <textarea
                ref={promptRef}
                id="promptInput"
                rows="1"
                placeholder="Ask anything"
                value={prompt}
                onChange={(event) => setPrompt(event.target.value)}
                onKeyDown={handlePromptKeyDown}
              />
              <div className="composer-tools">
                {isSending ? (
                  <div className="loading-indicator">
                    <div className="spinner" />
                  </div>
                ) : null}
                <button className="composer-tool-button" type="button" title="Voice">
                  Mic
                </button>
                <button className="send-btn" onClick={handleSend} disabled={isSending}>
                  Send
                </button>
              </div>
            </div>
            <div className="composer-meta">
              <span>{status}</span>
              {!emptyState && recentConversations.length ? (
                <span>{recentConversations.length} more recent chats in the sidebar</span>
              ) : (
                <span>Signed in as {authUser?.email}</span>
              )}
            </div>
          </footer>
        </section>
      </main>
    </div>
  );
}
