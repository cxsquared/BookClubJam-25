import { Assets, Container, Sprite } from 'pixi.js';
import '@pixi/layout';
import { LayoutContainer, LayoutSprite, ScrollSpring } from '@pixi/layout/components';
import { designConfig } from '../game/designConfig';
import { InventoryComponent } from '../game/components/inventory.component';

const smallDecor = ['heart_01', 'eye_01', 'cac_01', 'star_01', 'paw_01', 'cat_01', 'face_01', 'leaf_01'];

const largeDecor = ['board_01', 'board_02', 'rainbow_01', 'shroom_01'];

const gridCellWidth = 100;
const gridCellHeight = 70;

export class InventoryUi extends Container {
    private decorToGrid: Map<string, { isSmall: boolean; x?: number; y: number }>;
    readonly decorGrid: Sprite[][];
    readonly onClick: (key: string, x: number, y: number) => void;

    constructor(onClick: (key: string, x: number, y: number) => void) {
        super({
            layout: true,
        });

        this.onClick = onClick;

        const bg = Sprite.from('decor_bg');
        bg.y = 20;
        this.addChild(bg);

        const layout = new LayoutContainer({
            layout: {
                width: bg.width,
                height: bg.height - 12,
                flexWrap: 'wrap',
                justifyContent: 'center',
                objectFit: 'contain',
                alignContent: 'center',
                overflow: 'scroll',
            },
            trackpad: {
                // Maximum scrolling speed (pixels per frame)
                maxSpeed: 400,

                // Constrain scrolling within bounds
                constrain: true,

                // Disable momentum/easing when releasing
                disableEasing: false,

                // Custom easing for x/y axes
                xEase: new ScrollSpring({
                    max: 200, // Maximum velocity
                    damp: 0.7, // Higher damping = less bounce
                    springiness: 0.15, // Higher springiness = faster movement
                }),
            },
        });

        layout.y = 26;

        this.addChild(layout);

        // fuck if I know why I need this but the scroll does weird things
        const totalDecorRows = largeDecor.length + Math.ceil(smallDecor.length / 2);
        const padSprite = new Sprite({
            layout: {
                width: gridCellWidth * 2,
                height: gridCellHeight * (totalDecorRows - 8),
            },
        });

        layout.addChild(padSprite);

        this.decorGrid = [];
        this.decorToGrid = new Map<string, { isSmall: boolean; x?: number; y: number }>();

        let x = 0;
        let y = 0;
        for (const key of smallDecor) {
            const sprite = new LayoutSprite({
                texture: Assets.get(key),
                layout: true,
            });
            sprite.alpha = 0.5;
            layout.addChild(sprite);
            sprite.layout = {
                width: gridCellWidth,
                height: gridCellHeight,
                objectFit: 'none',
            };
            sprite.interactive = true;
            sprite.on('pointerdown', (e) => {
                this.onClick(key, e.screenX, e.screenY);
            });

            this.decorToGrid.set(key, { isSmall: true, x, y });
            if (this.decorGrid[y] == undefined) {
                this.decorGrid[y] = [];
            }

            this.decorGrid[y][x] = sprite;

            x++;
            if (x % 2 == 0) {
                x = 0;
                y++;
            }
        }

        if (x != 0) {
            x = 0;
            y++;
        }

        for (const key of largeDecor) {
            const sprite = new LayoutSprite({
                texture: Assets.get(key),
                layout: true,
            });
            sprite.layout = {
                width: gridCellWidth * 2,
                height: gridCellHeight,
                objectFit: 'none',
            };
            layout.addChild(sprite);
            sprite.interactive = true;
            sprite.on('pointerdown', (e) => {
                this.onClick(key, e.screenX, e.screenY);
            });
            sprite.alpha = 0.5;

            this.decorToGrid.set(key, { isSmall: false, y });
            if (this.decorGrid[y] == undefined) {
                this.decorGrid[y] = [];
            }

            this.decorGrid[y][x] = sprite;
            y++;
        }
    }

    public getItemPosition(key: string): { x: number; y: number } {
        const gridInfo = this.decorToGrid.get(key);

        const defaultReturn = { x: this.width / 2, y: designConfig.content.height / 2 };

        if (gridInfo === undefined) return defaultReturn;

        const { x, y } = gridInfo;

        const sprite = x !== undefined ? this.decorGrid[y][x] : this.decorGrid[y][0];

        if (!sprite) return defaultReturn;

        return { x: sprite.layout?.realX ?? defaultReturn.x, y: sprite.layout?.realY ?? defaultReturn.y };
    }

    public update(inventory: InventoryComponent) {
        const hasInventoryKeys: Set<string> = inventory.inventory.reduce<Set<string>>((acc, inventoryItem) => {
            if (!acc.has(inventoryItem.decorKey)) {
                acc.add(inventoryItem.decorKey);
            }

            return acc;
        }, new Set<string>());

        for (const key of this.decorToGrid.keys()) {
            const gridInfo = this.decorToGrid.get(key);

            if (gridInfo === undefined) continue;

            const { x, y } = gridInfo;

            const sprite = x !== undefined ? this.decorGrid[y][x] : this.decorGrid[y][0];

            if (!sprite) continue;

            if (hasInventoryKeys.has(key)) {
                sprite.alpha = 1;
                sprite.interactive = true;
            } else {
                sprite.alpha = 0.25;
                sprite.interactive = false;
            }
        }
    }
}
