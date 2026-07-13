import * as PIXI from './pixi/pixi';
import type { LinkData, NodeData } from './types';

import type { NodeShapeType } from '../../config';
import { type GraphComponent } from './graph-component';

// prettier-ignore
import {
	LABEL_DEFAULT_Z_INDEX,
	ARROW_DEFAULT_Z_INDEX, ARROW_HOVER_Z_INDEX, ARROW_MUTED_Z_INDEX,
	LINK_DEFAULT_Z_INDEX, LINK_HOVER_Z_INDEX, LINK_MUTED_Z_INDEX,
	NODE_DEFAULT_Z_INDEX, NODE_HOVER_Z_INDEX, NODE_MUTED_Z_INDEX,
	STROKE_DEFAULT_Z_INDEX, STROKE_HOVER_Z_INDEX, STROKE_MUTED_Z_INDEX,
	DEFAULT_ARROW_SCALE, STAR_LINE_DEPTH
} from './constants';
import type { GraphSimulator } from './simulator';

// TODO: Shared graphicsContext would improve performance (investigate whether context would share zIndex/...)
export class GraphRenderer {
	app: PIXI.Application;
	container!: HTMLElement;
	simulator!: GraphSimulator;

	linkGraphics!: PIXI.Graphics;
	linkHoverGraphics!: PIXI.Graphics;
	arrowGraphics!: PIXI.Graphics;
	arrowHoverGraphics!: PIXI.Graphics;

	visibilityObserver!: IntersectionObserver;

	constructor(private context: GraphComponent) {
		this.app = new PIXI.Application();
	}

	async mount(simulator: GraphSimulator, container: HTMLElement) {
		this.simulator = simulator;
		this.container = container;
		// this.container.replaceChildren();
		// Don't use resizeTo — when the container starts as display:none (modal) it
		// produces a feedback loop with wrong dimensions. We handle resize via
		// IntersectionObserver (visibility trigger) and explicit calls instead.
		try {
			await this.app.init({
				antialias: true,
				backgroundAlpha: 0,
				// Clamp renderer resolution to [2, 4].
				// Minimum 2: on 1× displays, 2× oversampling gives PixiJS's 2D text canvas
				// enough pixels to anti-alias cleanly (otherwise text has visible staircase aliasing).
				// Maximum 4: above 4× the GPU fill-rate cost is extreme with negligible gain.
				// autoDensity:true handles the CSS scaling so the canvas always fits its container.
				resolution: Math.min(Math.max(window.devicePixelRatio ?? 2, 2), 4),
				autoDensity: true,
			} as PIXI.ApplicationOptions);
		} catch (e) {
			// PixiJS needs a WebGL context. When hardware acceleration is disabled or
			// the GPU is blocklisted (common on desktop browsers), init() rejects.
			// Re-throw tagged so the GraphComponent can clear the loading skeleton
			// instead of leaving a dark box pulsing forever.
			throw new Error(
				'PixiJS renderer init failed — WebGL unavailable (hardware acceleration disabled or GPU blocklisted): ' +
				(e instanceof Error ? e.message : String(e)),
			);
		}
		this.container.appendChild(this.app.canvas);

		this.visibilityObserver = new IntersectionObserver((entries) => {
			if (entries[0]?.isIntersecting) {
				this.resize();
			}
		});
		this.visibilityObserver.observe(this.container);

		window.addEventListener('resize', () => this.resize());

		this.app.stage.addChild(this.linkGraphics = new PIXI.Graphics());
		this.app.stage.addChild(this.linkHoverGraphics = new PIXI.Graphics());
		this.app.stage.addChild(this.arrowGraphics = new PIXI.Graphics());
		this.app.stage.addChild(this.arrowHoverGraphics = new PIXI.Graphics());
		this.linkHoverGraphics.zIndex = LINK_HOVER_Z_INDEX;
		this.arrowHoverGraphics.zIndex = ARROW_HOVER_Z_INDEX;

		this.app.stage.sortableChildren = true;
		this.app.ticker.add((ticker: PIXI.Ticker) => {
			this.tick(ticker);
		});

	}

	get canvas() {
		return this.app.canvas;
	}

	get mounted() {
		return this.context !== undefined;
	}

	resize() {
		const w = this.container.clientWidth;
		const h = this.container.clientHeight;
		if (w > 0 && h > 0) {
			this.app.renderer.resize(w, h);
		}
	}

	initialize() {
		this.initializeNodes(this.simulator.nodes);
	}

