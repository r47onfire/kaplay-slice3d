import { crew } from "@kaplayjs/crew";
import kaplay, { BodyComp, GameObj, PosComp } from "kaplay";
import slice3d from "../src/plugin";

const K = kaplay({
    plugins: [slice3d, crew],
    pixelDensity: Math.min(devicePixelRatio, 2),
    global: false,
    buttons: { jump: { keyboard: "space", gamepad: "south" } }
});

K.setBackground(K.BLACK);
K.loadCrew("sprite", "bean");
K.loadCrew("sprite", "steel");
K.loadCrew("sprite", "grass");
K.loadCrew("sprite", "coin");
K.loadCrew("sprite", "mark");

function setupPlayer(player: GameObj<BodyComp | PosComp>, jumping: boolean) {
    player.onUpdate(() => {
        const s = K.getLastInputDeviceType() === "gamepad" ? K.getGamepadStick("left") : K.Vec2.ZERO;
        player.move(
            300 * (-(K.isKeyDown("left") || K.isKeyDown("a")) + +(K.isKeyDown("right") || K.isKeyDown("d")) + s.x),
            jumping ? 0 : 300 * (-(K.isKeyDown("up") || K.isKeyDown("w")) + +(K.isKeyDown("down") || K.isKeyDown("s")) + s.y),
        );
        K.setCamPos(K.lerp(K.getCamPos(), player.pos, K.dt() * 5));
    });
    if (jumping) {
        player.onButtonPress("jump", () => player.isGrounded() && player.jump());
    }
}

function controls() {
    K.add([
        K.fixed(),
        K.pos(12, 12),
        K.text("Press 1 for top-down, 2 for platformer\nPress 3 to toggle fake 3D"),
        K.z(Infinity),
    ]);
    K.onKeyPress("1", () => K.go("faketopdown"));
    K.onKeyPress("2", () => K.go("platformer"));
    K.onKeyPress("3", () => K.set3DEnabled(!K.is3DEnabled()));
}

