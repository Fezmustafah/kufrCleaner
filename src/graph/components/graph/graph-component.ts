import { type GraphConfig, type Sitemap, globalGraphConfig } from '../../config';

import { Animator } from '../animator';
import { animatables } from './animatables';

import { GraphRenderer } from './renderer';
import { renderActionContainer } from './action-element';
import { processSitemapData } from './preprocess-sitemap';
import { getGraphColors, type GraphColorConfig } from '../../color';

import {
	REQUIRE_SIMULATION_UPDATE,
	REQUIRE_RENDER_UPDATE,
	REQUIRE_ZOOM_UPDATE,
	REQUIRE_NOTHING,
	REQUIRE_LABEL_UPDATE,
	MAX_DEPTH
} from './constants';
import { setSlashes } from '../../sitemap/browser-utils';
import { onClickOutside, deepDiff, mergeDefaults } from '../util';
import { GraphSimulator } from './simulator';

export class GraphComponent extends HTMLElement {
	placeholderContainer: HTMLElement;

	graphContainer: HTMLElement;
	mockGraphContainer: HTMLElement;
	actionContainer: HTMLElement;
	blurContainer: HTMLElement;

	debug: boolean = false;
	trailingSlashes: boolean = true;

	renderer!: GraphRenderer;
	simulator!: GraphSimulator;

	config!: GraphConfig;
	sitemap!: Sitemap;

	defaultColorTransitions!: Record<string, string>;
	hoverColorTransitions!: Record<string, string>;
	colors!: GraphColorConfig;
	customColorMap!: Record<string, string>;
	usedColors!: string[];
	animator: Animator<ReturnType<typeof animatables>>;

	isFullscreen: boolean = false;
	fullscreenExitHandler?: (options?: boolean | EventListenerOptions | undefined) => void;

	enableClick: boolean = true;

	currentPage!: string;

	ignoreConfigUpdate: boolean = false;
	themeObserver: MutationObserver;
	propertyObserver: MutationObserver;

	/** True once teardown() has run — the component is dead and cannot be revived
	 *  (renderer/simulator are constructed once, in the constructor). */
	private destroyed: boolean = false;

	constructor() {
		super();
		// Fallback to a detached div when there's no previous sibling (our Graph.astro
		// puts classes directly on <graph-component> instead of a separate skeleton div).
		this.placeholderContainer = (this.previousElementSibling as HTMLElement) ?? document.createElement('div');
		this.style.visibility = 'hidden';

		try {
			this.setConfigListener(this.dataset['config']);
			this.sitemap = JSON.parse(this.dataset['sitemap'] || '{}');
			this.trailingSlashes = this.dataset['trailingSlashes'] === 'true';
			// NOTE: This ensures that the slug passed will always have the correct slash format (if using regular Graph.astro)
			this.currentPage = setSlashes(this.dataset['slug'] || location.pathname, true, this.trailingSlashes)
			this.debug = this.dataset['debug'] === 'true';
		} catch (e) {
			console.error('[STARLIGHT-SITE-GRAPH] ' + (e instanceof Error ? e.message : e));
		}

		this.classList.add('slsg-graph-component');

		this.graphContainer = document.createElement('div');
		this.graphContainer.classList.add('slsg-graph-container');
		this.graphContainer.onkeyup = e => {
			if (e.key === 'f') this.enableFullscreen();
		};
		this.graphContainer.tabIndex = 0;
		this.appendChild(this.graphContainer);

		this.actionContainer = document.createElement('div');
		this.actionContainer.classList.add('slsg-graph-action-container');
		renderActionContainer(this);
		this.graphContainer.appendChild(this.actionContainer);

		this.mockGraphContainer = document.createElement('div');
		this.mockGraphContainer.classList.add('slsg-graph-container');

		this.blurContainer = document.createElement('div');
		this.blurContainer.classList.add('slsg-background-blur');

		this.animator = new Animator<ReturnType<typeof animatables>>([]);
		this.themeObserver = new MutationObserver(() => {
			this.colors = getGraphColors(this.graphContainer, this.usedColors, this.customColorMap);
			for (const color of this.usedColors) {
				const key = color.slice(0, color.indexOf('Color') + 5);
				this.animator.setProperties(`${color}`, {
					default: this.colors[color],
					blur: this.colors[(key + 'Muted') as keyof GraphColorConfig],
				});
				this.animator.setProperties(`${color}Hover`, {
					default: this.colors[color],
					hover: this.colors[(key + 'Hover') as keyof GraphColorConfig],
				});
				this.animator.setProperties(`${color}Adjacent`, {
					default: this.colors[color],
					adjacent: this.colors[(key + 'Adjacent') as keyof GraphColorConfig],
				});
			}

			this.animator.startAnimationsTo(this.defaultColorTransitions, { duration: 200 });
		});
		this.themeObserver.observe(document.documentElement, {
			attributeFilter: ['class', 'data-theme'],
		});

		this.renderer = new GraphRenderer(this);
		this.simulator = new GraphSimulator(this);

		this.renderer.mount(this.simulator, this.graphContainer)
			.then(() => this.setup())
			.catch((e) => this.handleInitFailure(e));
		this.simulator.mount(this.renderer);

		this.propertyObserver = new MutationObserver(mutations => {
			mutations.forEach(mutation => {
				if (!this.ignoreConfigUpdate && mutation.attributeName === 'data-config') {
					this.handleConfigChanged();
				}
				if (mutation.attributeName === 'data-sitemap') {
					this.sitemap = JSON.parse(this.dataset['sitemap'] || '{}');
					this.setup();
				}
				this.ignoreConfigUpdate = false;
			});
		});
		this.propertyObserver.observe(this, { attributes: true });
	}

