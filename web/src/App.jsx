const CHAT_URL = import.meta.env.VITE_NEXEL_CHAT_URL || "https://github.com/NexelAi-Inc/Nexel-Chat";

const features = [
  {
    title: "Nexel Chat",
    text: "A separate GPT-style workspace for writing, coding, reasoning, and long-running conversations.",
  },
  {
    title: "Private accounts",
    text: "Firebase-backed sign in keeps the product ready for user profiles, personalization, and saved sessions.",
  },
  {
    title: "Deployable stack",
    text: "The website can live on Netlify while the chat workspace and API live in their own repository.",
  },
];

const roadmap = ["Company website", "Nexel Chat workspace", "User memory", "Smart routing"];

export default function App() {
  return (
    <main className="company-page">
      <nav className="site-nav">
        <a className="brand" href="#top" aria-label="Nexel Ai home">
          <span className="brand-mark">N</span>
          <span>Nexel Ai</span>
        </a>
        <div className="nav-links">
          <a href="#platform">Platform</a>
          <a href="#roadmap">Roadmap</a>
          <a href={CHAT_URL}>Nexel Chat</a>
        </div>
      </nav>

      <section id="top" className="hero-section">
        <div className="hero-copy">
          <p className="eyebrow">Nexel Ai Company</p>
          <h1>The home for Nexel Ai products.</h1>
          <p className="hero-text">
            Nexel Ai is the company website. Nexel Chat is the separate assistant workspace
            where users sign in, talk with the AI, and keep their conversations moving.
          </p>
          <div className="hero-actions">
            <a className="primary-link" href={CHAT_URL}>
              Open Nexel Chat
            </a>
            <a className="secondary-link" href="#platform">
              Learn more
            </a>
          </div>
        </div>

        <div className="hero-card" aria-label="Nexel product split">
          <div className="card-header">
            <span />
            <span />
            <span />
          </div>
          <div className="split-card">
            <div>
              <p className="label">Website</p>
              <h2>Nexel Ai</h2>
              <p>Brand, product story, company updates, and public pages.</p>
            </div>
            <div>
              <p className="label">Workspace</p>
              <h2>Nexel Chat</h2>
              <p>Protected GPT-style assistant, memory, and backend API.</p>
            </div>
          </div>
        </div>
      </section>

      <section id="platform" className="feature-section">
        <div className="section-heading">
          <p className="eyebrow">Platform</p>
          <h2>One company site. One focused chat product.</h2>
        </div>
        <div className="feature-grid">
          {features.map((feature) => (
            <article className="feature-card" key={feature.title}>
              <h3>{feature.title}</h3>
              <p>{feature.text}</p>
            </article>
          ))}
        </div>
      </section>

      <section id="roadmap" className="roadmap-section">
        <div>
          <p className="eyebrow">Roadmap</p>
          <h2>Built to grow from a clean foundation.</h2>
        </div>
        <div className="roadmap-list">
          {roadmap.map((item, index) => (
            <div className="roadmap-item" key={item}>
              <span>{String(index + 1).padStart(2, "0")}</span>
              <p>{item}</p>
            </div>
          ))}
        </div>
      </section>
    </main>
  );
}
