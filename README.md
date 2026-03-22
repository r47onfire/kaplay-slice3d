# KAPLAY Pseudo-3D Plugin

Easily add a fake depth effect to your 2D platformer or top-down games made with [KAPLAY.js](https://v4000.kaplayjs.com).

(Designed for platformers; top-down requires some amount of kludgery to work.)

## Installation

```sh
pnpm add @r47onfire/kaplay-slice3d
```

Then in your kaplay options:

```js
import kaplay from "kaplay";
import slice3d from "@r47onfire/kaplay-slice3d";
// ...other imports...

const K = kaplay({
    // ...other options...
    plugins: [
        // ...other plugins...
        slice3d
    ]
});
```

## Usage

### New functions

* `set3DEnabled(x)` and `is3DEnabled()` - set or get the state of 3D depth rendering. You can expose this as a setting in your game, if the player wants to turn it off.

#### Sprite component (monkeypatched from vanilla)

* New option: `useDepth`. Set this to true and the sprite will become affected by its z-value, and render with depth.
* New option: `hideWhenDepthDisabled`. Set this to true, and the sprite will skip rendering, if the 3D effect is disabled with `set3DEnabled(false)`.

#### Stack3D component (`stack3D(layers)`)

This is a simple helper component that creates (as children) a bunch of stacked sprites, in order to build a "block" that is rendered as the stack of slices.

The `layers` argument is a list of objects:

* `sprite` and `opt` - these get passed to the `sprite` component (which is the patched one above, not the vanilla `sprite`).
* `dz` (default 0) - the z-offset of the layer, which is relative to the parent's z value and will be updated as well if the parent's is changed.
* `offset` (default `vec2(0, 0)`) - the position offset of the layer origin relative to the parent.

### New objects

* `camera3d` - Controls the 3D perspective rendering depth. The camera is positioned to face directly towards the screen and cannot be rotated, however, it can be moved.
    * `camera3d.offset` - the x/y offset relative to the KAPLAY camera (`getCamPos()` and `setCamPos()`) to use when calculating the perspective warp.
    * `camera3d.z` - the z-value, or how far the camera is from the screen plane. The FOV of the camera is controlled by this, and is implicitly defined as such that stuff at z=0 will be rendered in the exact same position and scale as they would without this plugin.
    * `camera3d.fade` - controls background fog. This is the negative z-distance that will get 100% fog, with z=0 being no fog.
    * `camera3d.fadeColor` - the color that objects' `color` value is lerp'ed towards based on the amount of fog they are affected by. If the object doesn't have the `color()` component, it won't be affected by this.
    * `camera3d.fadeOpacity` - the amount by which to reduce the object's `opacity` value by based on the amount of fog they are affected by. (This will never increase the amount of opacity, unless you set this to something greater than 1.) If the object doesn't have the `opacity()` component, it won't be affected by this.

## More coming soon... <!-- -->
