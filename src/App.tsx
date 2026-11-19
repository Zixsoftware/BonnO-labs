import { useRef, useState } from 'react'
import type { FormEvent } from 'react'
import {
  AppWindow, Boxes, Braces, ChevronDown, CircleCheck,
  CodeXml, Database, Layers3, Mail, Menu, Orbit, Send, ShieldCheck,
  Smartphone, Sparkles, X,
} from 'lucide-react'
import { HeroVisual } from './HeroVisual'

const links = [
  ['Services', '#services'],
  ['Technologies', '#technologies'],
  ['About', '#about'],
  ['Portfolio', '#portfolio'],
  ['Contact', '#contact'],
] as const

const services = [
  { title: 'Web Development & SaaS', icon: CodeXml, copy: 'Responsive websites, web apps, and SaaS products built to grow with the people who use them.' },
  { title: 'Mobile App Development', icon: Smartphone, copy: 'Cross-platform apps for iOS and Android with clear navigation and a consistent experience.' },
  { title: 'AI & Automation', icon: Sparkles, copy: 'Workflow automation and AI integrations that reduce repetitive work and keep people in control.' },
  { title: 'UI/UX Design', icon: Layers3, copy: 'User flows, interactive prototypes, and accessible interfaces that make complex products easier to use.' },
  { title: 'Maintenance & Support', icon: ShieldCheck, copy: 'Updates, performance improvements, and practical support for the software you rely on.' },
]

const technologies = [
  { title: 'Web & interface', icon: Braces, items: ['React', 'Next.js', 'TypeScript', 'Tailwind CSS'] },
  { title: 'Mobile & automation', icon: Boxes, items: ['React Native', 'Flutter', 'Node.js', 'Python'] },
  { title: 'Data & delivery', icon: Database, items: ['PostgreSQL', 'Supabase', 'Firebase', 'Git', 'Docker'] },
]

const projects = [
  { title: 'SaaS workspace', category: 'Web application concept', art: 'workspace', icon: AppWindow },
  { title: 'Mobile companion', category: 'Cross-platform app concept', art: 'mobile', icon: Smartphone },
  { title: 'Workflow automation', category: 'AI integration concept', art: 'workflow', icon: Orbit },
]

const github = 'https://github.com/Zixsoftware'

function Brand() {
  return (
    <a className="brand" href="#home" aria-label="BonnO Labs home">
      <img src="/favicon.svg" width="36" height="36" alt="" />
      <span>BonnO<span className="brand-accent"> Labs</span></span>
    </a>
  )
}

function Header() {
  const [expanded, setExpanded] = useState(false)
  const menuButton = useRef<HTMLButtonElement>(null)

  return (
    <header className="site-header" onKeyDown={(event) => {
      if (event.key === 'Escape' && expanded) {
        setExpanded(false)
        menuButton.current?.focus()
      }
    }}>
      <div className="wrap header-inner flex items-center justify-between">
        <Brand />
        <nav className="desktop-nav" aria-label="Primary navigation">
          {links.map(([label, href]) => <a href={href} key={href}>{label}</a>)}
        </nav>
        <a className="button button-outline header-cta" href="#contact">Let’s talk</a>
        <button
          ref={menuButton}
          type="button"
          className="menu-button"
          aria-expanded={expanded}
          aria-controls="mobile-navigation"
          aria-label={expanded ? 'Close navigation' : 'Open navigation'}
          onClick={() => setExpanded(!expanded)}
        >
          {expanded ? <X size={23} aria-hidden="true" /> : <Menu size={23} aria-hidden="true" />}
        </button>
      </div>
      <nav id="mobile-navigation" className="mobile-nav" aria-label="Mobile navigation" hidden={!expanded}>
        <div className="wrap">
          {links.map(([label, href]) => (
            <a href={href} key={href} onClick={() => setExpanded(false)}>{label}</a>
          ))}
        </div>
      </nav>
    </header>
  )
}

function SectionHeading({ label, title, id, description }: {
  label: string
  title: string
  id: string
  description?: string
}) {
  return (
    <div className="section-heading">
      <p className="eyebrow">{label}</p>
      <h2 id={id}>{title}</h2>
      {description && <p className="section-description">{description}</p>}
    </div>
  )
}

