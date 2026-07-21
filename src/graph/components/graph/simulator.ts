import type { LinkData, NodeData } from './types';
import * as d3 from 'd3';

import { prefetch } from 'astro:prefetch';
import { type GraphRenderer } from './renderer';
import { type GraphComponent } from './graph-component';
import { ensureLeadingSlash, setSlashes } from '../../sitemap/browser-utils';

export class GraphSimulator {
	container!: HTMLCanvasElement;
	renderer!: GraphRenderer;

	simulation!: d3.Simulation<NodeData, undefined>;

	// Quadtree for O(log N) hover detection — rebuilt lazily after each sim tick.
	private _quadtree: d3.Quadtree<NodeData> | null = null;
	private _maxNodeRadius: number = 0;

	nodes!: NodeData[];
	links!: LinkData[];

	currentNode: NodeData | undefined;
	currentlyHovered: string = '';
	isHovering: boolean = false;

	lastClick: number = 0;
	lastClickedNode: NodeData | undefined;
	requireDblClick: boolean = false;

	scale: number = 1;
	transform: d3.ZoomTransform = d3.zoomIdentity;
	zoomTransform: d3.ZoomTransform = d3.zoomIdentity;
	centerTransform: d3.ZoomTransform = d3.zoomIdentity;

	animateZoomOverride: boolean = false;
	userZoomed: boolean = false;

	requestRender = true;
	zoomBehavior!: d3.ZoomBehavior<HTMLCanvasElement, unknown>;

	constructor(private context: GraphComponent) {}

	mount(renderer: GraphRenderer) {
		this.renderer = renderer;
	}

	get mounted() {
		return this.simulation !== undefined;
	}

	initialize(nodes: NodeData[], links: LinkData[], currentNode: NodeData | undefined, scale: number = 1.0) {
		this.nodes = nodes;
		this.links = links;
		this.currentNode = currentNode;

		this.container = this.renderer.canvas;
		this.simulation = d3.forceSimulation<NodeData>(this.nodes);

		// On touch-primary devices (no hover, coarse pointer) treat first tap as
		// hover preview and require a second tap to navigate — same as dblclick mode.
		const isTouchDevice = window.matchMedia('(hover: none) and (pointer: coarse)').matches;
		this.requireDblClick = this.context.config.enableClick === 'dblclick' || isTouchDevice;
		this.zoomTransform = d3.zoomIdentity.scale(scale);
		this.scale = scale;

		this.simulation.on('tick', () => {
			this._quadtree = null; // node positions changed — invalidate quadtree
			this.requestRender = true;
		});
	}

	cleanup() {
		this.currentlyHovered = '';
		this.zoomTransform = d3.zoomIdentity;
		this.centerTransform = d3.zoomIdentity;
		this.transform = d3.zoomIdentity;

		this.simulation.stop();
		this.simulation.nodes([]);
		this.simulation.force('link', null);

		d3.select(this.container).on('drag', null);
		d3.select(this.container).on('zoom', null);
		d3.select(this.container).on('click', null);
		d3.select(this.container).on('mousemove', null);
		d3.select(this.container).on('mouseleave', null);
		d3.select(this.container).on('touchstart.hover', null);
		d3.select(this.container).on('touchmove.hover', null);
	}

	destroy() {
		this.cleanup();
		this.simulation = undefined!;
		this.renderer = undefined!;
		this.context = undefined!;
	}

	update() {
		const linkForce = d3.forceLink<NodeData, LinkData>(this.links).id((d) => d.id);
		if (this.context.config.linkDistance) {
			linkForce.distance(this.context.config.linkDistance);
		}

		this.simulation
			.stop()
			.force('link', linkForce)
			.force('charge', d3.forceManyBody<NodeData>().distanceMax(500).strength(-this.context.config.repelForce))
			.force('forceX', d3.forceX<NodeData>().strength(this.context.config.centerForce))
			.force('forceY', d3.forceY<NodeData>().strength(this.context.config.centerForce))
			.force(
				'collision',
				d3
					.forceCollide<NodeData>()
					.radius(node => node.colliderSize! + this.context.config.colliderPadding),
			)
			.alphaDecay(this.context.config.alphaDecay)
			// velocityDecay is friction (0 = frictionless, 1 = full stop each tick).
			// D3 defaults to 0.4 which causes nodes to overshoot and oscillate.
			// 0.6 settles nodes ~3× faster and is the primary fix for drag vibration.
			.velocityDecay(0.6)
			// alphaMin: stop simulation once kinetic energy is low. Default 0.001 runs
			// ~300 ticks which blocks the main thread on large graphs. 0.05 stops after
			// ~60–80 ticks — visually indistinguishable but eliminates the freeze.
			.alphaMin(0.05)
			.alpha(1)
			.restart();
	}