	/**
	 * PixiJS renderer init (WebGL) — or the first setup() — can fail on machines
	 * with hardware acceleration disabled or a blocklisted GPU. Without a catch the
	 * `.then(setup)` chain silently rejects and the loading skeleton pulses forever
	 * as a dark box. Clear it and hide the graph so the surrounding layout looks
	 * intentional rather than broken.
	 */
	handleInitFailure(e: unknown) {
		console.error('[STARLIGHT-SITE-GRAPH] graph failed to initialize:', e);
		this.classList.remove('slsg-graph-skeleton');
		this.placeholderContainer.style.display = 'none';
		// Hide the dead canvas container, but keep the component visible and show a
		// short user-facing notice instead of an empty box / silently missing panel.
		this.graphContainer.style.display = 'none';
		const notice = document.createElement('p');
		notice.className = 'slsg-graph-fallback';
		notice.textContent = 'Graph view unavailable';
		notice.style.cssText = 'margin:0;padding:0.75rem 0;font-size:0.8125rem;line-height:1.4;opacity:0.55;text-align:center;';
		this.appendChild(notice);
		this.style.visibility = 'visible';
	}

	async connectedCallback() {
		// A destroyed component cannot be revived (PixiJS app + observers are gone);
		// Swup always creates a brand-new element for the next page, so this only
		// guards against pathological re-insertion of a torn-down node.
		if (this.destroyed) return;
		const sitemapUrl = this.dataset['sitemapUrl'];
		if (sitemapUrl) {
			this.sitemap = await fetch(sitemapUrl).then(r => r.json()).catch(() => ({}));
			if (!this.isConnected || this.destroyed) return;
			if (this.simulator?.mounted) {
				this.full_refresh();
			}
			// If not mounted yet, setup() will use this.sitemap when it runs
		} else {
			this.sitemap = JSON.parse(this.dataset['sitemap'] || '{}');
		}
	}

	validateConfig(config: any) {
		// EXPL: Ensure that passed config is in expected bounds
		config.depth = (config.depth < 0 || config.depth >= MAX_DEPTH) ? MAX_DEPTH - 1 : config.depth;

		return config;
	}

	handleConfigChanged() {
		const previousConfig = this.config;
		this.setConfigListener(this.dataset['config']);
		const diff = deepDiff(previousConfig, this.config);

		let requireSimulationUpdate = false;
		let requireRendererUpdate = false;
		let requireZoomUpdate = false;
		let requireLabelUpdate = false;
		let requireFullRefresh = false;

		for (const key in diff) {
			if (REQUIRE_NOTHING.includes(key)) {
				continue;
			}

			if (REQUIRE_SIMULATION_UPDATE.includes(key)) {
				requireSimulationUpdate = true;
			} else if (REQUIRE_RENDER_UPDATE.includes(key)) {
				requireRendererUpdate = true;
			} else if (REQUIRE_ZOOM_UPDATE.includes(key)) {
				requireZoomUpdate = true;
			} else if (REQUIRE_LABEL_UPDATE.includes(key)) {
				requireLabelUpdate = true;
			} else {
				requireFullRefresh = true;
				break;
			}
		}

		if (requireFullRefresh) {
			this.full_refresh();
		} else {
			if (requireSimulationUpdate) {
				this.simulator.update();
			}
			if (requireLabelUpdate) {
				const labelOpacityScaleDiff = diff['labelOpacityScale'];
				if (labelOpacityScaleDiff) {
					this.config.labelOpacityScale = labelOpacityScaleDiff.newValue;
				}
				const labelOpacity = this.simulator.getCurrentLabelOpacity();
				this.animator.startAnimations({
					labelOpacity,
					labelOpacityHover: labelOpacity,
					labelOpacityAdjacent: labelOpacity,
				});
				this.simulator.requestRender = true;
			}
			if (requireZoomUpdate) {
				const scaleDiff = diff['scale'];
				if (scaleDiff) {
					this.simulator.updateZoom(scaleDiff.newValue);
				}
			}
			if (requireRendererUpdate) {
				const newAnimatables = animatables(this.config, this.colors, []);
				// TODO: This could be made more efficient by only updating the changed properties
				for (const [key, value] of Object.entries(newAnimatables)) {
					this.animator.setProperties(key, (value as any).properties);
					this.animator.setDuration(key, (value as any).duration);
					this.animator.setEasing(key, (value as any).easing);
					this.animator.setInterpolator(key, (value as any).interpolator);
				}
				this.simulator.requestRender = true;
			}
		}
	}

