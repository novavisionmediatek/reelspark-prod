import { useEffect, useRef } from 'react';
import { StyleSheet, View, type StyleProp, type ViewStyle } from 'react-native';
import { youtubeEmbedHtml } from './youtubeEmbedHtml';
import {
  INSTAGRAM_EXTRA_HEIGHT_PX,
  INSTAGRAM_HEADER_PX,
  INSTAGRAM_MASK_BOTTOM_HEIGHT_PX,
  INSTAGRAM_MASK_BOTTOM_OPAQUE_PX,
  INSTAGRAM_MASK_TOP_HEIGHT_PX,
  INSTAGRAM_MASK_TOP_OPAQUE_PX,
  INSTAGRAM_SCALE,
  instagramReelEmbedSrc,
} from './instagramEmbedHtml';

export interface VideoPlayerProps {
  platform: 'youtube' | 'instagram';
  videoId: string;
  // Whether the player should be mounted at all (the reel is scrolled into
  // view). YouTube mounts cued-but-paused as soon as this is true — well
  // before the viewer taps play — so the IFrame API script and the clip's
  // initial buffer are already loaded/warm by the time `playing` flips true,
  // instead of starting that whole chain at tap time. Instagram has no
  // separate cue/play control (cross-origin), so for it this is the only
  // gate — it plays as soon as it's mounted, same as before.
  active: boolean;
  // YouTube only: whether playback should actually be running. Toggling this
  // on an already-`active` (mounted, cued) player just resumes it — no reload.
  playing: boolean;
  // YouTube only: whether the reel should be silent. Browsers block
  // autoplay-with-sound unless the page already saw a user gesture, so every
  // reel mounts muted and this is how the app's speaker toggle turns sound on
  // without restarting the clip (see the `muted`-changed effect below).
  muted?: boolean;
  onEnded?: () => void;
  // YouTube only: fires once the embed confirms real playback has begun (not
  // just that the iframe mounted) — see `youtubeEmbedHtml.ts`'s 'playing'
  // postMessage. Lets the caller keep its own poster up over the iframe's
  // brief load/buffer window instead of exposing YouTube's own loading state.
  onStarted?: () => void;
  // YouTube only: fires once, after ~30s of real playback have accumulated (or a
  // near-complete watch of a shorter clip) — see `youtubeEmbedHtml.ts`'s
  // 'watched' postMessage. The feed counts the in-app view on this, not on
  // scroll-in, so an in-app play is a genuine watch YouTube may also count.
  onWatched?: () => void;
  style?: StyleProp<ViewStyle>;
}

