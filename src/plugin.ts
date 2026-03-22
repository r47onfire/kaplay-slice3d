import type {
    AnchorComp,
    BlendComp,
    Color,
    ColorComp,
    Comp,
    GameObj,
    KAPLAYCtx,
    OpacityComp,
    OutlineComp,
    ShaderComp,
    Shape,
    SpriteComp,
    SpriteCompOpt,
    Vec2,
    ZComp
} from "kaplay";

type SpriteID = Parameters<KAPLAYCtx["sprite"]>[0];

export interface Camera3D {
    /**
     * The distance of the camera from the screen, in world space units. The FOV of the camera is implicitly calculated from
     * the z value, such that stuff at z=0 undergoes no transformation regardless of the camera position.
     * Thus, moving the camera along the Z-axis performs a dolly zoom ("Psycho") effect.
     *
     * The Z-value is also absolute, whereas the XY-values are an offset from the KAPLAY camera position.
     */
    z: number;
    offset: Vec2,
    /**
     * The z-distance that will result in the sprite completely fading into the fade color or the fade opacity.
     */
    fade: number;
    fadeColor?: Color,
    fadeOpacity?: number,
}

export interface KAPLAYSlice3DPlugin {
    camera3d: Camera3D;
    sprite(id: SpriteID, opt: Sprite3DCompOpt): Sprite3DComp;
    stack3d(layers: SpriteLayer[]): Stacked3DComp;
    set3DEnabled(enabled: boolean): void;
    is3DEnabled(): boolean;
}

export interface Sprite3DCompOpt extends SpriteCompOpt {
    hiddenSides?: number;
    useDepth?: boolean;
    hideWhenDepthDisabled?: boolean;
}

export interface Sprite3DComp extends SpriteComp {
    hiddenSides: number;
    useDepth: boolean;
    hideWhenDepthDisabled: boolean;
}

export interface Stacked3DComp extends Comp {
    renderArea(): Shape;
}

export enum Neighbor {
    Top = 1,
    TopRight = 2,
    Right = 4,
    BottomRight = 8,
    Bottom = 16,
    BottomLeft = 32,
    Left = 64,
    TopLeft = 128,
}


export interface SpriteLayer {
    dz: number,
    offset?: Vec2;
    sprite: SpriteID,
    opt?: Omit<Sprite3DCompOpt, "useDepth" | "hideWhenDepthDisabled">,
}

