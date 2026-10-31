// 登记场景：剧本里的 id → 场景组件
import {SceneComponent} from '../../engine/Film';
import {Fling, Straight} from './Bend';
import {Dive} from './Dive';
import {Grow} from './Grow';
import {Section} from './Section';
import {Window} from './Window';

export const SCENES: Record<string, SceneComponent> = {Dive, Straight, Fling, Section, Grow, Window};
