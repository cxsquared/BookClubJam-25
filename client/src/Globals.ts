import { TextBox } from './ui/text-box.ui';

export const DECOR_KEYS = [
    'heart_01',
    'eye_01',
    'cac_01',
    'star_01',
    'paw_01',
    'board_01',
    'board_02',
    'rainbow_01',
    'cat_01',
    'face_01',
    'leaf_01',
];

export function randomDecorKey(): string {
    const key = DECOR_KEYS[Math.floor(Math.random() * DECOR_KEYS.length)];
    if (key === undefined) return 'test';
    return key;
}

export function isTextDecor(decorKey: string) {
    return decorKey.startsWith('board');
}

export function preLoadText(currentDoorNumber: number) {
    if (currentDoorNumber <= 1) return;

    let firstLine = true;

    for (let i = 1; i < currentDoorNumber; i++) {
        const texts = getDialogue(i);
        if (texts.length > 0) {
            for (const t of texts) {
                if (firstLine) {
                    TextBox.preloadText = t;
                    firstLine = false;
                } else {
                    TextBox.preloadText = TextBox.preloadText + '\n' + t;
                }
            }
        }
    }
}

export function getDialogue(doorNumber: number): string[] {
    switch (doorNumber) {
        case 2:
            return ["Uhh Mom didn't say anything about a second door?"];
        case 3:
            return ['I should go find mom', '...Only one way to go now...'];
        case 10:
            return ['Why do I keep moving forward...'];
        case 17:
            return ['What is this feeling?', 'I feel...good?'];
        case 18:
            return ['Maybe I should stop here'];
        case 19:
            return ["What's the point ..."];
        default:
            return [];
    }
}
