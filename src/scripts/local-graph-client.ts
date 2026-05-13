// Extracted from LocalGraph.astro so the script always loads via BaseLayout
// (Astro hoists per-component scripts; with Swup reloadScripts:false a script
// that wasn't on the initial page never runs after Swup nav. Loading this
// from BaseLayout guarantees it's present on every page; init no-ops when
// the canvas isn't in the DOM.)

import { forceSimulation, forceLink, forceManyBody, forceCollide, forceX, forceY } from 'd3-force';

interface GNode { id: string; name: string; slug?: string; type: 'post'|'tag'; radius: number; x?: number; y?: number; vx?: number; vy?: number; fx?: number|null; fy?: number|null; }
interface GLink { source: string|GNode; target: string|GNode; type?: string; }

let _sidebarCleanup: (()=>void)|null = null;
let _lastPath = '';

function colors() {
  const cs = getComputedStyle(document.documentElement);
  const dk = document.documentElement.classList.contains('dark');
  const v  = (n: string) => `rgb(${cs.getPropertyValue(n).trim()})`;
  return {
    current: v(dk ? '--color-highlight-400' : '--color-highlight-600'),
    post:    v(dk ? '--color-primary-400'   : '--color-primary-500'),
    tag:     v(dk ? '--color-highlight-500'  : '--color-highlight-300'),
    link:    v(dk ? '--color-primary-700'   : '--color-primary-300'),
    label:   v(dk ? '--color-primary-300'   : '--color-primary-600'),
    bg:      v(dk ? '--color-primary-900'   : '--color-primary-50'),
  };
}

function filterData(raw: any, slug: string) {
  const cur = raw.nodes.find((n: any) => n.id === slug);
  if (!cur) return { nodes: [] as GNode[], links: [] as GLink[] };
  const postIds = new Set<string>([slug]);
  raw.connections.forEach((c: any) => {
    if (c.type !== 'tag') {
      if (c.source === slug) postIds.add(c.target);
      if (c.target === slug) postIds.add(c.source);
    }
  });
  const tagIds = new Set<string>();
  raw.connections.forEach((c: any) => {
    if (c.type === 'tag' && c.source === slug) tagIds.add(c.target);
  });
  const allIds = new Set([...postIds, ...tagIds]);
  return {
    nodes: raw.nodes.filter((n: any) => allIds.has(n.id)).map((n: any): GNode => ({
      id: n.id, name: n.title||n.id, slug: n.slug,
      type: n.type==='tag' ? 'tag' : 'post',
      radius: n.id===slug ? 6 : n.type==='tag' ? 4 : Math.max(3, Math.min(6, (n.connections||0)+2)),
    })),
    links: raw.connections
      .filter((c: any) => allIds.has(c.source) && allIds.has(c.target))
      .map((c: any): GLink => ({ source: c.source, target: c.target, type: c.type })),
  };
}