// The player is a DOM <iframe>. YouTube reuses the shared IFrame-API HTML via
// srcDoc (origin = this page's origin); Instagram loads its /embed/ page directly
// (a nested srcDoc frame, or a CSS-transformed iframe on mobile, stopped IG
// playing on tap) and hides IG's chrome with plain layout offsets.
export function VideoPlayer({ platform, videoId, active, playing, muted = true, onEnded, onStarted, onWatched, style }: VideoPlayerProps) {
  const isYouTube = platform === 'youtube';
  const iframeRef = useRef<HTMLIFrameElement>(null);

  useEffect(() => {
    if (!active || !isYouTube) return;
    function onMessage(e: MessageEvent) {
      if (e.data === 'ended') onEnded?.();
      else if (e.data === 'playing') onStarted?.();
      else if (e.data === 'watched') onWatched?.();
    }
    window.addEventListener('message', onMessage);
    return () => window.removeEventListener('message', onMessage);
  }, [active, isYouTube, onEnded, onStarted, onWatched]);

  // Only the initial mute state is baked into the iframe's srcDoc (below) —
  // reacting to `muted` here and posting to the live player instead means
  // toggling sound doesn't reload (and restart) the clip.
  useEffect(() => {
    if (!active || !isYouTube) return;
    iframeRef.current?.contentWindow?.postMessage(muted ? 'mute' : 'unmute', '*');
  }, [active, isYouTube, muted]);

  // The player mounts cued-but-paused as soon as it's `active` (buffering in
  // the background); this is what actually starts/stops it once the viewer
  // taps play — a message to an already-warm player instead of building the
  // whole embed from scratch at tap time.
  useEffect(() => {
    if (!active || !isYouTube) return;
    iframeRef.current?.contentWindow?.postMessage(playing ? 'play' : 'pause', '*');
  }, [active, isYouTube, playing]);

  // Frozen at the moment the reel becomes active (each scroll-in is a fresh
  // iframe, since `active` going false unmounts it below) so later `muted`
  // changes flow through the postMessage effect above instead of regenerating
  // srcDoc.
  const initialMutedRef = useRef(muted);
  const wasActiveRef = useRef(false);
  if (active && !wasActiveRef.current) initialMutedRef.current = muted;
  wasActiveRef.current = active;

  if (!active) return null;

  if (isYouTube) {
    return (
      <View style={[styles.fill, style]}>
        <iframe
          ref={iframeRef}
          title="YouTube video player"
          srcDoc={youtubeEmbedHtml(videoId, window.location.origin, initialMutedRef.current)}
          style={{ width: '100%', height: '100%', border: '0', display: 'block', backgroundColor: '#000' }}
          allow="autoplay; encrypted-media; picture-in-picture; fullscreen"
          allowFullScreen
        />
      </View>
    );
  }

  // Instagram: its /embed/ page has no chromeless/API mode, so we clip it and
  // offset the iframe with plain layout (no CSS transform — that breaks touch
  // taps on mobile). The iframe is rendered INSTAGRAM_SCALE times wider than the
  // clip so IG's media area grows to fill the frame's height, pushing IG's
  // header off the top and its footer off the bottom; the extra width spills
  // evenly past both sides and is cropped. IG can't autoplay and its centre play
  // button is inside its own cross-origin document — one tap on it starts the reel.
  return (
    <View style={[styles.fill, style]}>
      <div style={{ position: 'absolute', inset: 0, overflow: 'hidden', background: '#000' }}>
        <iframe
          title="Instagram video player"
          src={instagramReelEmbedSrc(videoId)}
          scrolling="no"
          style={{
            position: 'absolute',
            left: `${(1 - INSTAGRAM_SCALE) * 50}%`,
            top: `-${INSTAGRAM_HEADER_PX * INSTAGRAM_SCALE}px`,
            width: `${INSTAGRAM_SCALE * 100}%`,
            height: `calc(${INSTAGRAM_SCALE * 100}% + ${INSTAGRAM_EXTRA_HEIGHT_PX}px)`,
            border: '0',
            display: 'block',
            background: '#000',
          }}
          allow="autoplay; encrypted-media; picture-in-picture; fullscreen"
          allowFullScreen
        />
        {/* Top + bottom scrim "padding", same as the YouTube embed's #mask-top /
            #mask-bottom: opaque for OPAQUE px, then fading out. Top gives the
            reel some breathing room; bottom also covers IG's footer text. */}
        <div
          style={{
            position: 'absolute',
            left: 0,
            right: 0,
            top: 0,
            height: `${INSTAGRAM_MASK_TOP_HEIGHT_PX}px`,
            background: `linear-gradient(to bottom, #000 0, #000 ${INSTAGRAM_MASK_TOP_OPAQUE_PX}px, rgba(0,0,0,0) 100%)`,
            pointerEvents: 'none',
          }}
        />
        <div
          style={{
            position: 'absolute',
            left: 0,
            right: 0,
            bottom: 0,
            height: `${INSTAGRAM_MASK_BOTTOM_HEIGHT_PX}px`,
            background: `linear-gradient(to top, #000 0, #000 ${INSTAGRAM_MASK_BOTTOM_OPAQUE_PX}px, rgba(0,0,0,0) 100%)`,
            pointerEvents: 'none',
          }}
        />
      </div>
    </View>
  );
}

const styles = StyleSheet.create({
  fill: { ...StyleSheet.absoluteFillObject, backgroundColor: '#000', overflow: 'hidden' },
});