	// Run N simulation ticks synchronously while the graph is still hidden.
	// Cancels the async timer from update(), advances alpha, then restarts async
	// for the remainder. This converts a 1-second "explosion" animation into a
	// short gentle settling — nodes appear already spread when graph becomes visible.
	prewarm(ticks: number) {
		this.simulation.stop();
		this.simulation.tick(ticks);
		this._quadtree = null;
		this.requestRender = true;
		this.simulation.restart();
	}

	findOverlappingNode(x: number, y: number): NodeData | undefined {
		const nodes = this.simulation.nodes();
		if (!nodes.length) return undefined;

		// Build quadtree lazily (invalidated on each simulation tick).
		// d3.quadtree.find() is O(log N) vs the previous O(N) linear scan.
		// maxNodeRadius is computed once during the build and reused each query.
		if (!this._quadtree) {
			this._maxNodeRadius = 0;
			this._quadtree = d3.quadtree<NodeData>()
				.x(d => d.x ?? 0)
				.y(d => d.y ?? 0)
				.addAll(nodes);
			for (const n of nodes) {
				if ((n.fullRadius ?? 0) > this._maxNodeRadius) this._maxNodeRadius = n.fullRadius!;
			}
		}

		// find() returns the nearest node within maxNodeRadius; confirm exact hit.
		// Radii are multiplied by the semantic-zoom counter-scale so the hit area
		// matches the visually shrunk/grown node, not its world-layout size.
		const visualScale = this.nodeZoomScale();
		const found = this._quadtree.find(x, y, this._maxNodeRadius * visualScale);
		if (!found) return undefined;
		const dx = (found.x ?? 0) - x, dy = (found.y ?? 0) - y;
		return dx * dx + dy * dy <= ((found.fullRadius ?? 0) * visualScale) ** 2 ? found : undefined;
	}

	enableDrag() {
		let dragX = 0;
		let dragY = 0;
		d3.select(this.container).call(
			(d3.drag().container(this.container) as unknown as d3.DragBehavior<HTMLCanvasElement, unknown, unknown>)
				.subject(event => {
					const [x, y] = this.transform.invert([event.x, event.y]);
					return this.findOverlappingNode(x, y);
				})
				.on('start', e => {
					if (!e.subject) return;

					this.userZoomed = true;

					// 0.3 keeps the simulation in a high-energy state the whole time the
					// user drags, causing hub nodes (tags with many connections) to oscillate
					// wildly. 0.08 is enough to let the dragged node settle its neighbours
					// without cascading oscillation across the graph.
					if (!e.active) this.simulation.alphaTarget(0.08).restart();

					e.subject.fx = e.subject.x;
					e.subject.fy = e.subject.y;
					dragX = e.x;
					dragY = e.y;
				})
				.on('drag', e => {
					if (!e.subject) return;

					dragX += e.dx / this.context.animator.getValue('zoom');
					dragY += e.dy / this.context.animator.getValue('zoom');

					e.subject.fx = dragX;
					e.subject.fy = dragY;
				})
				.on('end', e => {
					if (!e.subject) return;

					if (!e.active) this.simulation.alphaTarget(0);
					if (this.currentlyHovered) this.unhoverNode();
					e.subject.fx = null;
					e.subject.fy = null;
				}),
		);
	}