	/**
	 * Full teardown: releases the PixiJS Application (and its WebGL context — browsers
	 * cap ~8-16 live contexts per tab), stops the simulation, removes all containers
	 * (graphContainer/blurContainer may be parented on document.body while fullscreen),
	 * and disconnects both MutationObservers. Idempotent — safe to reach via both
	 * remove() and disconnectedCallback().
	 */
	private teardown() {
		if (this.destroyed) return;
		this.destroyed = true;

		if (this.isFullscreen) {
			// Unregister the document-level click-outside listener added by enableFullscreen().
			this.fullscreenExitHandler?.();
			this.isFullscreen = false;
		}

		this.renderer.destroy();
		this.simulator.destroy();
		this.placeholderContainer.remove();
		this.graphContainer.remove();
		this.mockGraphContainer.remove();
		this.blurContainer.remove();
		document.body.dataset['graphBlur'] = '';

		this.themeObserver.disconnect();
		this.propertyObserver.disconnect();
	}

	override remove() {
		this.teardown();
		super.remove();
	}

	setConfigListener(config?: string) {
		const mergedConfig = mergeDefaults(globalGraphConfig, JSON.parse(config || '{}'));
		const validatedConfig = this.validateConfig(mergedConfig);
		this.config = new Proxy(validatedConfig, {
			set: (target, prop, value) => {
				target[prop as keyof GraphConfig] = value;
				this.dataset['config'] = JSON.stringify(this.config);
				this.ignoreConfigUpdate = true;
				return true;
			},
		});
	}

	cleanup() {
		if (this.simulator.mounted) {
			this.renderer.cleanup();
			this.simulator.cleanup();
		}
	}

	full_refresh() {
		this.setup();
		renderActionContainer(this);
		this.simulator.resetZoom();
	}

	setupColors(usedColors: string[], customColorMap: Record<string, string>) {
		this.usedColors = usedColors;
		this.customColorMap = customColorMap;
		this.colors = getGraphColors(this.graphContainer, this.usedColors, this.customColorMap);
		this.defaultColorTransitions = Object.fromEntries(
			this.usedColors.flatMap(color => [
				[`${color}`, 'default'],
				[`${color}Hover`, 'default'],
				[`${color}Adjacent`, 'default'],
			]),
		);
		this.hoverColorTransitions = Object.fromEntries(
			this.usedColors.flatMap(color => [
				[`${color}`, 'blur'],
				[`${color}Hover`, 'hover'],
				[`${color}Adjacent`, 'adjacent'],
			]),
		);

		this.animator.setConfigs(animatables(this.config, this.colors, this.usedColors));
		this.animator.startAnimationsTo(this.defaultColorTransitions, { duration: 200 });
	}