K.scene("faketopdown", () => {

    const layers = [
        [
            "#####################",
            "#####################",
            "#####################",
            "#####################",
            "#####################",
            "#####################",
            "#####################",
            "#####################",
            "#####################",
            "#####################",
            "#####################",
            "#####################",
            "#####################",
            "#####################",
            "#####################",
            "#####################",
            "#####################",
            "#####################",
            "#####################",
            "#####################",
            "#####################",
        ],
        [
            "@@@@@@@@@@@@@@@@@@@@@",
            "@                   @",
            "@        m          @",
            "@                   @",
            "@     $             @",
            "@                   @",
            "@             $     @",
            "@                   @",
            "@                   @",
            "@                   @",
            "@         b         @",
            "@                   @",
            "@                   @",
            "@     $        $    @",
            "@                   @",
            "@                   @",
            "@           $       @",
            "@                   @",
            "@                   @",
            "@                   @",
            "@@@@@@@@@@@@@@@@@@@@@",
        ],
    ]

    for (var i = 0; i < layers.length; i++) {
        const offset = -64 * i;
        K.addLevel(layers[i], {
            tileWidth: 64,
            tileHeight: 64,
            tiles: {
                "#": () => [
                    K.stack3d([
                        {
                            dz: 0,
                            sprite: "grass",
                            opt: { hiddenSides: 255 }
                        },
                        ...new Array(9).fill(0).map((_, i) => ({
                            offset: K.vec2(0, offset + i * 8),
                            dz: i * 8 - 16,
                            sprite: "grass"
                        })),
                    ]),
                    K.anchor("center"),
                    K.color(K.WHITE),
                    K.opacity(1),
                    "depth",
                ],
                "@": () => [
                    K.stack3d([
                        {
                            dz: 0,
                            sprite: "steel",
                            opt: { hiddenSides: 255 }
                        },
                        ...new Array(9).fill(0).map((_, i) => ({
                            offset: K.vec2(0, offset + i * 8),
                            dz: i * 8 - 16,
                            sprite: "steel"
                        })),
                    ]),
                    K.anchor("center"),
                    K.color(K.WHITE),
                    K.opacity(1),
                    K.area(),
                    K.body({ isStatic: true }),
                    "depth",
                ],
                $: () => [
                    K.stack3d([
                        {
                            dz: 50,
                            sprite: "coin",
                            opt: { hiddenSides: 255 }
                        },
                        {
                            offset: K.vec2(0, offset),
                            dz: 0,
                            sprite: "coin",
                        }
                    ]),
                    K.anchor("center"),
                    K.color(K.WHITE),
                    K.opacity(1),
                    K.area(),
                    "depth",
                ],
                b: () => [
                    K.stack3d([
                        {
                            dz: 60,
                            sprite: "bean",
                            opt: { hiddenSides: 255 }
                        },
                        {
                            offset: K.vec2(0, offset),
                            dz: 0,
                            sprite: "bean",
                        }
                    ]),
                    K.anchor("center"),
                    K.area(),
                    K.body(),
                    "player",
                    "depth",
                ],
                m: () => [
                    K.stack3d([
                        {
                            dz: 60,
                            sprite: "mark",
                            opt: { hiddenSides: 255 }
                        },
                        {
                            offset: K.vec2(0, offset),
                            dz: 0,
                            sprite: "mark",
                        },
                    ]),
                    K.anchor("center"),
                    K.area(),
                    K.body(),
                    "depth",
                ]
            }
        });
    }

    setupPlayer(K.get<BodyComp | PosComp>("player", { recursive: true })[0], false);

    K.setGravity(0);
    K.onDraw("depth", obj => obj.z = obj.pos.y - K.getCamPos().y);

    K.camera3d.z = 512;
    K.camera3d.fade = 512;
    K.camera3d.offset = K.vec2();

    controls();

});

K.scene("platformer", () => {
    K.addLevel([
        "########################",
        "#                      #",
        "#       $$$$$$         #",
        "#       #####@@   m    #",
        "#                @@    #",
        "#            @@        #",
        "#                ##    #",
        "#               @      #",
        "#            @@@@@     #",
        "#    $$  @@            #",
        "# b  ##                #",
        "########################"
    ], {
        tileWidth: 64,
        tileHeight: 64,
        tiles: {
            "#": () => [
                K.stack3d(new Array(9).fill(0).map((_, i) => ({
                    dz: 4 * i - 16,
                    sprite: "grass",
                }))),
                K.anchor("center"),
                K.color(K.WHITE),
                K.opacity(1),
                K.area(),
                K.body({ isStatic: true }),
            ],
            "@": () => [
                K.stack3d(new Array(5).fill(0).map((_, i) => ({
                    dz: 4 * i - 16,
                    sprite: "steel",
                }))),
                K.anchor("center"),
                K.color(K.WHITE),
                K.opacity(1),
                K.area(),
                K.body({ isStatic: true }),
                K.platformEffector({ ignoreSides: [K.LEFT, K.RIGHT, K.UP] })
            ],
            $: () => [
                K.sprite("coin"),
                K.anchor("center"),
                K.color(K.WHITE),
                K.opacity(1),
                K.area(),
            ],
            b: () => [
                K.sprite("bean"),
                K.anchor("center"),
                K.area(),
                K.body(),
                "player",
            ],
            m: () => [
                K.sprite("mark"),
                K.anchor("center"),
                K.area(),
                K.body(),
            ]
        }
    });

    setupPlayer(K.get<BodyComp | PosComp>("player", { recursive: true })[0], true);

    K.setGravity(2000);

    K.camera3d.z = 128;
    K.camera3d.fade = 20;
    K.camera3d.offset = K.vec2(0, -120);

    controls();
});

K.go("platformer");