	enableHover() {
		// Coalesce mousemove events to one check per animation frame (rAF gate).
		// A 3px dead zone prevents spurious re-triggers when the cursor barely moves.
		// We also guard setStyleHovered() so it only fires when the hovered node changes,
		// eliminating redundant color-animation cascades on intra-node cursor movement.
		let _pendingX: number | null = null, _pendingY: number | null = null;
		let _lastHX = 0, _lastHY = 0;
		let _hoverRafId: number | null = null;

		const processHover = () => {
			_hoverRafId = null;
			if (_pendingX === null) return;
			const px = _pendingX!, py = _pendingY!;
			_pendingX = _pendingY = null;

			// Dead zone: skip if cursor moved less than 3 px since last processed position
			const dx = px - _lastHX, dy = py - _lastHY;
			if (dx * dx + dy * dy < 9) return;
			_lastHX = px; _lastHY = py;

			const [x, y] = this.transform.invert([px, py]);
			const closestNode = this.findOverlappingNode(x, y);

			if (closestNode) {
				this.isHovering = true;
				if (this.context.config.prefetchPages && closestNode !== this.currentNode && !closestNode.external) {
					prefetch(ensureLeadingSlash(closestNode.id));
				}
				// Only trigger hover style/animation when the hovered node actually changes
				if (this.currentlyHovered !== closestNode.id) {
					this.currentlyHovered = closestNode.id;
					this.context.setStyleHovered();
					this.context.updateTooltip(closestNode);
					this.requestRender = true;
				}
				this.container.style.cursor = this.context.enableClick && this.isClickable(closestNode) ? 'pointer' : 'default';
			} else if (this.currentlyHovered) {
				this.unhoverNode();
			}
		};

		d3.select(this.container).on('mousemove', (e: MouseEvent) => {
			_pendingX = e.offsetX;
			_pendingY = e.offsetY;
			if (_hoverRafId !== null) return; // already scheduled for this frame
			_hoverRafId = requestAnimationFrame(processHover);
		});

		d3.select(this.container).on('mouseleave', (event) => {
			_pendingX = _pendingY = null; // cancel any pending check
			_lastHX = _lastHY = 0;       // reset dead zone on re-entry
			if (this.currentlyHovered && !event.buttons) {
				this.unhoverNode();
			}
		});

		// Mobile touch: touchstart = show hover preview, touchmove > 5px = drag (unhover).
		// Works alongside requireDblClick so: tap = preview, second tap = navigate.
		if (window.matchMedia('(hover: none) and (pointer: coarse)').matches) {
			let _touchStartX = 0, _touchStartY = 0;

			d3.select(this.container).on('touchstart.hover', (e: TouchEvent) => {
				const touch = e.touches[0];
				_touchStartX = touch.clientX;
				_touchStartY = touch.clientY;

				const rect = this.container.getBoundingClientRect();
				const px = touch.clientX - rect.left;
				const py = touch.clientY - rect.top;
				const [x, y] = this.transform.invert([px, py]);
				const node = this.findOverlappingNode(x, y);

				if (node) {
					this.isHovering = true;
					if (this.context.config.prefetchPages && node !== this.currentNode && !node.external) {
						prefetch(ensureLeadingSlash(node.id));
					}
					if (this.currentlyHovered !== node.id) {
						this.currentlyHovered = node.id;
						this.context.setStyleHovered();
						this.context.updateTooltip(node);
						this.requestRender = true;
					}
				} else if (this.currentlyHovered) {
					this.unhoverNode();
				}
			}, { passive: true } as AddEventListenerOptions);

			d3.select(this.container).on('touchmove.hover', (e: TouchEvent) => {
				const touch = e.touches[0];
				const dx = touch.clientX - _touchStartX;
				const dy = touch.clientY - _touchStartY;
				// 5px threshold — finger moved, it's a pan/drag, clear preview
				if (dx * dx + dy * dy > 25 && this.currentlyHovered) {
					this.unhoverNode();
				}
			}, { passive: true } as AddEventListenerOptions);
		}
	}

	unhoverNode() {
		this.isHovering = false;
		this.context.setStyleDefault();
		this.context.updateTooltip(null);
		this.context.animator.setOnFinished('nodeColorHover', () => {
			this.currentlyHovered = '';
			this.requestRender = false;
		});
		this.container.style.cursor = 'default';
	}

	enableClick() {
		d3.select(this.container).on('click', (e: MouseEvent) => {
			const [x, y] = this.transform.invert([e.offsetX, e.offsetY]);
			const closestNode = this.findOverlappingNode(x, y);
			if (closestNode && this.isClickable(closestNode)) {
				const clickTime = Date.now();
				if (
					!this.requireDblClick ||
					(clickTime - this.lastClick < 500 && closestNode === this.lastClickedNode)
				) {
					if (closestNode.external) {
						window.open(closestNode.id, '_blank');
					} else if (this.context.config.followLink === 'graph') {
						this.context.currentPage = closestNode.id;
						this.context.full_refresh();
						this.context.setStyleDefault();
					} else if (this.context.config.followLink === 'new-tab') {
						window.open(ensureLeadingSlash(closestNode.id), '_blank');
					} else {
						// Trailing slash is load-bearing: the SITE serves pages at /path/ only
						// (context.trailingSlashes=false is slug normalization, not URL style).
						// Swup's page fetch does not survive the slashless 404/redirect — it
						// falls back to a full page load, silently defeating the SPA nav below.
						const url = setSlashes(closestNode.id, true, true);
						// Same-tab: prefer Swup SPA navigation; window.open('_self') is the
						// fallback for iframe embeds or pages where Swup never booted.
						const swup = (window as unknown as { swup?: { navigate?: (url: string) => void } }).swup;
						if (window.self === window.top && typeof swup?.navigate === 'function') {
							swup.navigate(url);
						} else {
							window.open(url, '_self');
						}
					}
				}
				this.lastClick = clickTime;
				this.lastClickedNode = closestNode;
			}
		});
	}