	setup() {
		this.placeholderContainer.style.display = '';
		this.style.visibility = 'hidden';

		this.cleanup();
		const { nodes, links, usedColors, customColorMap } = processSitemapData(this, this.sitemap);
		this.setupColors(usedColors, customColorMap);

		const currentNode = nodes.find(node => node.id === this.currentPage);
		this.enableClick = this.config.enableClick !== 'disable';

		this.simulator.initialize(nodes, links, currentNode, this.config.scale);
		this.renderer.initialize();
		this.simulator.update();
		// Pre-settle large graphs while still hidden — converts the initial
		// "explosion" animation into gentle final-approach settling.
		// 30 ticks with alphaDecay=0.06 gets alpha from 1→0.16; only ~17
		// async ticks remain, so nodes appear nearly placed on first paint.
		if (nodes.length > 50) this.simulator.prewarm(30);

		if (this.config.enableDrag) this.simulator.enableDrag();

		if (this.config.enableHover) this.simulator.enableHover();

		if (this.enableClick) this.simulator.enableClick();

		if (this.config.enableZoom || this.config.enablePan) this.simulator.enableZoom();

		this.placeholderContainer.style.display = 'none';
		this.classList.remove('slsg-graph-skeleton');
		this.style.visibility = 'visible';
		this.renderer.resize();
	}

	disconnectedCallback() {
		// Swup navigation replaces #swup-container HTML, permanently detaching this
		// element (the next page gets a brand-new <graph-component> whose constructor
		// re-runs full setup). Without teardown here, every navigation leaked a live
		// PixiJS Application + WebGL context + two MutationObservers.
		//
		// Fullscreen toggling does NOT re-parent <graph-component> itself — only
		// graphContainer/blurContainer move to document.body — so this callback never
		// fires during fullscreen enter/exit. The microtask defer below still guards
		// the theoretical case of the element being moved within the DOM (which fires
		// disconnected+connected synchronously): if it was re-attached by the time the
		// microtask runs, we skip teardown.
		queueMicrotask(() => {
			if (!this.isConnected) this.teardown();
		});
	}

	enableFullscreen() {
		if (this.isFullscreen) return;

		this.isFullscreen = true;

		this.graphContainer.classList.toggle('slsg-is-fullscreen', true);
		// Placeholder keeps the sidebar slot non-empty while graphContainer is elevated.
		this.appendChild(this.mockGraphContainer);
		// Move modal and backdrop to document.body so they paint in the root stacking
		// context. Without this, position:sticky on post-layout-left-col creates a
		// stacking context that traps z-index, causing the modal to render behind the
		// article even though its z-index is 9998.
		document.body.appendChild(this.graphContainer);
		document.body.appendChild(this.blurContainer);
		document.body.dataset['graphBlur'] = 'true';
		this.fullscreenExitHandler = onClickOutside(this.graphContainer, () => {
			this.disableFullscreen();
		});
		this.graphContainer.onkeyup = e => {
			if (e.key === 'Escape' || e.key === 'f') this.disableFullscreen();
		};
		this.toggleFullscreen();
	}

	disableFullscreen() {
		if (!this.isFullscreen) return;

		this.isFullscreen = false;
		document.body.dataset['graphBlur'] = 'false';

		this.graphContainer.classList.toggle('slsg-is-fullscreen', false);
		this.removeChild(this.mockGraphContainer);
		// Move graphContainer back from body into this element, remove backdrop.
		this.appendChild(this.graphContainer);
		this.blurContainer.remove();
		this.fullscreenExitHandler!();
		this.graphContainer.onkeyup = e => {
			if (e.key === 'f') this.enableFullscreen();
		};
		this.toggleFullscreen();
	}

	toggleFullscreen() {
		renderActionContainer(this);
		this.renderer.resize();
		this.colors = getGraphColors(this.graphContainer, this.usedColors, this.customColorMap);
		this.animator.setValue('backgroundColor', this.colors.backgroundColor);
		this.animator.setAllProperties('backgroundColor', this.colors.backgroundColor);
		this.animator.setAllProperties('backgroundColorHover', this.colors.backgroundColor);
		this.simulator.resetZoom(true);
		this.simulator.requestRender = true;
	}

	setStyleDefault() {
		this.animator.startAnimationsTo({
			...this.defaultColorTransitions,
			linkOpacityHover: 'default',
			linkWidthHover: 'default',
			labelOffset: 'default',
			labelScaleHover: 'default',
		});
		this.animator.startAnimation('labelOpacity', this.simulator.getCurrentLabelOpacity());
		this.animator.startAnimation('labelOpacityHover', this.simulator.getCurrentLabelOpacity());
		this.animator.startAnimation('labelOpacityAdjacent', this.simulator.getCurrentLabelOpacity());
	}

	setStyleHovered() {
		this.animator.startAnimationsTo({
			...this.hoverColorTransitions,

			linkOpacityHover: 'hover',
			linkWidthHover: 'hover',
			labelOpacity: 'blur',
			labelOpacityHover: 'hover',
			labelOpacityAdjacent: 'adjacent',
			labelOffset: 'hover',
			labelScaleHover: 'hover',
		});
	}
}
