const CHAT_URL = import.meta.env.VITE_NEXEL_CHAT_URL || "https://nexelchat.netlify.app/";

const navItems = ["Research", "Products", "Business", "Developers", "Company", "Foundation"];

const sideStories = [
  {
    eyebrow: "Product",
    title: "Nexel Chat for almost everything",
    read: "4 min read",
    variant: "blue",
  },
  {
    eyebrow: "Research",
    title: "Memory, routing, and safer assistant workflows",
    read: "7 min read",
    variant: "green",
  },
];

const updates = [
  "Nexel Chat workspace moves into its own product repo.",
  "Nexel Ai company website is ready for Netlify hosting.",
  "Firebase accounts and profile sync are connected to the chat workspace.",
];

export default function App() {
  return (
    <main className="company-page">
      <header className="site-header">
        <a className="wordmark" href="#top" aria-label="Nexel Ai home">
          Nexel Ai
        </a>

        <nav className="site-nav" aria-label="Main navigation">
          {navItems.map((item) => (
            <a key={item} href={`#${item.toLowerCase()}`}>
              {item}
            </a>
          ))}
          <button className="search-button" type="button" aria-label="Search">
            Search
          </button>
        </nav>

        <div className="header-actions">
          <a className="login-link" href={CHAT_URL}>
            Log in
          </a>
          <a className="try-chat-link" href={CHAT_URL}>
            Try Nexel Chat
          </a>
        </div>
      </header>

      <section id="top" className="news-layout">
        <article className="featured-story">
          <div className="feature-art">
            <div className="glow glow-one" />
            <div className="glow glow-two" />
            <div className="feature-label">Nexel Chat</div>
          </div>
          <h1>Introducing Nexel Chat</h1>
          <p className="story-meta">
            <span>Product</span>
            <span>10 min read</span>
          </p>
        </article>

        <aside className="story-column">
          {sideStories.map((story) => (
            <article className="side-story" key={story.title}>
              <div className={`side-art ${story.variant}`}>
                <span>{story.title}</span>
              </div>
              <h2>{story.title}</h2>
              <p className="story-meta">
                <span>{story.eyebrow}</span>
                <span>{story.read}</span>
              </p>
            </article>
          ))}
        </aside>
      </section>

      <section id="products" className="updates-section">
        <div>
          <p className="section-kicker">Latest</p>
          <h2>Building Nexel as two connected products.</h2>
        </div>
        <div className="updates-list">
          {updates.map((update) => (
            <article className="update-item" key={update}>
              <p>{update}</p>
            </article>
          ))}
        </div>
      </section>

      <section id="developers" className="developer-band">
        <p>Nexel Ai hosts the company story. Nexel Chat hosts the signed-in GPT workspace.</p>
        <a href={CHAT_URL}>Open Nexel Chat</a>
      </section>
    </main>
  );
}