	cleanup() {
		this.app.stage.removeChildren();
		this.app.stage.addChild(this.linkGraphics.clear());
		this.app.stage.addChild(this.linkHoverGraphics.clear());
		this.app.stage.addChild(this.arrowGraphics.clear());
		this.app.stage.addChild(this.arrowHoverGraphics.clear());
	}

	destroy() {
		// app.init() may have rejected (WebGL/unsafe-eval) leaving a half-built
		// Application whose destroy() throws "_cancelResize is not a function".
		// teardown() must stay non-throwing so Swup navigation isn't broken.
		try { this.app?.destroy(); } catch { /* app never fully initialized */ }
		this.app = undefined!;
		this.simulator = undefined!;
		this.context = undefined!;
		this.visibilityObserver.disconnect();
	}

	tick(ticker: PIXI.Ticker) {
		this.context.animator.update(ticker.deltaMS);

		// The ticker starts in mount() (right after app.init), but the simulator is
		// only populated by initialize() inside setup() — deferred until the sitemap
		// fetch resolves on the data-sitemap-url path (e.g. /graph-view/). Until then
		// there is no container/nodes; skip the sim + draw so the loop doesn't read
		// clientWidth off an undefined container. Optional-chain also covers a
		// stray tick after teardown() nulls the simulator.
		if (!this.simulator?.mounted) return;

		if (!this.simulator.userZoomed) {
			const updated = this.simulator.updateCenterTransform();
			if (updated) {
				this.simulator.updateTransform();
			}
		}

		if (this.zoomIsAnimating()) {
			this.app.stage.updateTransform({
				scaleX: this.context.animator.getValue('zoom'),
				scaleY: this.context.animator.getValue('zoom'),
				x: this.context.animator.getValue('transformX'),
				y: this.context.animator.getValue('transformY'),
			});
			this.simulator.animateZoomOverride = false;
		}

		// Skip redrawing individual nodes when ONLY the zoom transform is animating.
		// app.stage.updateTransform() (above) already repositions the whole scene via
		// GPU transform, so per-node draw calls are redundant during pure zoom.
		// We still draw when: sim tick fired (requestRender), a node is hovered (colors
		// changing), or any non-zoom animation is running (label opacity, etc.).
		const pureZoom = this.zoomIsAnimating()
			&& !this.simulator.requestRender
			&& this.simulator.currentlyHovered === '';
		if (this.simulator.requestRender || (this.context.animator.anyAnimating && !pureZoom)) {
			this.simulator.requestRender = false;
			this.drawNodes(this.simulator.nodes);
			this.drawLinks(this.simulator.links);
		}
		this.linkHoverGraphics.alpha = this.context.animator.getValue('linkOpacityHover');
		this.arrowHoverGraphics.alpha = this.context.animator.getValue('linkOpacityHover');
	}

	resetZoom(zoomTransform: { k: number; x: number; y: number }) {
		// @ts-expect-error __zoom is a private property
		this.app.canvas.__zoom = zoomTransform;
	}

	zoomIsAnimating() {
		if (this.simulator.animateZoomOverride) {
			return true;
		}
		return (
			this.context.animator.isAnimating('zoom') ||
			this.context.animator.isAnimating('transformX') ||
			this.context.animator.isAnimating('transformY')
		);
	}

	initializeNodes(nodes: NodeData[]) {
		for (const node of nodes) {
			node.node = new PIXI.Graphics();
			if (node.strokeWidth) {
				node.stroke = new PIXI.Graphics();
				this.drawNodeStroke(node);
				this.app.stage.addChild(node.stroke);
			}

			this.drawNodeShape(node);
			this.app.stage.addChild(node.node);

			if (this.context.config.renderLabels) {
				this.createLabel(node);
				this.app.stage.addChild(node.label);
			}
		}
	}

	drawNodeShape(node: NodeData, hovered?: boolean, adjacent?: boolean) {
		node.node!.clear();
		this.drawNode(
			node.node!,
			node.shape!,
			node.computedSize! - node.shapeCornerRadius!,
			node.shapeRotation!,
			node.shapePoints!,
		).fill(0xffffff)._zIndex =
			hovered === undefined ? NODE_DEFAULT_Z_INDEX : hovered ? NODE_HOVER_Z_INDEX : NODE_MUTED_Z_INDEX;
		node.node!.tint = this.context.animator.getValue((node.shapeColor + (hovered ? 'Hover' : (adjacent ? 'Adjacent' : ''))) as any) as string;

		if (node.shapeCornerRadius) {
			node.node!.stroke({
				color: 0xffffff,
				width: node.shapeCornerRadius!,
				join: node.cornerType!,
			});
		}
	}