function buildGraph(
  canvas: HTMLElement,
  data: { nodes: GNode[]; links: GLink[] },
  slug: string,
  W: number, H: number,
  onNodeClick?: (n: GNode) => void,
  initialScale = 1,
): (()=>void) | null {
  canvas.innerHTML = '';
  if (data.nodes.length <= 1) { canvas.style.display = 'none'; return null; }
  canvas.style.display = '';

  const C  = colors();
  const cx = W/2, cy = H/2;
  const simNodes: GNode[] = data.nodes.map(n => ({ ...n }));
  const simLinks: GLink[] = data.links.map(l => ({ ...l }));

  const sim = forceSimulation<GNode>(simNodes)
    .force('link',    forceLink<GNode,GLink>(simLinks).id(d=>d.id).distance(50).strength(0.5))
    .force('charge',  forceManyBody().strength(-80))
    .force('collide', forceCollide<GNode>(d=>d.radius+6))
    .force('x',       forceX(cx).strength(0.08))
    .force('y',       forceY(cy).strength(0.08))
    .stop();
  for (let i = 0; i < 200; i++) sim.tick();

  const svg = document.createElementNS('http://www.w3.org/2000/svg', 'svg');
  svg.setAttribute('width', String(W));
  svg.setAttribute('height', String(H));
  svg.setAttribute('viewBox', `0 0 ${W} ${H}`);
  svg.style.cssText = `max-width:100%;height:auto;display:block;background:${C.bg};border-radius:0.25rem;cursor:default;`;
  canvas.appendChild(svg);

  const g = document.createElementNS('http://www.w3.org/2000/svg', 'g');
  svg.appendChild(g);

  let sc = initialScale;
  let tx = cx * (1 - sc);
  let ty = cy * (1 - sc);
  const applyT = () => g.setAttribute('transform', `translate(${tx},${ty}) scale(${sc})`);
  applyT();

  svg.addEventListener('wheel', (e) => {
    e.preventDefault();
    const r  = svg.getBoundingClientRect();
    const mx = e.clientX - r.left, my = e.clientY - r.top;
    const f  = e.deltaY < 0 ? 1.15 : 1/1.15;
    const ns = Math.max(0.25, Math.min(5, sc*f));
    tx = mx - (mx-tx)*(ns/sc); ty = my - (my-ty)*(ns/sc); sc = ns;
    applyT();
  }, { passive: false });

  let panning = false, pdx = 0, pdy = 0;
  const lockSelection  = () => { document.body.style.userSelect = 'none'; };
  const restoreSelection = () => { document.body.style.userSelect = ''; };

  const panStart = (e: MouseEvent) => {
    if ((e.target as Element).closest('[data-node]')) return;
    e.preventDefault();
    lockSelection();
    panning = true; pdx = e.clientX - tx; pdy = e.clientY - ty; svg.style.cursor = 'grabbing';
  };
  const panMove = (e: MouseEvent) => { if (!panning) return; tx = e.clientX-pdx; ty = e.clientY-pdy; applyT(); };
  const panEnd  = () => { panning = false; svg.style.cursor = 'default'; restoreSelection(); };
  svg.addEventListener('mousedown', panStart);
  window.addEventListener('mousemove', panMove);
  window.addEventListener('mouseup',   panEnd);

  const linesG = document.createElementNS('http://www.w3.org/2000/svg', 'g');
  g.appendChild(linesG);
  const lineEls = simLinks.map(() => {
    const el = document.createElementNS('http://www.w3.org/2000/svg', 'line');
    el.setAttribute('stroke',         C.link);
    el.setAttribute('stroke-opacity', '0.45');
    el.setAttribute('stroke-width',   '1');
    linesG.appendChild(el);
    return el;
  });

  const nodesG = document.createElementNS('http://www.w3.org/2000/svg', 'g');
  g.appendChild(nodesG);

  const nodeEls = simNodes.map(n => {
    const isCur = n.id === slug;
    const isTag = n.type === 'tag';
    const grp   = document.createElementNS('http://www.w3.org/2000/svg', 'g');
    grp.setAttribute('data-node', '1');
    grp.style.cursor = 'pointer';

    let shape: SVGElement;
    if (isTag) {
      const s = n.radius*1.5;
      shape = document.createElementNS('http://www.w3.org/2000/svg', 'polygon');
      (shape as SVGPolygonElement).setAttribute('points', `0,${-s} ${s},0 0,${s} ${-s},0`);
      shape.setAttribute('fill', C.tag); shape.setAttribute('fill-opacity', '0.85');
    } else {
      shape = document.createElementNS('http://www.w3.org/2000/svg', 'circle');
      (shape as SVGCircleElement).setAttribute('r', String(n.radius));
      shape.setAttribute('fill', isCur ? C.current : C.post);
      shape.setAttribute('fill-opacity', isCur ? '1' : '0.75');
    }
    grp.appendChild(shape);

    const lbl = document.createElementNS('http://www.w3.org/2000/svg', 'text');
    lbl.textContent = n.name.length > 20 ? n.name.slice(0,18)+'…' : n.name;
    lbl.setAttribute('text-anchor', 'middle'); lbl.setAttribute('dy', String(n.radius+9));
    lbl.setAttribute('font-size', '6.5'); lbl.setAttribute('fill', C.label);
    lbl.setAttribute('pointer-events', 'none');
    grp.appendChild(lbl);

    let dragStartX = 0, dragStartY = 0, draggingNode = false;
    grp.addEventListener('mousedown', (e) => {
      e.stopPropagation();
      e.preventDefault();
      lockSelection();
      draggingNode = true;
      dragStartX = e.clientX; dragStartY = e.clientY;
      sim.alphaTarget(0.3).restart();
      const onDragMove = (ev: MouseEvent) => {
        if (!draggingNode) return;
        const r  = svg.getBoundingClientRect();
        n.fx = (ev.clientX - r.left - tx) / sc;
        n.fy = (ev.clientY - r.top  - ty) / sc;
      };
      const onDragEnd = (ev: MouseEvent) => {
        draggingNode = false;
        restoreSelection();
        sim.alphaTarget(0);
        const dist = Math.hypot(ev.clientX - dragStartX, ev.clientY - dragStartY);
        if (dist < 5) {
          if (onNodeClick) {
            onNodeClick(n);
          } else {
            navigateTo(n);
          }
        } else {
          n.fx = null; n.fy = null;
        }
        window.removeEventListener('mousemove', onDragMove);
        window.removeEventListener('mouseup',   onDragEnd);
      };
      window.addEventListener('mousemove', onDragMove);
      window.addEventListener('mouseup',   onDragEnd);
    });

    nodesG.appendChild(grp);
    return { grp, shape };
  });

  nodeEls.forEach(({ grp }, i) => {
    const ni = simNodes[i];
    grp.addEventListener('mouseenter', () => {
      nodeEls.forEach(({ shape: s }, j) => {
        const nj = simNodes[j];
        const linked = nj.id===ni.id || (simLinks as any[]).some(l => {
          const src = typeof l.source==='object' ? (l.source as GNode).id : l.source;
          const tgt = typeof l.target==='object' ? (l.target as GNode).id : l.target;
          return (src===ni.id&&tgt===nj.id)||(tgt===ni.id&&src===nj.id);
        });
        s.setAttribute('fill-opacity', linked ? '1' : '0.08');
      });
      lineEls.forEach((el, li) => {
        const l = simLinks[li] as any;
        const src = typeof l.source==='object' ? l.source.id : l.source;
        const tgt = typeof l.target==='object' ? l.target.id : l.target;
        el.setAttribute('stroke-opacity', src===ni.id||tgt===ni.id ? '0.9' : '0.04');
      });
    });
    grp.addEventListener('mouseleave', () => {
      nodeEls.forEach(({ shape: s }, j) => {
        const nj = simNodes[j];
        s.setAttribute('fill-opacity', nj.id===slug?'1':nj.type==='tag'?'0.85':'0.75');
      });
      lineEls.forEach(el => el.setAttribute('stroke-opacity', '0.45'));
    });
  });

  const updatePos = () => {
    (simLinks as any[]).forEach((l, i) => {
      const s = l.source as GNode, t = l.target as GNode;
      lineEls[i].setAttribute('x1', String(s.x??cx)); lineEls[i].setAttribute('y1', String(s.y??cy));
      lineEls[i].setAttribute('x2', String(t.x??cx)); lineEls[i].setAttribute('y2', String(t.y??cy));
    });
    simNodes.forEach((n, i) => nodeEls[i].grp.setAttribute('transform', `translate(${n.x??cx},${n.y??cy})`));
  };
  updatePos();
  sim.on('tick', updatePos).alpha(0.15).restart();

  return () => {
    sim.stop(); svg.remove();
    window.removeEventListener('mousemove', panMove);
    window.removeEventListener('mouseup',   panEnd);
  };
}