export default function slice3d(K: KAPLAYCtx & KAPLAYSlice3DPlugin): KAPLAYSlice3DPlugin {
    const {
        pos,
        sprite,
        color,
        opacity,
        blend,
        anchor,
        shader,
        z,
        vec2,
        getCamPos,
        width,
        height,
        anchorToVec2,
        pushTranslate,
        pushScale,
        mapc,
        getBackground,
        BLACK,
        Vec2,
    } = K;

    var depthEnabled = true;

    const camera3d: Camera3D = {
        offset: vec2(),
        z: 128,
        fade: 128,
    };

    const scratchPt = vec2();
    const worldCamPosToScratch = () => {
        Vec2.add(camera3d.offset, getCamPos(), scratchPt);
    };
    const projectIntoScratch = (x: number, y: number, z: number) => {
        worldCamPosToScratch();
        const scaleFactor = camera3d.z / (camera3d.z - z);
        scratchPt.x = scratchPt.x + (x - scratchPt.x) * scaleFactor;
        scratchPt.y = scratchPt.y + (y - scratchPt.y) * scaleFactor;
    };
    const allSet = (x: number, mask: number) => (x & mask) === mask;
    const shouldCull = (left: number, right: number, top: number, bottom: number, sides: number) => {
        const screenTop = getCamPos().y - height() / 2;
        const screenBottom = screenTop + height();
        const screenLeft = getCamPos().x - width() / 2;
        const screenRight = screenLeft + width();
        if (right < screenLeft || left > screenRight || bottom < screenTop || top > screenBottom) return true;
        worldCamPosToScratch();
        const { x, y } = scratchPt;
        switch ((x < left ? 0 : x <= right ? 1 : 2) + (y < top ? 0 : y <= bottom ? 3 : 6)) {
            case 0: return allSet(sides, Neighbor.Top | Neighbor.TopLeft | Neighbor.Left); // top-left
            case 1: return allSet(sides, Neighbor.TopLeft | Neighbor.Top | Neighbor.TopRight); // bottom-right
            case 2: return allSet(sides, Neighbor.Top | Neighbor.TopRight | Neighbor.Right); // top-right
            case 3: return allSet(sides, Neighbor.BottomLeft | Neighbor.Left | Neighbor.TopLeft); // left
            case 4: return allSet(sides, Neighbor.Top | Neighbor.TopRight | Neighbor.Right | Neighbor.BottomRight | Neighbor.Bottom | Neighbor.Bottom | Neighbor.BottomLeft | Neighbor.Left); // center
            case 5: return allSet(sides, Neighbor.TopRight | Neighbor.Right | Neighbor.BottomRight); // right
            case 6: return allSet(sides, Neighbor.Right | Neighbor.BottomRight | Neighbor.Bottom); // bottom-left
            case 7: return allSet(sides, Neighbor.BottomRight | Neighbor.Bottom | Neighbor.BottomLeft); // bottom
            case 8: return allSet(sides, Neighbor.Bottom | Neighbor.BottomLeft | Neighbor.Left); // bottom-right
        }
    };
    return {
        camera3d,
        sprite(spriteID, opt = {}) {
            const comp = sprite(spriteID, opt) as Sprite3DComp;
            comp.hiddenSides = opt.hiddenSides ?? 0;
            comp.useDepth = opt.useDepth ?? false;
            comp.hideWhenDepthDisabled = opt.hideWhenDepthDisabled ?? false;

            const oldDraw = comp.draw!;
            comp.draw = function (this: GameObj<Sprite3DComp | AnchorComp | Partial<ZComp> | Partial<ColorComp> | Partial<OpacityComp>>) {
                if (this.hideWhenDepthDisabled && !depthEnabled) return;
                var tx = 0, ty = 0, sx = 1, sy = 1;
                var or = 1, og = 1, ob = 1, oc: Color | undefined;
                var oo = 1;
                if (this.useDepth && depthEnabled) {
                    const z = this.z ?? 0;
                    if (z > camera3d.z) return;
                    if (this.opacity && z < -camera3d.fade) return;
                    // calculate world bounding box (fast)
                    scratchPt.x = this.width;
                    scratchPt.y = this.height;
                    this.transform.transformVectorV(scratchPt, scratchPt);
                    const worldWidth = scratchPt.x;
                    const worldHeight = scratchPt.y;
                    const worldX = this.transform.e;
                    const worldY = this.transform.f;
                    const { x: anchorX, y: anchorY } = anchorToVec2(this.anchor ?? "topleft");
                    const offsetX = -(anchorX + 1) * worldWidth / 2;
                    const offsetY = -(anchorY + 1) * worldHeight / 2;
                    const left = worldX + offsetX;
                    const right = left + worldWidth;
                    const top = worldY + offsetY;
                    const bottom = top + worldHeight;
                    projectIntoScratch(left, top, z);
                    const projectedLeft = scratchPt.x;
                    const projectedTop = scratchPt.y;
                    projectIntoScratch(right, bottom, z);
                    const projectedRight = scratchPt.x;
                    const projectedBottom = scratchPt.y;

                    // Determine culling
                    if (shouldCull(projectedLeft, projectedRight, projectedTop, projectedBottom, this.hiddenSides)) return;

                    // Calculate scales and stuff
                    sx = (projectedRight - projectedLeft) / worldWidth;
                    sy = (projectedBottom - projectedTop) / worldHeight;
                    projectIntoScratch(worldX, worldY, z);
                    tx = scratchPt.x - worldX;
                    ty = scratchPt.y - worldY;

                    // Perform transformation and darkening
                    scratchPt.set(tx, ty);
                    pushTranslate(scratchPt);
                    scratchPt.set(sx, sy);
                    pushScale(scratchPt);

                    if (this.color) {
                        oc = this.color!;
                        const camFadeColor = camera3d.fadeColor ?? getBackground() ?? BLACK;
                        oc.r = mapc(z, 0, -camera3d.fade, or = oc.r, camFadeColor.r);
                        oc.g = mapc(z, 0, -camera3d.fade, og = oc.g, camFadeColor.g);
                        oc.b = mapc(z, 0, -camera3d.fade, ob = oc.b, camFadeColor.b);
                    }
                    if (this.opacity) {
                        this.opacity = mapc(z, 0, -camera3d.fade, oo = this.opacity, oo * (camera3d.fadeOpacity ?? 0));
                    }
                }

                oldDraw.call(this);

                if (this.useDepth && depthEnabled) {
                    // Perform inverse transformation and un-darkening
                    scratchPt.set(1 / sx, 1 / sy);
                    pushScale(scratchPt);
                    scratchPt.set(-tx, -ty);
                    pushTranslate(scratchPt);
                    if (oc) {
                        oc.r = or;
                        oc.g = og;
                        oc.b = ob;
                    }
                    if (oo) {
                        this.opacity = oo;
                    }
                }
            }
            return comp;
        },
        stack3d(layers) {
            if (layers.length === 0) {
                throw new Error("Need at least 1 layer to stack3d");
            }
            type Everything = Stacked3DComp | ColorComp | OpacityComp | BlendComp | AnchorComp | ShaderComp | OutlineComp | ZComp;
            const myLayerObjects: GameObj[] = [];
            const comp: Everything = {
                id: "stack3d",
                add(this: GameObj<Everything>) {
                    this.z ??= 0;
                    var first = true;
                    for (var layer of layers) {
                        const obj = this.add([
                            pos(layer.offset ?? vec2()),
                            K.sprite(layer.sprite, { ...layer.opt, useDepth: true, hideWhenDepthDisabled: !first && layers.length > 0 }),
                            z(this.z + layer.dz),
                            {
                                outline: this.outline,
                                __dz: layer.dz,
                            },
                            "stack3d-layer"
                        ]);
                        myLayerObjects.push(obj);
                        if (this.color) obj.use(color(this.color));
                        if (this.opacity) obj.use(opacity(this.opacity));
                        if (this.blend) obj.use(blend(this.blend));
                        if (this.anchor) obj.use(anchor(this.anchor));
                        if (this.shader) obj.use(shader(this.shader, this.uniform));
                        first = false;
                    }
                    for (var prop of ["opacity", "blend", "anchor", "shader", "uniform", "outline"]) {
                        watch(this, prop, updateValue.bind(this, prop));
                    }
                },
                draw(this: GameObj<Everything>) {
                    myLayerObjects.forEach(child => child.z = child.__dz + this.z);
                },
                update(this: GameObj<Everything>) {
                    myLayerObjects.forEach(child => child.z = child.__dz + this.z);
                },
                destroy() {
                    myLayerObjects.forEach(e => e.destroy());
                },
                renderArea() {
                    return myLayerObjects[0]!.renderArea();
                }
            };
            return comp;
        },
        set3DEnabled(enabled) {
            depthEnabled = enabled;
        },
        is3DEnabled() {
            return depthEnabled;
        },
    };
}

function watch(obj: GameObj, propName: string, onChangeCB: () => void) {
    const oldDescriptor = Object.getOwnPropertyDescriptor(obj, propName);
    if (oldDescriptor) {
        Object.defineProperty(obj, propName, {
            get() {
                return oldDescriptor.get?.() ?? oldDescriptor.value;
            },
            set(v) {
                if (oldDescriptor.set) oldDescriptor.set(v);
                else oldDescriptor.value = v;
                onChangeCB();
            },
        });
    } else {
        var value = obj[propName];
        Object.defineProperty(obj, propName, {
            get() {
                return value;
            },
            set(v) {
                value = v;
                onChangeCB();
            },
        });
    }
};

function updateValue(this: GameObj<Stacked3DComp>, key: string) {
    for (var child of this.children) {
        child[key] = (this as any)[key];
    }
}