	enableZoom() {
		// Same seeding as resetZoom: without it the very first wheel gesture starts
		// from d3's default identity (k=1) while zoomTransform sits at k=scale.
		this.renderer.resetZoom(d3.zoomIdentity.scale(this.scale));
		// Zoom ceiling scales with graph size (√(n/4), capped at 16): at maxZoom 8
		// a 1300-node graph still has ~50 long titles in view with nowhere left
		// to zoom, while a high fixed ceiling on a small graph just zooms into
		// empty space between nodes.
		const n = this.nodes?.length ?? 0;
		const maxZoom = n > 55
			? Math.min(16, Math.max(this.context.config.maxZoom, Math.sqrt(n / 4)))
			: this.context.config.maxZoom;
		d3.select(this.container as HTMLCanvasElement).call(
			(this.zoomBehavior = (d3.zoom() as d3.ZoomBehavior<HTMLCanvasElement, unknown>)
				.scaleExtent([this.context.config.minZoom, maxZoom])
				.on('zoom', ({ transform }: { transform: d3.ZoomTransform }) => {
					this.userZoomed = true;
					// The anchored position goes stale the moment the view moves;
					// hide rather than track (next hover change repositions it).
					this.context.updateTooltip(null);
					if (!this.context.config.enablePan) {
						// D3 zoom to origin (instead of to mouse position)
						const cx = this.container.clientWidth / 2;
						const cy = this.container.clientHeight / 2;
						this.zoomTransform = new d3.ZoomTransform(transform.k, cx * (1 - transform.k / this.scale), cy * (1 - transform.k / this.scale));
					} else {
						this.zoomTransform = transform;
					}

					this.updateTransform();
				})
				.on('start', ({ sourceEvent }) => {
					if (sourceEvent instanceof MouseEvent && sourceEvent.type === 'mousedown') {
						document.body.style.cursor = 'grab';
					}
				})
				.on('end', () => {
					document.body.style.cursor = 'default';
				})
			)
		);

		if (!this.context.config.enablePan) {
			this.zoomBehavior.filter((event) => {
				return event.type !== 'mousedown';
			});
		}

		if (!this.context.config.enableZoom) {
			this.zoomBehavior.filter((event) => {
				return event.type !== 'wheel' && !(event.type === 'touchstart' && event.touches.length >= 2);
			});
		}
	}

	isClickable(node: NodeData): boolean {
		return node.exists && node.id !== this.currentNode?.id;
	}

	resetZoom(immediate: boolean = false) {
		this.userZoomed = false;
		// Seed d3-zoom's gesture state (canvas.__zoom) to MATCH zoomTransform —
		// seeding it to identity while zoomTransform is scale(scale) made the first
		// wheel after a reset snap from k=scale to k≈1.
		this.renderer.resetZoom(d3.zoomIdentity.scale(this.scale));
		this.zoomTransform = d3.zoomIdentity.scale(this.scale);
		this.updateCenterTransform();

		this.updateTransform(immediate);
	}

	// Label fade is BASELINE-RELATIVE (alkarkari/quartz): k is measured against the
	// at-rest zoom, so "zoom in a bit → labels appear" behaves identically whatever
	// the fitted zoom of the dataset is. zoomTransform.k equals this.scale at rest
	// (the bounds-fit lives in centerTransform, a constant factor that cancels out
	// of the ratio), so k / scale IS the user's relative zoom.
	// DENSITY-AWARE: the configured labelOpacityScale describes the mode's intent
	// for its normal size (sidebar = a dozen neighbors, labels always on). When the
	// depth action turns that same graph into hundreds/thousands of nodes, the
	// threshold must scale with count: nodes-in-view ∝ N/rz², so labels appear at
	// rz ≈ √(N/55) — the zoom where roughly 55 nodes fill the viewport — instead
	// of a fixed rz that leaves hundreds of long titles on screen at once. Dense
	// graphs also get a steeper ramp (0.45 vs 0.9) so labels still reach full
	// opacity within maxZoom.
	getCurrentLabelOpacity(k: number = this.zoomTransform.k): number {
		const configured = this.context.config.labelOpacityScale;
		const n = this.nodes?.length ?? 0;
		const dense = n > 55;
		// 40-in-view at appearance (not 55): long article titles need more air
		// than dot-count parity suggests — the center of the cloud is denser
		// than the uniform-density estimate.
		const opacityScale = dense ? Math.min(configured, Math.sqrt(40 / n)) : configured;
		return Math.max(((k / this.scale) * opacityScale - 1) / (dense ? 0.45 : 0.9), 0);
	}

