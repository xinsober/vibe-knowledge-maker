import React from 'react';
import {useScene} from '../engine/Film';
import {useLook} from '../engine/look';
import {CLOTH, Figure, HAIR, Mood, Pose, SKIN} from '../pieces/Figure';

const MOODS: Mood[] = ['neutral', 'happy', 'surprised', 'worried', 'sad', 'angry', 'thinking'];
const NAMES = ['平静', '高兴', '惊讶', '担心', '难过', '生气', '在想'];
const POSES: Pose[] = ['wave', 'point', 'raise', 'hips', 'think', 'shrug', 'cross'];

// 人：一排人，先看表情（近景），再看姿势
export const FigureDemo: React.FC = () => {
  const L = useLook();
  const {f, cue} = useScene();
  const second = f >= cue(1);
  return (
    <>
      {MOODS.map((m, i) => (
        <React.Fragment key={i}>
          <Figure
            x={250 + i * 240}
            y={second ? 830 : 1290}
            h={second ? 500 : 1000}
            f={f}
            seed={i + 2}
            mood={m}
            pose={second ? POSES[i] : 'down'}
            from="down"
            poseT={second ? (f - cue(1)) / 24 : 1}
            facing={second && i === 1 ? 'back' : i === 3 ? 'left' : i === 5 ? 'right' : 'front'}
            skin={SKIN[i % 4]}
            hair={(['short', 'long', 'bob', 'side', 'bun', 'curly', 'short'] as const)[i]}
            hairColor={HAIR[i % HAIR.length]}
            top={CLOTH[i]}
          />
          {!second && (
            <div style={{position: 'absolute', left: 250 + i * 240, top: 560, transform: 'translateX(-50%)', fontFamily: L.font.label, fontSize: 34, color: '#FFFFFF', fontWeight: 700, textShadow: '0 2px 8px rgba(0,0,0,0.7)'}}>
              {NAMES[i]}
            </div>
          )}
        </React.Fragment>
      ))}
    </>
  );
};