type Submission = 'idle' | 'sending' | 'success' | 'error'

function ContactForm() {
  const [submission, setSubmission] = useState<Submission>('idle')
  const pending = useRef(false)

  async function submit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault()
    if (pending.current) return

    const form = event.currentTarget
    const data = new FormData(form)
    const name = String(data.get('name') ?? '').trim()
    const message = String(data.get('message') ?? '').trim()
    const nameField = form.elements.namedItem('name') as HTMLInputElement
    const messageField = form.elements.namedItem('message') as HTMLTextAreaElement

    if (!name || message.length < 12) {
      if (!name) nameField.setCustomValidity('Enter your name.')
      if (message.length < 12) messageField.setCustomValidity('Enter at least 12 characters about your project.')
      form.reportValidity()
      return
    }

    const body = new URLSearchParams({
      'form-name': 'contact',
      'bot-field': String(data.get('bot-field') ?? ''),
      name,
      email: String(data.get('email') ?? '').trim(),
      service: String(data.get('service') ?? ''),
      message,
    })
    pending.current = true
    setSubmission('sending')

    try {
      const response = await fetch('/', {
        method: 'POST',
        headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
        body,
      })
      if (!response.ok) throw new Error('Form submission failed')
      form.reset()
      setSubmission('success')
    } catch {
      setSubmission('error')
    } finally {
      pending.current = false
    }
  }

  return (
    <form name="contact" method="POST" action="/" className="contact-form" onSubmit={submit}>
      <input type="hidden" name="form-name" value="contact" />
      <div hidden><label>Leave this blank <input name="bot-field" tabIndex={-1} autoComplete="off" /></label></div>
      <div className="grid gap-5 sm:grid-cols-2">
        <label className="field">
          <span>Name</span>
          <input name="name" placeholder="Your name" autoComplete="name" required maxLength={100}
            onInput={(event) => event.currentTarget.setCustomValidity('')} />
        </label>
        <label className="field">
          <span>Email</span>
          <input name="email" type="email" placeholder="you@example.com" autoComplete="email" required maxLength={254} />
        </label>
      </div>
      <label className="field">
        <span>Service</span>
        <span className="select-wrap">
          <select name="service" defaultValue="" required>
            <option value="" disabled>Select a service</option>
            {services.map(({ title }) => <option key={title}>{title}</option>)}
            <option>Something else</option>
          </select>
          <ChevronDown size={17} aria-hidden="true" />
        </span>
      </label>
      <label className="field">
        <span>Message</span>
        <textarea name="message" placeholder="Tell us a little about what you want to build." rows={5}
          required minLength={12} maxLength={2500} onInput={(event) => event.currentTarget.setCustomValidity('')} />
      </label>
      <button className="button button-primary" type="submit" disabled={submission === 'sending'}>
        <Send size={17} aria-hidden="true" />
        {submission === 'sending' ? 'Sending…' : 'Send message'}
      </button>
      <p className={`form-status form-status-${submission}`} role="status">
        {submission === 'success' && 'Thanks for reaching out. Your message has been sent.'}
        {submission === 'error' && 'Your message couldn’t be sent. Please try again.'}
      </p>
    </form>
  )
}