	/**
	 * aarnphm's semantic-zoom law: solid marks (nodes, labels) scale as √zoom
	 * while distances scale linearly, so the space between nodes visibly opens
	 * as you zoom in. This is the world-space counter-scale factor applied to
	 * node graphics: screen radius ∝ √(relativeZoom) instead of ∝ zoom.
	 */
	nodeZoomScale(): number {
		const relativeZoom = Math.max(this.zoomTransform.k / this.scale, 1e-4);
		return Math.min(Math.max(1 / Math.sqrt(relativeZoom), 0.25), 4);
	}

	updateZoom(scale?: number, x?: number, y?: number, immediate: boolean = false) {
		const values: { zoom: number; transformX: number; transformY: number; labelOpacity?: number } = {
			zoom: scale ?? this.transform.k,
			transformX: x ?? this.transform.x,
			transformY: y ?? this.transform.y,
		};
		if (!this.currentlyHovered) {
			// Default arg = zoomTransform.k: label opacity must not drift while the
			// warmup bounds-fit animates centerTransform (transform.k changes, the
			// user's relative zoom doesn't).
			values.labelOpacity = this.getCurrentLabelOpacity();
		}

		if (immediate) {
			this.animateZoomOverride = true;
			this.context.animator.setValues(values);
		} else {
			this.context.animator.startAnimations(values);
		}
	}

	updateTransform(immediate: boolean = false) {
		this.transform = this.zoomTransform
			.translate(this.centerTransform.x, this.centerTransform.y)
			.scale(this.centerTransform.k);
		this.updateZoom(this.transform.k, this.transform.x, this.transform.y, immediate);
	}

	/**
	 * Bounds-fit (alkarkari zoomToFit): centers the node bounding box in the
	 * viewport and scales so the whole graph fits, capped at the configured base
	 * scale so tiny local graphs don't get blown up. Runs every tick while the
	 * user hasn't interacted (renderer gates on !userZoomed), so the view stays
	 * fitted while the warmup layout expands — alkarkari's onEngineTick fit.
	 * @returns {boolean} Whether the transform was updated.
	 */
	updateCenterTransform(): boolean {
		const w = this.container.clientWidth;
		const h = this.container.clientHeight;
		let k = this.scale;
		let bx = 0;
		let by = 0;

		const nodes = this.simulation?.nodes() ?? [];
		if (nodes.length) {
			let minX = Infinity, maxX = -Infinity, minY = Infinity, maxY = -Infinity;
			for (const n of nodes) {
				const r = n.fullRadius ?? 0;
				if (n.x! - r < minX) minX = n.x! - r;
				if (n.x! + r > maxX) maxX = n.x! + r;
				if (n.y! - r < minY) minY = n.y! - r;
				if (n.y! + r > maxY) maxY = n.y! + r;
			}
			const pad = 32; // screen px of breathing room around the fitted graph
			// Total on-screen zoom is zoomTransform.k * centerTransform.k = scale * k,
			// so divide the fitted total by scale to get this transform's share.
			// Cap at this.scale: total ≤ scale² — the pre-fit resting zoom — so a
			// 3-node sidebar graph isn't magnified to fill the box.
			const fitTotal = Math.min(
				Math.max(w - 2 * pad, 1) / Math.max(maxX - minX, 1),
				Math.max(h - 2 * pad, 1) / Math.max(maxY - minY, 1),
			);
			k = Math.min(fitTotal / this.scale, this.scale);
			bx = (minX + maxX) / 2;
			by = (minY + maxY) / 2;
		}

		const x = w / (2 * this.scale) - k * bx;
		const y = h / (2 * this.scale) - k * by;

		if (this.centerTransform.x !== x || this.centerTransform.y !== y || this.centerTransform.k !== k) {
			this.centerTransform = new d3.ZoomTransform(k, x, y);
			return true;
		}

		return false;
	}
}
