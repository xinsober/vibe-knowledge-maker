// 登记所有合成：Film（正片）、Gallery（镜头库样片）、三张封面。
import React from 'react';
import {Composition, Still} from 'remotion';
import {FilmShell} from './engine/Film';
import {LookName} from './engine/look';
import {build} from './engine/timeline';
import {FILM} from './film/film';
import {SCRIPT} from './film/script';
import {SCENES} from './film/scenes';
import {Cover} from './film/Cover';
import {GALLERY, GALLERY_SCENES} from './gallery';

const tl = build(SCRIPT);
const gtl = build(GALLERY);

type P = {qa?: boolean; withAudio?: boolean; look?: LookName};

export const Root: React.FC = () => (
  <>
    <Composition
      id="Film"
      component={(p: P) => <FilmShell tl={tl} config={FILM} scenes={SCENES} qa={p.qa} withAudio={p.withAudio} lookOverride={p.look} />}
      durationInFrames={tl.total}
      fps={30}
      width={1920}
      height={1080}
      defaultProps={{qa: false, withAudio: false} as P}
    />
    <Composition
      id="Gallery"
      component={(p: P) => (
        <FilmShell tl={gtl} config={{title: '镜头库', look: p.look ?? 'ink'}} scenes={GALLERY_SCENES} qa={p.qa} lookOverride={p.look} />
      )}
      durationInFrames={gtl.total}
      fps={30}
      width={1920}
      height={1080}
      defaultProps={{qa: false} as P}
    />
    <Still id="Cover-16x9" component={() => <Cover w={1920} h={1080} />} width={1920} height={1080} />
    <Still id="Cover-4x3" component={() => <Cover w={1440} h={1080} />} width={1440} height={1080} />
    <Still id="Cover-3x4" component={() => <Cover w={1080} h={1440} />} width={1080} height={1440} />
  </>
);