	drawNodeStroke(node: NodeData, hovered?: boolean, adjacent?: boolean) {
		let strokeFill, strokeTint;
		if (node.strokeColor === 'inherit') {
			strokeFill = node.node!.tint;
			strokeTint = node.node!.tint;
		} else {
			strokeFill = 0xffffff;
			strokeTint = this.context.animator.getValue((node.strokeColor + (hovered ? 'Hover' : (adjacent ? 'Adjacent' : ''))) as any) as string;
		}

		node.stroke!.clear();
		node.stroke!._zIndex =
			hovered === undefined ? STROKE_DEFAULT_Z_INDEX : hovered ? STROKE_HOVER_Z_INDEX : STROKE_MUTED_Z_INDEX;
		this.drawNode(
			node.stroke!,
			node.shape!,
			node.fullRadius! - node.strokeCornerRadius! / 2,
			node.shapeRotation!,
			node.shapePoints!,
		).fill(strokeFill);
		node.stroke!.tint = strokeTint;

		if (node.strokeCornerRadius) {
			node.stroke!.stroke({
				color: strokeFill,
				width: node.strokeCornerRadius!,
				join: node.cornerType!,
			});
		}
	}

	drawNode(
		graphics: PIXI.Graphics,
		shape: NodeShapeType,
		size: number,
		rotation: number,
		points?: number,
	): PIXI.Graphics {
		if (shape === 'circle') {
			graphics.circle(0, 0, size);
		} else if (shape === 'polygon') {
			const angle = (Math.PI * 2) / points!;
			graphics.moveTo(size, 0);
			for (let i = 0; i < points!; i++) {
				graphics.lineTo(size * Math.cos(-angle * i), size * Math.sin(-angle * i));
			}
			graphics.closePath();

			// DEBUG: Render drawing order of the polygon vertices
			// graphics.circle(size, 0, 2);
			// for (let i = 0; i < points!; i++) {
			// 	graphics.circle(size * Math.cos(- angle * i), size * Math.sin(- angle * i), 2 + i / 4);
			// }
		} else if (shape === 'star') {
			graphics.moveTo(0, -size);
			for (let i = 0; i < 2 * points!; i++) {
				const angle = (Math.PI * 2 * i) / (2 * points!);
				const r = i % 2 === 0 ? size : size * STAR_LINE_DEPTH;
				graphics.lineTo(r * Math.sin(angle), -r * Math.cos(angle));
			}
			graphics.closePath();
		} else {
			console.error('[STARLIGHT-SITE-GRAPH] Invalid shape type: ' + shape);
		}
		graphics.rotation = rotation!;

		return graphics;
	}

	drawNodes(nodes: NodeData[]) {
		// Hoist hovered-node lookup outside the loop (O(N) once vs O(N²) per frame).
		// Needed for the bidirectional adjacency check below.
		const currentlyHovered = this.simulator.currentlyHovered;
		const hoveredNode = currentlyHovered ? nodes.find(n => n.id === currentlyHovered) : undefined;

		for (const node of nodes) {
			const hovered = currentlyHovered !== '' && node.id === currentlyHovered;
			let adjacent = false;
			if (!hovered && currentlyHovered !== '') {
				// Tag nodes store adjacency as ONLY the articles that link TO them, so
				// article.adjacent.has(tagId) is always false — the relationship is one-way
				// in the data. Checking BOTH directions (node→hovered AND hovered→node)
				// makes hover correctly reveal article labels when a tag is hovered.
				adjacent = node.adjacent.has(currentlyHovered)
					|| (hoveredNode?.adjacent.has(node.id) ?? false);
			}
			if (node.strokeWidth && node.strokeColor) {
				this.drawNodeStroke(node, hovered);
				node.stroke!.position.set(node.x!, node.y!);
			}
			this.drawNodeShape(node, hovered, adjacent);

			if (this.context.config.renderLabels && node.label) {
				// Stock zoom-driven label behavior (Quartz-style): every label's
				// alpha follows the animator's 'labelOpacity' value, which is
				// derived from the zoom level (simulator.getCurrentLabelOpacity).
				// Hovered/adjacent nodes get their hover/adjacent styling on top.
				this.updateLabel(node, hovered, adjacent);
				// Perf micro-opt: PIXI skips invisible objects entirely, so hide
				// fully transparent labels instead of rendering them at alpha 0.
				const labelVisible = node.label.alpha > 0.01 || hovered || adjacent;
				if (node.label.visible !== labelVisible) node.label.visible = labelVisible;
			}

			node.node!.position.set(node.x!, node.y!);
		}
	}