function navigateTo(n: GNode) {
  const url = n.type==='tag'
    ? `${import.meta.env.BASE_URL}posts/tag/${encodeURIComponent(n.slug??n.name)}`
    : `${import.meta.env.BASE_URL}posts/${n.slug??n.id}`;
  if ((window as any).swup) (window as any).swup.navigate(url);
  else window.location.href = url;
}

let _fsOpen = false;
function openFullscreen(data: { nodes: GNode[]; links: GLink[] }, slug: string) {
  if (_fsOpen) return;
  _fsOpen = true;

  const overlay = document.createElement('div');
  overlay.className = 'lg-fs-overlay';

  const W = Math.min(window.innerWidth - 64, 960);
  const H = Math.min(window.innerHeight - 100, 660);

  overlay.innerHTML = `
    <div class="lg-fs-box" style="width:${W+16}px">
      <div class="lg-fs-toolbar">
        <button class="lg-fs-gbtn" id="lg-fs-global" title="Open global graph" aria-label="Open global graph">
          <svg xmlns="http://www.w3.org/2000/svg" width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round">
            <circle cx="12" cy="5" r="2"/><circle cx="5" cy="19" r="2"/><circle cx="19" cy="19" r="2"/>
            <line x1="12" y1="7" x2="5" y2="17"/><line x1="12" y1="7" x2="19" y2="17"/>
          </svg>
        </button>
        <button class="lg-fs-close" aria-label="Close fullscreen">
          <svg xmlns="http://www.w3.org/2000/svg" width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round">
            <line x1="18" y1="6" x2="6" y2="18"/><line x1="6" y1="6" x2="18" y2="18"/>
          </svg>
        </button>
      </div>
      <div class="lg-fs-canvas" style="width:${W}px;height:${H}px"></div>
    </div>`;
  document.body.appendChild(overlay);
  document.body.style.overflow = 'hidden';

  const fsCanvas = overlay.querySelector<HTMLElement>('.lg-fs-canvas')!;
  let fsClean: (()=>void)|null = null;

  fsClean = buildGraph(fsCanvas, data, slug, W, H, (n) => {
    close();
    navigateTo(n);
  }, 2);

  const close = () => {
    if (fsClean) { fsClean(); fsClean = null; }
    overlay.remove();
    document.body.style.overflow = '';
    _fsOpen = false;
    const canvas = document.getElementById('local-graph-canvas');
    if (canvas && data.nodes.length > 1) {
      _sidebarCleanup?.(); _sidebarCleanup = null;
      _sidebarCleanup = buildGraph(canvas, data, slug, canvas.offsetWidth||240, 210, undefined, 1.8);
    }
  };

  overlay.querySelector('.lg-fs-close')!.addEventListener('click', close);
  overlay.addEventListener('click', e => { if (e.target === overlay) close(); });
  document.addEventListener('keydown', function esc(e) {
    if (e.key === 'Escape') { close(); document.removeEventListener('keydown', esc); }
  });

  const gbtn = overlay.querySelector<HTMLButtonElement>('#lg-fs-global');
  if (gbtn) {
    gbtn.addEventListener('click', () => {
      close();
      setTimeout(() => {
        if ((window as any).openGraphModal) (window as any).openGraphModal();
        else if ((window as any).initializeGraphModal) {
          (window as any).initializeGraphModal();
          setTimeout(() => (window as any).openGraphModal?.(), 100);
        }
      }, 50);
    });
  }
}