export function App() {
  return (
    <>
        <a className="skip-link" href="#main">Skip to content</a>
        <div id="home" />
        <Header />
        <main id="main" tabIndex={-1}>
          <div className="scene-rail" aria-hidden="true">
            <div className="scene-sticky"><HeroVisual /></div>
          </div>
          <section className="hero" aria-labelledby="hero-title">
            <div className="wrap hero-inner">
              <div className="hero-copy">
                <p className="eyebrow hero-eyebrow"><span aria-hidden="true" />Software development studio</p>
                <h1 id="hero-title">Building Digital<br className="hero-break" /> Experiences<br className="hero-break" /> <em>That Matter</em></h1>
                <p className="hero-description">BonnO Labs designs and builds scalable web, mobile, and AI products for teams with ambitious ideas.</p>
                <div className="hero-actions flex flex-wrap gap-3">
                  <a className="button button-primary" href="#contact">Start a project</a>
                  <a className="button button-outline" href="#services">Explore services</a>
                </div>
              </div>
              <div className="hero-mobile-art" aria-hidden="true" />
            </div>
          </section>

          <section id="services" className="section" aria-labelledby="services-title">
            <div className="wrap">
              <SectionHeading label="Services" title="What we build" id="services-title"
                description="Software development and design for new products and existing systems." />
              <div className="services-grid">
                {services.map(({ title, icon: Icon, copy }) => (
                  <article className="service-card" key={title}>
                    <div className="icon-tile"><Icon size={22} aria-hidden="true" /></div>
                    <h3>{title}</h3>
                    <p>{copy}</p>
                  </article>
                ))}
              </div>
            </div>
          </section>

          <section id="technologies" className="section section-tinted" aria-labelledby="technologies-title">
            <div className="wrap">
              <SectionHeading label="Technologies" title="Our toolkit" id="technologies-title"
                description="We choose tools around the product, its users, and the people who will maintain it." />
              <div className="tech-grid grid gap-4 md:grid-cols-3">
                {technologies.map(({ title, icon: Icon, items }) => (
                  <article className="tech-card" key={title}>
                    <h3><Icon size={20} aria-hidden="true" />{title}</h3>
                    <ul className="flex flex-wrap gap-2" aria-label={`${title} technologies`}>
                      {items.map((item) => <li key={item}>{item}</li>)}
                    </ul>
                  </article>
                ))}
              </div>
            </div>
          </section>

          <section id="about" className="section" aria-labelledby="about-title">
            <div className="wrap about-grid">
              <SectionHeading label="About us" title="Built for a wider world" id="about-title" />
              <div className="about-copy">
                <p>BonnO Labs brings product design and software engineering together. Our approach is designed for collaboration across borders, with clear decisions, shared priorities, and handoffs that work across time zones.</p>
                <p>From a focused first release to a growing product, we build for scale with accessible interfaces, maintainable code, and architecture that can evolve with your needs.</p>
              </div>
            </div>
          </section>

          <section id="portfolio" className="section section-tinted" aria-labelledby="portfolio-title">
            <div className="wrap">
              <SectionHeading label="Portfolio" title="Upcoming projects" id="portfolio-title"
                description="A preview of the kinds of products we plan to showcase here." />
              <div className="portfolio-grid grid gap-4 md:grid-cols-3">
                {projects.map(({ title, category, art, icon: Icon }) => (
                  <article className="project-card" key={title}>
                    <div className={`project-art project-art-${art}`} aria-hidden="true">
                      <div className="project-art-grid" />
                      <Icon size={69} strokeWidth={1} />
                    </div>
                    <div className="project-copy">
                      <p className="project-status">Upcoming project</p>
                      <h3>{title}</h3>
                      <p>{category}</p>
                    </div>
                  </article>
                ))}
              </div>
            </div>
          </section>

          <section id="contact" className="section contact-section" aria-labelledby="contact-title">
            <div className="wrap contact-grid">
              <div>
                <div className="icon-tile contact-icon"><Mail size={23} aria-hidden="true" /></div>
                <SectionHeading label="Contact" title="Let’s talk about your project" id="contact-title"
                  description="Tell us what you’re working on, what you want to achieve, and where you could use a hand." />
                <p className="contact-note"><CircleCheck size={19} aria-hidden="true" />Early ideas and existing products are both welcome.</p>
              </div>
              <ContactForm />
            </div>
          </section>
        </main>

        <footer className="site-footer">
          <div className="wrap">
            <div className="footer-main">
              <Brand />
              <nav aria-label="Footer navigation">
                {links.map(([label, href]) => <a href={href} key={href}>{label}</a>)}
              </nav>
              <a className="github-link" href={github}><CodeXml size={18} aria-hidden="true" />GitHub</a>
            </div>
            <p className="copyright">© {new Date().getFullYear()} BonnO Labs.</p>
          </div>
        </footer>
    </>
  )
}