	/**
	 * No, this spa-hetti code took practically no time at all, why do you ask?
	 */
	getLinkOffset(node: NodeData, angle: number): [number, number] {
		let x = node.x!,
			y = node.y!,
			radius = node.fullRadius!;
		if (node.shape === 'circle') {
			const sin = Math.sin(angle),
				cos = Math.cos(angle);
			return [x - radius * cos, y - radius * sin];
		} else if (node.shape === 'polygon') {
			const points = node.shapePoints!;
			const segmentAngle = (2 * Math.PI) / points;

			angle += Math.PI - node.shapeRotation!;
			const segment = Math.floor(angle / segmentAngle);
			const t = (segmentAngle * (segment + 1) - angle) / segmentAngle;

			return [
				x +
					radius *
						(t * Math.cos(node.shapeRotation! + segment * segmentAngle) +
							(1 - t) * Math.cos(node.shapeRotation! + (segment + 1) * segmentAngle)),
				y +
					radius *
						(t * Math.sin(node.shapeRotation! + segment * segmentAngle) +
							(1 - t) * Math.sin(node.shapeRotation! + (segment + 1) * segmentAngle)),
			];
		} else if (node.shape === 'star') {
			const points = node.shapePoints!;
			const segmentAngle = Math.PI / points;
			let rotation = node.shapeRotation!;
			if (points & 1) {
				rotation += Math.PI / 2;
			} else if (points % 4 === 0) {
				rotation += segmentAngle;
			} else {
				rotation += 0;
			}

			angle += Math.PI - rotation;
			const segment = Math.floor(angle / segmentAngle);
			const t = (segmentAngle * (segment + 1) - angle) / segmentAngle;
			const r1 = radius * (segment & 1 ? STAR_LINE_DEPTH : 1);
			const r2 = radius * (segment & 1 ? 1 : STAR_LINE_DEPTH);

			return [
				x +
					(t * r2 * Math.cos(rotation + segment * segmentAngle) +
					(1 - t) * r1 * Math.cos(rotation + (segment + 1) * segmentAngle)),
				y +
					(t * r2 * Math.sin(rotation + segment * segmentAngle) +
					(1 - t) * r1 * Math.sin(rotation + (segment + 1) * segmentAngle)),
			];
		} else {
			console.error('[STARLIGHT-SITE-GRAPH] Invalid shape type: ' + node.shape);
			return [x, y];
		}
	}

	drawLink(link: LinkData, hovered: boolean) {
		const linkZoomLevel = this.context.config.scaleLinks ? this.context.animator.getValue('zoom') : 1;
		const incAngle = Math.atan2(link.target.y! - link.source.y!, link.target.x! - link.source.x!);
		const outAngle = Math.atan2(link.source.y! - link.target.y!, link.source.x! - link.target.x!);

		const [xStart, yStart] = this.getLinkOffset(link.source, outAngle);
		const [xEnd, yEnd] = this.getLinkOffset(link.target, incAngle);
		let width, color;
		if (hovered) {
			width = this.context.animator.getValue('linkWidthHover');
			color = this.context.animator.getValue('linkColorHover');
		} else {
			width = this.context.config.linkWidth;
			color = this.context.animator.getValue('linkColor');
		}

		this.linkGraphics.moveTo(xStart, yStart)
			 .lineTo(xEnd, yEnd)
			 .stroke({ width: width / linkZoomLevel, color: color });
		if (hovered) {
			this.linkHoverGraphics.moveTo(xStart, yStart)
				.lineTo(xEnd, yEnd)
				.stroke({ width: width / linkZoomLevel, color: color });
		}

		// DEBUG: Draw "correct" edge connection points (cf. circle positions, line should go straight through both)
		// layer.circle(...this.nodeCircleOffset({...link.source, shape: "circle"}, outAngle), 2).fill(0x00ff00)
		// layer.circle(...this.nodeCircleOffset({...link.target, shape: "circle"}, incAngle), 2).fill(0xff0000)

		if (this.context.config.renderArrows && this.simulator.zoomTransform.k > this.context.config.minZoomArrows) {
			this.drawArrowHead(xEnd, yEnd, width, incAngle, hovered);
		}
	}