function initLocalGraph() {
  if (_sidebarCleanup) { _sidebarCleanup(); _sidebarCleanup = null; }
  _fsOpen = false;
  (window as any)._localGraphFiltered = null;

  const canvas = document.getElementById('local-graph-canvas');
  if (!canvas) return;
  canvas.innerHTML = '';

  const m    = window.location.pathname.match(/\/posts\/([^/]+)/);
  const slug = m ? decodeURIComponent(m[1]) : '';

  fetch(`${import.meta.env.BASE_URL}graph/graph-data.json`)
    .then(r => r.json())
    .then(raw => {
      if (!document.getElementById('local-graph-canvas')) return;
      const filtered = filterData(raw, slug);
      (window as any)._localGraphFiltered = { data: filtered, slug };
      if (filtered.nodes.length <= 1) {
        document.querySelector<HTMLElement>('.left-sidebar-graph')?.remove();
        return;
      }
      _sidebarCleanup = buildGraph(canvas, filtered, slug, canvas.offsetWidth||240, 210, undefined, 1.8);

      const fsBtn = document.getElementById('local-graph-fullscreen-btn');
      fsBtn?.addEventListener('click', e => { e.stopPropagation(); openFullscreen(filtered, slug); });

      const gbtn = document.getElementById('local-graph-global-btn');
      gbtn?.addEventListener('click', e => {
        e.stopPropagation();
        if ((window as any).openGraphModal) (window as any).openGraphModal();
        else if ((window as any).initializeGraphModal) {
          (window as any).initializeGraphModal();
          setTimeout(() => (window as any).openGraphModal?.(), 100);
        }
      });
    })
    .catch(() => {
      const c = document.getElementById('local-graph-canvas');
      if (c) c.innerHTML = '<p class="graph-error">Graph unavailable</p>';
    });
}

function setupLocalGraphButtons() {
  const toggleBtn  = document.getElementById('local-graph-toggle-btn');
  const expandBtn  = document.getElementById('local-graph-expand-btn');
  const body       = document.getElementById('local-graph-body');
  const widget     = document.querySelector<HTMLElement>('.local-graph-widget');
  if (!toggleBtn || !expandBtn || !body || !widget || (widget as any)._wired) return;
  (widget as any)._wired = true;

  const KEY  = 'graph-collapsed';
  const open = localStorage.getItem(KEY) !== 'true';
  if (!open) widget.classList.add('is-collapsed');
  toggleBtn.setAttribute('aria-expanded', open ? 'true' : 'false');

  const toggle = (collapsed: boolean) => {
    widget.classList.toggle('is-collapsed', collapsed);
    toggleBtn.setAttribute('aria-expanded', collapsed ? 'false' : 'true');
    localStorage.setItem(KEY, String(collapsed));
  };

  toggleBtn.addEventListener('click', e => { e.stopPropagation(); toggle(!widget.classList.contains('is-collapsed')); });
  expandBtn.addEventListener('click', () => toggle(false));
}

window.addEventListener('themechange', () => {
  const cached = (window as any)._localGraphFiltered;
  const canvas = document.getElementById('local-graph-canvas');
  if (canvas && cached?.data && cached.data.nodes.length > 1) {
    _sidebarCleanup?.(); _sidebarCleanup = null;
    _sidebarCleanup = buildGraph(canvas, cached.data, cached.slug, canvas.offsetWidth||240, 210, undefined, 1.8);
  }
});

function run() {
  const path = window.location.pathname;
  if (path === _lastPath) return;
  _lastPath = path;
  initLocalGraph();
  setupLocalGraphButtons();
}

(window as any)._lgRun = run;

document.addEventListener('DOMContentLoaded', run);
document.addEventListener('astro:page-load', run);
if (document.readyState !== 'loading') requestAnimationFrame(run);
window.addEventListener('pageshow', e => { if (e.persisted) { _lastPath = ''; run(); } });
