// Behaviour for the floating AI assistant (markup in components/AiAssistant.astro).
//
// Loaded globally from BaseLayout so it survives Swup navigation. It no-ops on
// any page without the assistant root (the widget only renders on the homepage).
// All answers come from the Cloudflare Worker /ask route; text is inserted via
// textContent (never innerHTML) so model output can't inject markup.

interface AskResponse {
  answer: string;
  sources: Array<{ title: string; url: string }>;
  notFound?: boolean;
  error?: string;
}

function initAiAssistant(): void {
  const root = document.querySelector<HTMLElement>('[data-ai-assistant]');
  if (!root || root.dataset.aiReady === '1') return;
  root.dataset.aiReady = '1';

  const workerUrl = (root.dataset.workerUrl || '').replace(/\/$/, '');
  const panel = root.querySelector<HTMLElement>('[data-ai-panel]');
  const toggle = root.querySelector<HTMLButtonElement>('[data-ai-toggle]');
  const closeBtn = root.querySelector<HTMLButtonElement>('[data-ai-close]');
  const messages = root.querySelector<HTMLElement>('[data-ai-messages]');
  const form = root.querySelector<HTMLFormElement>('[data-ai-form]');
  const input = root.querySelector<HTMLTextAreaElement>('[data-ai-input]');
  const sendBtn = root.querySelector<HTMLButtonElement>('[data-ai-send]');
  const iconOpen = root.querySelector('[data-ai-icon-open]');
  const iconClose = root.querySelector('[data-ai-icon-close]');
  if (!panel || !toggle || !messages || !form || !input || !workerUrl) return;

  let busy = false;

  function setIconHidden(icon: Element | null, hidden: boolean): void {
    if (icon instanceof HTMLElement || icon instanceof SVGElement) {
      icon.style.display = hidden ? 'none' : '';
    }
  }

  function setOpen(open: boolean): void {
    panel!.hidden = !open;
    toggle!.setAttribute('aria-expanded', String(open));
    setIconHidden(iconOpen, open);
    setIconHidden(iconClose, !open);
    if (open) setTimeout(() => input!.focus(), 60);
  }

  function scrollDown(): void {
    messages!.scrollTop = messages!.scrollHeight;
  }

  function addUser(text: string): void {
    const el = document.createElement('div');
    el.className = 'ai-msg ai-msg--user text-primary-900 dark:text-primary-50';
    el.textContent = text;
    messages!.appendChild(el);
    scrollDown();
  }

  function addBot(): { setText: (t: string) => void; setSources: (s: AskResponse['sources']) => void; remove: () => void } {
    const wrap = document.createElement('div');
    wrap.className = 'ai-msg ai-msg--bot';
    const p = document.createElement('p');
    p.className = 'text-primary-700 dark:text-primary-300 leading-relaxed whitespace-pre-wrap';
    p.textContent = '…';
    wrap.appendChild(p);
    messages!.appendChild(wrap);
    scrollDown();
    return {
      setText: (t: string) => { p.textContent = t; scrollDown(); },
      setSources: (sources) => {
        if (!sources?.length) return;
        const box = document.createElement('div');
        box.className = 'ai-sources mt-2 flex flex-col gap-1';
        const label = document.createElement('p');
        label.className = 'text-[0.7rem] font-semibold uppercase tracking-wider text-primary-400 dark:text-primary-500';
        label.textContent = 'Sources';
        box.appendChild(label);
        sources.forEach((s) => {
          const a = document.createElement('a');
          a.href = s.url;
          a.textContent = s.title;
          a.className = 'text-[0.85rem] text-highlight-600 dark:text-highlight-400 hover:underline';
          box.appendChild(a);
        });
        wrap.appendChild(box);
        scrollDown();
      },
      remove: () => wrap.remove(),
    };
  }

  async function ask(question: string): Promise<void> {
    const q = question.trim();
    if (!q || busy) return;
    busy = true;
    if (sendBtn) sendBtn.disabled = true;
    addUser(q);
    input!.value = '';
    input!.style.height = 'auto';
    const bot = addBot();

    try {
      const res = await fetch(`${workerUrl}/ask`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ question: q }),
      });
      const data: AskResponse = await res.json().catch(() => ({ answer: '', sources: [] }));
      if (!res.ok) {
        bot.setText(data.error || 'Something went wrong. Please try again.');
      } else {
        bot.setText(data.answer || 'No answer.');
        bot.setSources(data.sources);
      }
    } catch {
      bot.setText('Could not reach the assistant. Please check your connection and try again.');
    } finally {
      busy = false;
      if (sendBtn) sendBtn.disabled = false;
      input!.focus();
    }
  }

  toggle.addEventListener('click', () => setOpen(panel.hidden));
  closeBtn?.addEventListener('click', () => setOpen(false));

  form.addEventListener('submit', (e) => {
    e.preventDefault();
    ask(input.value);
  });

  // Enter to send, Shift+Enter for newline; auto-grow.
  input.addEventListener('keydown', (e) => {
    if (e.key === 'Enter' && !e.shiftKey) {
      e.preventDefault();
      ask(input.value);
    }
  });
  input.addEventListener('input', () => {
    input.style.height = 'auto';
    input.style.height = Math.min(input.scrollHeight, 112) + 'px';
  });

  root.querySelectorAll<HTMLButtonElement>('[data-ai-suggestion]').forEach((btn) => {
    btn.addEventListener('click', () => ask(btn.dataset.aiSuggestion || btn.textContent || ''));
  });

  document.addEventListener('keydown', (e) => {
    if (e.key === 'Escape' && !panel.hidden) setOpen(false);
  });
}

document.addEventListener('astro:page-load', initAiAssistant);
if (document.readyState !== 'loading') initAiAssistant();
else document.addEventListener('DOMContentLoaded', initAiAssistant);

export {};