	drawArrowHead(nodeX: number, nodeY: number, linkWidth: number, nodeAngle: number, hovered: boolean) {
		const arrowZoomLevel = this.context.config.scaleArrows ? this.context.animator.getValue('zoom') : 2;
		const x = nodeX;
		const y = nodeY;
		const arrowSize = (DEFAULT_ARROW_SCALE * (this.context.config.arrowSize + linkWidth)) / arrowZoomLevel;
		const xLeft = x - arrowSize * Math.cos(nodeAngle - this.context.config.arrowAngle),
			  yLeft = y - arrowSize * Math.sin(nodeAngle - this.context.config.arrowAngle);
		const xRight = x - arrowSize * Math.cos(nodeAngle + this.context.config.arrowAngle),
			  yRight = y - arrowSize * Math.sin(nodeAngle + this.context.config.arrowAngle);

		this.arrowGraphics
			.moveTo(x, y)
			.lineTo(xLeft, yLeft)
			.lineTo(xRight, yRight)
			.lineTo(x, y)
			.fill(this.context.animator.getValue('linkColor'));
		if (hovered) {
			this.arrowHoverGraphics.moveTo(x, y)
				.lineTo(xLeft, yLeft)
				.lineTo(xRight, yRight)
				.lineTo(x, y)
				.fill(this.context.animator.getValue('linkColorHover'));
		}
	}

	drawLinks(links: LinkData[]) {
		const hovered = this.simulator.currentlyHovered !== '';

		this.linkGraphics.clear().zIndex = hovered ? LINK_MUTED_Z_INDEX : LINK_DEFAULT_Z_INDEX;
		this.linkHoverGraphics.clear();
		this.arrowGraphics.clear().zIndex = hovered ? ARROW_MUTED_Z_INDEX : ARROW_DEFAULT_Z_INDEX;
		this.arrowHoverGraphics.clear();

		for (const link of links) {
			this.drawLink(link, hovered &&
				(link.source.id === this.simulator.currentlyHovered ||
				 link.target.id === this.simulator.currentlyHovered));
		}
	}

	createLabel(node: NodeData) {
		node.label = new PIXI.Text({
			text: node.text || node.id,
			style: {
				fill: 0xffffff,
				fontSize: this.context.config.labelFontSize,
			},
			// Render text textures at 4× regardless of the renderer resolution.
			// The renderer canvas is kept at 2× for GPU performance (shapes, links),
			// but PIXI.Text is a rasterized sprite — the higher its texture DPR, the
			// crisper it stays when zoomed or on HiDPI screens. Text label textures
			// are small so 4× adds negligible memory overhead.
			resolution: 4,
			zIndex: LABEL_DEFAULT_Z_INDEX,
		});
		node.label.anchor.set(0.5, 0.5);
		node.label.alpha = this.context.animator.getValue('labelOpacity');
	}

	updateLabel(node: NodeData, hovered?: boolean, adjacent?: boolean) {
		// Counter-scale labels by 1/k (Quartz) so text stays a constant SCREEN size
		// while the stage zooms — otherwise zooming the global graph blows the
		// labels up into an unreadable wall of world-scaled text.
		const invZoom = 1 / this.simulator.zoomTransform.k;
		let labelOffset, labelOpacity, labelColor, labelScale;
		if (hovered) {
			labelOffset = this.context.animator.getValue('labelOffset');
			labelOpacity = this.context.animator.getValue('labelOpacityHover');
			labelColor = this.context.animator.getValue('labelColorHover');
			labelScale = this.context.animator.getValue('labelScaleHover') * invZoom;
		} else {
			labelOffset = this.context.config.labelOffset;
			// While a hover is active the animator drives label opacity (upstream
			// behavior — non-adjacent labels fade to labelMutedOpacity, adjacent to
			// labelAdjacentOpacity; hover renders every frame so tweens complete).
			// At REST the baseline comes straight from the zoom formula, NOT the
			// animator: the dirty-flag render loop stops once the simulation settles,
			// which freezes animator tweens mid-flight (labels stranded at e.g. 0.099
			// instead of 0 — a grey smear over 1200 nodes).
			labelOpacity = adjacent
				? this.context.animator.getValue('labelOpacityAdjacent')
				: this.simulator.currentlyHovered !== ''
					? this.context.animator.getValue('labelOpacity')
					: Math.min(1, this.simulator.getCurrentLabelOpacity(this.simulator.zoomTransform.k));
			labelColor = this.context.animator.getValue('labelColor');
			labelScale = invZoom;
		}

		node.label!.scale.set(labelScale);
		node.label!.position.set(node.x!, node.y! + node.fullRadius! + labelOffset);
		node.label!.alpha = labelOpacity;
		node.label!.tint = labelColor;
	}
}
